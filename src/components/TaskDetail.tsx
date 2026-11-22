import { AlignLeft, Check, Flag, Hourglass, Info, ListTree, LockOpen, Maximize2, MoreVertical, Plus, Repeat, Tag, X } from "lucide-react";
import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { diffDays, formatDuration, formatTime, parseLocal, RECURRENCE_LABELS, relativeDay, todayStr } from "../dates";
import { PRIORITIES } from "../priorities";
import { uid, useStore } from "../store";
import type { Task } from "../types";
import { Checkbox, PriorityFlag } from "./common";
import { DatePickerPanel } from "./DatePicker";

const DURATIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];
const WIDTH = 420;

type Picker = "date" | "time" | "duration" | "tags" | null;

/** "Wed, Sep 30" style label for the date chip. */
function chipDate(date: string): string {
  const today = todayStr();
  const d = diffDays(today, date);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  return parseLocal(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** Floating task card that opens beside the row (or calendar block) you clicked. */
export function TaskDetail() {
  const task = useStore((s) => s.tasks.find((t) => t.id === s.detailId));
  const anchor = useStore((s) => s.detailAnchor);
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [picker, setPicker] = useState<Picker>(null);
  const [expanded, setExpanded] = useState(false);
  const [info, setInfo] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Keep latest drafts reachable from listeners without re-binding them.
  const draft = useRef({ title, notes, task });
  draft.current = { title, notes, task };

  const save = () => {
    const { title, notes, task } = draft.current;
    if (!task) return;
    const patch: Partial<Task> = {};
    if (title.trim() && title.trim() !== task.title) patch.title = title.trim();
    if (notes !== task.notes) patch.notes = notes;
    if (Object.keys(patch).length) useStore.getState().updateTask(task.id, patch);
  };
  const close = () => {
    save();
    useStore.getState().openDetail(null);
  };

  useEffect(() => {
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
    setPicker(null);
    setInfo(false);
    setAddingSub(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [title, pos]);

  // Place the card to the right of the anchor, else to its left, else centered.
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 230;
    if (expanded || !anchor) {
      setPos(null);
      return;
    }
    let left = anchor.right + 8;
    if (left + WIDTH > window.innerWidth - 8) left = anchor.left - WIDTH - 8;
    if (left < 8) left = Math.max(8, (window.innerWidth - WIDTH) / 2);
    const top = Math.max(84, Math.min(anchor.top, window.innerHeight - h - 12));
    setPos({ left, top });
  }, [anchor, expanded, task?.id]);

  // Click outside closes (menus and pickers rendered elsewhere don't count).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest(".popover, .ctx-keep")) return;
      close();
    };
    const id = setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("mousedown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!task) return null;
  const s = useStore.getState();
  const update = (p: Partial<Task>) => s.updateTask(task.id, p);
  const project = projects.find((p) => p.id === task.projectId);
  const today = todayStr();
  const overdue = !task.done && !!task.date && task.date < today;

  const menuAt = (e: React.MouseEvent, items: Parameters<typeof s.openMenu>[2]) => {
    const r = e.currentTarget.getBoundingClientRect();
    s.openMenu(r.left, r.bottom + 4, items);
  };
  const toggle = (p: Picker) => setPicker((cur) => (cur === p ? null : p));

  const times: string[] = [];
  for (let m = 0; m < 24 * 60; m += 15) times.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);

  const card = (
    <div
      ref={ref}
      className={`task-pop ${expanded ? "expanded" : ""}`}
      style={pos ? { left: pos.left, top: pos.top } : undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          if (picker) setPicker(null);
          else close();
        }
      }}
    >
      <div className="task-pop-tools">
        <button className="icon-btn sm" title="Focus mode" onClick={() => (close(), s.startFocus(task.id))}>
          <Maximize2 size={14} />
        </button>
        <button className={`icon-btn sm ${info ? "on" : ""}`} title="Task info" onClick={() => setInfo(!info)}>
          <Info size={14} />
        </button>
        <button
          className="icon-btn sm"
          title="Task options"
          onClick={(e) =>
            menuAt(e, [
              { label: expanded ? "Collapse" : "Expand", icon: "open", onSelect: () => setExpanded(!expanded) },
              { label: "Duplicate", icon: "copy", onSelect: () => s.duplicateTask(task.id) },
              { label: "Move to Someday", icon: "someday", onSelect: () => update({ someday: true, date: null, start: null }) },
              { separator: true },
              { label: "Delete task", icon: "trash", danger: true, shortcut: "⌫", onSelect: () => (s.openDetail(null), s.deleteTasks([task.id])) },
            ])
          }
        >
          <MoreVertical size={14} />
        </button>
      </div>

      <div className="task-pop-head">
        <button className={`pop-chip ${task.date ? (overdue ? "filled overdue" : "filled") : ""}`} onClick={() => toggle("date")}>
          {task.someday ? "Someday" : task.date ? chipDate(task.date) : "Date"}
        </button>
        <button className={`pop-chip ${task.start ? "filled" : ""}`} onClick={() => toggle("time")}>
          {task.start ? formatTime(task.start).toLowerCase() : "Time"}
        </button>
        <button className={`pop-chip ${task.duration ? "filled" : "icon"}`} title="Duration" onClick={() => toggle("duration")}>
          {task.duration ? formatDuration(task.duration) : <Hourglass size={14} />}
        </button>
        <button
          className={`pop-chip icon ${task.recurrence ? "filled" : ""}`}
          title={task.recurrence ? RECURRENCE_LABELS[task.recurrence] : "Repeat"}
          onClick={(e) =>
            menuAt(e, [
              { label: "Never", icon: task.recurrence ? undefined : "check", onSelect: () => update({ recurrence: null }) },
              ...Object.entries(RECURRENCE_LABELS).map(([k, v]) => ({
                label: v,
                icon: task.recurrence === k ? "check" : undefined,
                onSelect: () => update({ recurrence: k, date: task.date ?? today }),
              })),
            ])
          }
        >
          <Repeat size={14} />
        </button>
        <button className="pop-chip icon" title="Remove from calendar" disabled={!task.start} onClick={() => update({ start: null })}>
          <LockOpen size={14} />
        </button>
        <div className="grow" />
        <button
          className="icon-btn sm"
          title="Priority"
          onClick={(e) =>
            menuAt(
              e,
              PRIORITIES.map((p) => ({ label: p.label, icon: task.priority === p.value ? "check" : undefined, onSelect: () => update({ priority: p.value }) })),
            )
          }
        >
          {task.priority ? <PriorityFlag priority={task.priority} size={15} /> : <Flag size={15} />}
        </button>

        {picker && (
          <div className="pop-picker" onMouseDown={(e) => e.stopPropagation()}>
            {picker === "date" && (
              <DatePickerPanel
                value={task}
                onChange={(v) => {
                  update(v);
                  setPicker(null);
                }}
              />
            )}
            {picker === "time" && (
              <div className="pop-list">
                {task.start && (
                  <button className="menu-item" onClick={() => (update({ start: null }), setPicker(null))}>
                    <X size={14} />
                    <span className="label">No time</span>
                  </button>
                )}
                {times.map((hm) => {
                  const on = task.start?.slice(11) === hm;
                  return (
                    <button
                      key={hm}
                      className={`menu-item ${on ? "active" : ""}`}
                      ref={(el) => on && el?.scrollIntoView({ block: "center" })}
                      onClick={() => {
                        update({ start: `${task.date ?? today}T${hm}`, date: task.date ?? today, someday: false, duration: task.duration || 30 });
                        setPicker(null);
                      }}
                    >
                      <span className="label">{formatTime(`${today}T${hm}`).toLowerCase()}</span>
                      {on && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            )}
            {picker === "duration" && (
              <div className="pop-list">
                <button className="menu-item" onClick={() => (update({ duration: 0 }), setPicker(null))}>
                  <span className="label">No estimate</span>
                  {!task.duration && <Check size={14} />}
                </button>
                {DURATIONS.map((d) => (
                  <button key={d} className="menu-item" onClick={() => (update({ duration: d }), setPicker(null))}>
                    <span className="label">{formatDuration(d)}</span>
                    {task.duration === d && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
            {picker === "tags" && <TagPicker task={task} />}
          </div>
        )}
      </div>

      <div className="task-pop-body">
        <div className="task-pop-title">
          <Checkbox task={task} onToggle={() => s.toggleDone(task.id)} size={18} />
          <textarea
            ref={titleRef}
            rows={1}
            value={title}
            placeholder="Task name"
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
          />
        </div>
        <label className="task-pop-desc">
          <AlignLeft size={16} />
          <textarea placeholder="Description" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={save} />
        </label>
        {(task.subtasks.length > 0 || addingSub) && <Subtasks task={task} autoFocus={addingSub} />}
        {info && (
          <div className="task-pop-info">
            Created {relativeDay(task.createdAt.slice(0, 10))}
            {task.done && task.doneAt ? ` · Completed ${relativeDay(task.doneAt.slice(0, 10))}` : ""}
          </div>
        )}
      </div>

      <div className="task-pop-foot">
        <button
          className="pop-chip"
          onClick={(e) =>
            menuAt(e, [
              { label: "No project", icon: task.projectId ? undefined : "check", onSelect: () => update({ projectId: null }) },
              ...projects.map((p) => ({ label: p.name, icon: task.projectId === p.id ? "check" : "project", onSelect: () => update({ projectId: p.id }) })),
            ])
          }
        >
          {project ? (
            <>
              <span className="chip-dot" style={{ background: project.color }} /> {project.name}
            </>
          ) : (
            "Project"
          )}
        </button>
        <button className={`pop-chip ${task.tags.length ? "" : "icon"}`} title="Tags" onClick={() => toggle("tags")}>
          <Tag size={14} />
          {task.tags.map((id) => {
            const t = tags.find((x) => x.id === id);
            return t ? (
              <span key={id} style={{ color: t.color }}>
                #{t.name}
              </span>
            ) : null;
          })}
        </button>
        <div className="grow" />
        <button className="pop-chip icon" title="Add subtask" onClick={() => setAddingSub(true)}>
          <ListTree size={14} />
        </button>
      </div>
    </div>
  );

  if (expanded || !pos) {
    return (
      <div className="overlay" onMouseDown={close}>
        <div onMouseDown={(e) => e.stopPropagation()}>{card}</div>
      </div>
    );
  }
  return card;
}

function TagPicker({ task }: { task: Task }) {
  const tags = useStore((s) => s.tags);
  const [q, setQ] = useState("");
  const s = useStore.getState();
  const shown = tags.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase().replace(/^#/, "")));
  const toggle = (id: string) => s.updateTask(task.id, { tags: task.tags.includes(id) ? task.tags.filter((x) => x !== id) : [...task.tags, id] });
  return (
    <div className="pop-list">
      <input
        className="nl"
        autoFocus
        placeholder="Search or create a tag"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          const name = q.trim().replace(/^[#@]/, "");
          if (e.key === "Enter" && name) {
            const hit = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
            toggle(hit ? hit.id : s.addTag(name).id);
            setQ("");
          }
        }}
      />
      {shown.map((t) => (
        <button key={t.id} className="menu-item" onClick={() => toggle(t.id)}>
          <span className="chip-dot" style={{ background: t.color }} />
          <span className="label">#{t.name}</span>
          {task.tags.includes(t.id) && <Check size={14} />}
        </button>
      ))}
      {!shown.length && q.trim() && (
        <div className="hint" style={{ padding: "6px 10px" }}>
          <Plus size={11} style={{ verticalAlign: -1 }} /> Enter creates #{q.trim().replace(/^[#@]/, "")}
        </div>
      )}
    </div>
  );
}

function Subtasks({ task, autoFocus }: { task: Task; autoFocus: boolean }) {
  const [draft, setDraft] = useState("");
  const update = (subtasks: Task["subtasks"]) => useStore.getState().updateTask(task.id, { subtasks });
  return (
    <div className="subtasks">
      {task.subtasks.map((st) => (
        <div key={st.id} className={`subtask ${st.done ? "done" : ""}`}>
          <button
            className={`checkbox ${st.done ? "checked" : ""}`}
            onClick={() => update(task.subtasks.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)))}
          >
            <Check size={10} strokeWidth={3.2} />
          </button>
          <input
            defaultValue={st.title}
            onBlur={(e) => update(task.subtasks.map((x) => (x.id === st.id ? { ...x, title: e.target.value } : x)))}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !(e.target as HTMLInputElement).value) update(task.subtasks.filter((x) => x.id !== st.id));
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
      ))}
      <div className="subtask">
        <Plus size={14} color="var(--text-3)" />
        <input
          autoFocus={autoFocus}
          placeholder="Add subtask"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              update([...task.subtasks, { id: uid(), title: draft.trim(), done: false }]);
              setDraft("");
            }
          }}
        />
      </div>
    </div>
  );
}
