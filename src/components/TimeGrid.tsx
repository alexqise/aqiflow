import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import {
  atMinutes,
  formatDuration,
  formatHourLabel,
  formatTime,
  minutesOfDay,
  todayStr,
  weekdayName,
  parseLocal,
} from "../dates";
import { droppedTaskId, isTaskDrag, drag as dragState } from "../dnd";
import { plannedMinutes } from "../selectors";
import { PALETTE, uid, useStore } from "../store";
import type { CalEvent, Task } from "../types";
import { Checkbox } from "./common";
import { taskMenu } from "../actions";

const SNAP = 15;
const snap = (m: number) => Math.max(0, Math.min(24 * 60, Math.round(m / SNAP) * SNAP));
/** Snaps to the slot the pointer is inside (used for drops and click-to-create). */
const slot = (m: number) => Math.max(0, Math.min(24 * 60 - SNAP, Math.floor((m + 0.5) / SNAP) * SNAP));

interface Item {
  key: string;
  kind: "event" | "task";
  id: string;
  day: string;
  start: number;
  end: number;
  event?: CalEvent;
  task?: Task;
  col: number;
  cols: number;
}

type Interaction =
  | { mode: "create"; day: string; anchor: number; start: number; end: number; moved: boolean }
  | { mode: "move"; item: Item; grabOffset: number; day: string; start: number; end: number; moved: boolean; x0: number; y0: number }
  | { mode: "resize"; item: Item; day: string; start: number; end: number; moved: boolean };

function layoutDay(items: Omit<Item, "col" | "cols">[]): Item[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Item[] = [];
  let cluster: Item[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((i) => i.col + 1));
    cluster.forEach((i) => (i.cols = n));
    cluster = [];
  };
  for (const it of sorted) {
    if (it.start >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const used = new Set(cluster.filter((c) => c.end > it.start).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    const placed: Item = { ...it, col, cols: 1 };
    cluster.push(placed);
    out.push(placed);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return out;
}

export function TimeGrid({ days, compact }: { days: string[]; compact?: boolean }) {
  const tasks = useStore((s) => s.tasks);
  const events = useStore((s) => s.events);
  const projects = useStore((s) => s.projects);
  const settings = useStore((s) => s.settings);
  const selectedId = useStore((s) => s.selectedId);
  const hh = Number(settings.hourHeight) || 56;
  const workStart = Number(settings.workStart ?? 9);
  const workEnd = Number(settings.workEnd ?? 18);
  const goal = (Number(settings.dailyGoalHours) || 6) * 60;

  const scrollRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [ix, setIx] = useState<Interaction | null>(null);
  const ixRef = useRef<Interaction | null>(null);
  const [dropPreview, setDropPreview] = useState<{ day: string; start: number; duration: number } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const today = todayStr();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Scroll so the current time (or work start) sits near the top.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const n = new Date();
    const anchor = days.includes(today) ? n.getHours() * 60 + n.getMinutes() - 90 : workStart * 60 - 30;
    el.scrollTop = Math.max(0, (anchor / 60) * hh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join(), hh]);

  const projectColor = (t: Task) => projects.find((p) => p.id === t.projectId)?.color;

  const itemsByDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const day of days) {
      const raw: Omit<Item, "col" | "cols">[] = [];
      for (const e of events) {
        if (e.allDay) continue;
        if (e.start.slice(0, 10) > day || e.end.slice(0, 10) < day) continue;
        const s = e.start.slice(0, 10) === day ? minutesOfDay(e.start) : 0;
        const en = e.end.slice(0, 10) === day ? minutesOfDay(e.end) : 24 * 60;
        if (en <= s && e.end.slice(0, 10) === day) continue;
        raw.push({ key: "e" + e.id, kind: "event", id: e.id, day, start: s, end: Math.max(en, s + 15), event: e });
      }
      for (const t of tasks) {
        if (!t.start || t.start.slice(0, 10) !== day) continue;
        const s = minutesOfDay(t.start);
        raw.push({ key: "t" + t.id, kind: "task", id: t.id, day, start: s, end: Math.min(24 * 60, s + Math.max(15, t.duration || 30)), task: t });
      }
      map.set(day, layoutDay(raw));
    }
    return map;
  }, [days.join(), tasks, events]);

  const minuteAt = (clientY: number, colIdx: number) => {
    const el = colRefs.current[colIdx];
    if (!el) return 0;
    return ((clientY - el.getBoundingClientRect().top) / hh) * 60;
  };
  const colAt = (clientX: number) => {
    let best = 0;
    colRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left) best = i;
    });
    return best;
  };

  const update = (next: Interaction | null) => {
    ixRef.current = next;
    setIx(next);
  };

  // Starts a pointer gesture; listeners are attached synchronously so fast drags aren't lost.
  const begin = (first: Interaction) => {
    update(first);
    const move = (e: PointerEvent) => {
      const cur = ixRef.current;
      if (!cur) return;
      if (cur.mode === "create") {
        const di = days.indexOf(cur.day);
        const m = snap(minuteAt(e.clientY, di));
        const start = Math.min(cur.anchor, m);
        const end = Math.max(cur.anchor + (m === cur.anchor ? SNAP : 0), m);
        update({ ...cur, start, end: Math.max(end, start + SNAP), moved: true });
      } else if (cur.mode === "move") {
        if (!cur.moved && Math.hypot(e.clientX - cur.x0, e.clientY - cur.y0) < 4) return;
        const ci = colAt(e.clientX);
        const len = cur.item.end - cur.item.start;
        const start = Math.max(0, Math.min(24 * 60 - len, snap(minuteAt(e.clientY, ci) - cur.grabOffset)));
        update({ ...cur, day: days[ci], start, end: start + len, moved: true });
      } else if (cur.mode === "resize") {
        const di = days.indexOf(cur.day);
        const end = Math.max(cur.start + SNAP, snap(minuteAt(e.clientY, di)));
        update({ ...cur, end, moved: true });
      }
    };
    const up = (e: PointerEvent) => {
      if (ixRef.current?.mode !== "create") move(e);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const cur = ixRef.current;
      update(null);
      if (cur) commit(cur);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const commit = (cur: Interaction) => {
    const s = useStore.getState();
    if (cur.mode === "create") {
      const start = cur.moved ? cur.start : cur.anchor;
      const end = cur.moved ? cur.end : cur.anchor + 30;
      s.set({
        eventEditor: {
          isNew: true,
          event: { id: uid(), title: "", start: atMinutes(cur.day, start), end: atMinutes(cur.day, Math.min(end, 24 * 60 - 1)), allDay: false, color: PALETTE[4], notes: "", location: "" },
        },
      });
      return;
    }
    const { item } = cur;
    if (!cur.moved) {
      if (item.kind === "task") s.openDetail(item.id);
      else s.set({ eventEditor: { isNew: false, event: item.event! } });
      return;
    }
    if (item.kind === "task") {
      s.updateTask(item.id, { start: atMinutes(cur.day, cur.start), duration: cur.end - cur.start });
    } else {
      const e = item.event!;
      const endMin = Math.min(cur.end, 24 * 60 - 1);
      s.saveEvent({ ...e, start: atMinutes(cur.day, cur.start), end: atMinutes(cur.day, endMin) });
    }
  };

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const allDayFor = (day: string) => {
    const evs = events.filter((e) => e.allDay && e.start.slice(0, 10) <= day && e.end.slice(0, 10) >= day);
    const ts = compact ? [] : tasks.filter((t) => !t.done && t.date === day && !t.start);
    return { evs, ts };
  };
  const showAllDay = days.some((d) => {
    const { evs, ts } = allDayFor(d);
    return evs.length || ts.length;
  });

  return (
    <div className="cal">
      {days.length > 1 && (
        <div className="cal-days">
          {days.map((d) => {
            const load = plannedMinutes(tasks, d);
            return (
              <div key={d} className={`cal-day-head ${d === today ? "today" : ""}`}>
                {weekdayName(d, true)}
                <span className="num">{parseLocal(d).getDate()}</span>
                <span className="load" title={`${formatDuration(load) || "0m"} planned`}>
                  <i className={load > goal ? "over" : ""} style={{ width: `${Math.min(100, (load / goal) * 100)}%` }} />
                </span>
              </div>
            );
          })}
        </div>
      )}
      {(showAllDay || days.length > 1) && (
        <div className="cal-allday">
          <div className="gutter">all-day</div>
          {days.map((d) => (
            <AllDayCol key={d} day={d} {...allDayFor(d)} />
          ))}
        </div>
      )}
      <div className="cal-scroll" ref={scrollRef}>
        <div className="cal-grid" style={{ height: hh * 24 }}>
          <div className="cal-gutter">
            {hours.map((h) =>
              h === 0 ? null : (
                <div key={h} className="hour" style={{ top: h * hh }}>
                  {formatHourLabel(h)}
                </div>
              ),
            )}
          </div>
          {days.map((day, di) => {
            const items = itemsByDay.get(day) ?? [];
            return (
              <div
                key={day}
                ref={(el) => (colRefs.current[di] = el)}
                className={`cal-col ${day === today && days.length > 1 ? "today" : ""}`}
                onPointerDown={(e) => {
                  if (e.button !== 0 || e.target !== e.currentTarget) return;
                  const m = slot(minuteAt(e.clientY, di));
                  begin({ mode: "create", day, anchor: m, start: m, end: m + SNAP, moved: false });
                }}
                onDragOver={(e) => {
                  if (!isTaskDrag(e)) return;
                  e.preventDefault();
                  const t = useStore.getState().tasks.find((x) => x.id === dragState.taskId);
                  const duration = t?.duration || Number(settings.defaultDuration) || 30;
                  const start = Math.min(24 * 60 - duration, slot(minuteAt(e.clientY, di)));
                  if (dropPreview?.day !== day || dropPreview.start !== start) setDropPreview({ day, start, duration });
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropPreview(null);
                }}
                onDrop={(e) => {
                  const id = droppedTaskId(e);
                  const p = dropPreview;
                  setDropPreview(null);
                  if (!id || !p) return;
                  e.preventDefault();
                  useStore.getState().updateTask(id, { start: atMinutes(day, p.start), duration: p.duration });
                }}
              >
                <div className="offhours" style={{ top: 0, height: workStart * hh }} />
                <div className="offhours" style={{ top: workEnd * hh, height: (24 - workEnd) * hh }} />
                {hours.map((h) => (
                  <div key={h}>
                    {h > 0 && <div className="hline" style={{ top: h * hh }} />}
                    {hh >= 48 && <div className="hline half" style={{ top: h * hh + hh / 2 }} />}
                  </div>
                ))}
                {items.map((it) => {
                  const active = ix && ix.mode !== "create" && ix.item.key === it.key ? ix : null;
                  if (active && active.day !== day) return null;
                  return (
                    <CalItem
                      key={it.key}
                      item={active ? { ...it, start: active.start, end: active.end, col: 0, cols: 1 } : it}
                      hh={hh}
                      dragging={!!active?.moved}
                      selected={it.kind === "task" && selectedId === it.id}
                      color={it.kind === "event" ? it.event!.color : projectColor(it.task!) ?? "var(--accent)"}
                      onPointerDown={(e, resize) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        if (resize) begin({ mode: "resize", item: it, day, start: it.start, end: it.end, moved: false });
                        else
                          begin({
                            mode: "move",
                            item: it,
                            day,
                            start: it.start,
                            end: it.end,
                            moved: false,
                            grabOffset: minuteAt(e.clientY, di) - it.start,
                            x0: e.clientX,
                            y0: e.clientY,
                          });
                      }}
                    />
                  );
                })}
                {/* An item dragged in from another day. */}
                {ix && ix.mode === "move" && ix.day === day && ix.item.day !== day && (
                  <CalItem
                    item={{ ...ix.item, day, start: ix.start, end: ix.end, col: 0, cols: 1 }}
                    hh={hh}
                    dragging
                    color={ix.item.kind === "event" ? ix.item.event!.color : projectColor(ix.item.task!) ?? "var(--accent)"}
                    onPointerDown={() => {}}
                  />
                )}
                {ix && ix.mode === "create" && ix.day === day && (
                  <div className="drop-ghost" style={{ top: (ix.start / 60) * hh, height: ((ix.end - ix.start) / 60) * hh }}>
                    {formatTime(ix.start, true)} – {formatTime(ix.end, true)}
                  </div>
                )}
                {dropPreview && dropPreview.day === day && (
                  <div className="drop-ghost" style={{ top: (dropPreview.start / 60) * hh, height: (dropPreview.duration / 60) * hh }}>
                    {formatTime(dropPreview.start, true)}
                  </div>
                )}
                {day === today && <div className="now-line" style={{ top: (nowMin / 60) * hh }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CalItem({
  item,
  hh,
  color,
  dragging,
  selected,
  onPointerDown,
}: {
  item: Item;
  hh: number;
  color: string;
  dragging?: boolean;
  selected?: boolean;
  onPointerDown: (e: React.PointerEvent, resize: boolean) => void;
}) {
  const top = (item.start / 60) * hh;
  const height = Math.max(18, ((item.end - item.start) / 60) * hh - 2);
  const short = height < 36;
  const width = `calc(${100 / item.cols}% - 4px)`;
  const left = `calc(${(100 / item.cols) * item.col}% + 2px)`;
  const time = `${formatTime(item.start, true)} – ${formatTime(item.end, true)}`;
  const style = { top, height, width, left, ["--c" as string]: color } as React.CSSProperties;

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const s = useStore.getState();
    if (item.kind === "task") s.openMenu(e.clientX, e.clientY, taskMenu(item.task!, { x: e.clientX, y: e.clientY }));
    else
      s.openMenu(e.clientX, e.clientY, [
        { label: "Edit event", icon: "open", onSelect: () => s.set({ eventEditor: { isNew: false, event: item.event! } }) },
        { label: "Duplicate", icon: "copy", onSelect: () => s.saveEvent({ ...item.event!, id: uid() }) },
        { separator: true },
        { label: "Delete event", icon: "trash", danger: true, onSelect: () => s.deleteEvent(item.id) },
      ]);
  };

  if (item.kind === "event") {
    const e = item.event!;
    return (
      <div
        className={`cal-item event ${short ? "short" : ""} ${dragging ? "dragging" : ""}`}
        style={style}
        onPointerDown={(ev) => onPointerDown(ev, false)}
        onContextMenu={onContextMenu}
        title={`${e.title || "(No title)"}\n${time}`}
      >
        <div className="t">{e.title || "(No title)"}</div>
        <div className="s">
          {short ? formatTime(item.start, true) : time}
          {!short && e.location && (
            <>
              {" · "}
              <MapPin size={10} style={{ verticalAlign: -1 }} /> {e.location}
            </>
          )}
        </div>
        <div className="resize" onPointerDown={(ev) => onPointerDown(ev, true)} />
      </div>
    );
  }
  const t = item.task!;
  return (
    <div
      className={`cal-item task ${short ? "short" : ""} ${t.done ? "done" : ""} ${dragging ? "dragging" : ""} ${selected ? "selected" : ""}`}
      style={style}
      onPointerDown={(ev) => onPointerDown(ev, false)}
      onContextMenu={onContextMenu}
      title={`${t.title}\n${time}`}
    >
      <div className="row">
        <Checkbox task={t} onToggle={() => useStore.getState().toggleDone(t.id)} size={14} />
        <span className="t">{t.title || "Untitled task"}</span>
        {short && <span className="s">{formatTime(item.start, true)}</span>}
      </div>
      {!short && <div className="s" style={{ paddingLeft: 20 }}>{time}</div>}
      <div className="resize" onPointerDown={(ev) => onPointerDown(ev, true)} />
    </div>
  );
}

function AllDayCol({ day, evs, ts }: { day: string; evs: CalEvent[]; ts: Task[] }) {
  const [over, setOver] = useState(false);
  const max = 3;
  const items = [...evs.map((e) => ({ k: "e" + e.id, e })), ...ts.map((t) => ({ k: "t" + t.id, t }))];
  return (
    <div
      className={`col ${over ? "drop-over" : ""}`}
      onDragOver={(e) => {
        if (!isTaskDrag(e)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = droppedTaskId(e);
        if (!id) return;
        e.preventDefault();
        useStore.getState().updateTask(id, { date: day, start: null });
      }}
      onDoubleClick={(e) => {
        if (e.target !== e.currentTarget) return;
        useStore.getState().set({
          eventEditor: { isNew: true, event: { id: uid(), title: "", start: `${day}T00:00`, end: `${day}T23:59`, allDay: true, color: PALETTE[6], notes: "", location: "" } },
        });
      }}
    >
      {items.slice(0, max).map((it) =>
        "e" in it && it.e ? (
          <div
            key={it.k}
            className="allday-item"
            style={{ background: `color-mix(in srgb, ${it.e.color} 18%, var(--bg))`, color: `color-mix(in srgb, ${it.e.color} 65%, var(--text))` }}
            onClick={() => useStore.getState().set({ eventEditor: { isNew: false, event: it.e! } })}
          >
            {it.e.title || "(No title)"}
          </div>
        ) : (
          <div
            key={it.k}
            className="allday-item"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-aqiflow-task", (it as { t: Task }).t.id);
              dragState.taskId = (it as { t: Task }).t.id;
            }}
            style={{ background: "var(--bg-hover)", color: "var(--text-2)" }}
            onClick={() => useStore.getState().openDetail((it as { t: Task }).t.id)}
          >
            ○ {(it as { t: Task }).t.title}
          </div>
        ),
      )}
      {items.length > max && <div className="hint" style={{ paddingLeft: 6, fontSize: 11 }}>+{items.length - max} more</div>}
    </div>
  );
}

