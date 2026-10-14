import * as chrono from "chrono-node";
import { Archive, ChevronLeft, ChevronRight, Inbox, Sun, Sunrise, CalendarRange, Sofa } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { addDays, formatTime, monthGrid, monthName, parseLocal, relativeDay, startOfWeek, todayStr, toDateStr, toDateTimeStr } from "../dates";
import { useStore } from "../store";
import type { Task } from "../types";

type When = Pick<Task, "date" | "start" | "someday">;

export function DatePickerPanel({ value, onChange }: { value: When; onChange: (v: When) => void }) {
  const weekStartsOn = useStore((s) => Number(s.settings.weekStartsOn ?? 1));
  const today = todayStr();
  const base = parseLocal(value.date ?? today);
  const [cursor, setCursor] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const [text, setText] = useState("");
  const parsed = text.trim() ? chrono.parse(text, new Date(), { forwardDate: true })[0] : undefined;

  const keepTime = (d: string) => (value.start ? `${d}T${value.start.slice(11)}` : null);
  const pick = (d: string | null, someday = false) => onChange({ date: d, start: d ? keepTime(d) : null, someday });

  const dows = Array.from({ length: 7 }, (_, i) => ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][(i + weekStartsOn) % 7]);
  const nextWeek = addDays(startOfWeek(today, weekStartsOn), 7);
  const sat = addDays(today, (6 - parseLocal(today).getDay() + 7) % 7 || 7);

  return (
    <div className="datepicker">
      <input
        className="nl"
        autoFocus
        placeholder="Type a date… “next fri 3pm”"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && parsed) {
            const d = parsed.start.date();
            onChange({ date: toDateStr(d), start: parsed.start.isCertain("hour") ? toDateTimeStr(d) : null, someday: false });
          }
          if (e.key === "Escape") useStore.getState().set({ datePicker: null });
        }}
      />
      {parsed && (
        <div className="hint" style={{ padding: "0 6px 8px" }}>
          → {relativeDay(toDateStr(parsed.start.date()))}
          {parsed.start.isCertain("hour") ? ` at ${formatTime(toDateTimeStr(parsed.start.date()))}` : ""} · press ↵
        </div>
      )}
      <div className="dp-quick">
        <button className="menu-item" onClick={() => pick(today)}>
          <Sun size={14} /> Today <span className="r">{parseLocal(today).toLocaleDateString(undefined, { weekday: "short" })}</span>
        </button>
        <button className="menu-item" onClick={() => pick(addDays(today, 1))}>
          <Sunrise size={14} /> Tomorrow
        </button>
        <button className="menu-item" onClick={() => pick(sat)}>
          <Sofa size={14} /> Weekend
        </button>
        <button className="menu-item" onClick={() => pick(nextWeek)}>
          <CalendarRange size={14} /> Next week
        </button>
        <button className="menu-item" onClick={() => pick(null, true)}>
          <Archive size={14} /> Someday
        </button>
        <button className="menu-item" onClick={() => pick(null)}>
          <Inbox size={14} /> No date
        </button>
      </div>
      <div className="dp-month-head">
        {monthName(cursor.m)} {cursor.y}
        <div className="grow" />
        <button className="icon-btn sm" onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}>
          <ChevronLeft size={14} />
        </button>
        <button className="icon-btn sm" onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}>
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="dp-grid">
        {dows.map((d) => (
          <div key={d} className="dow">
            {d}
          </div>
        ))}
        {monthGrid(cursor.y, cursor.m, weekStartsOn).map((d) => {
          const dt = parseLocal(d);
          const cls = [dt.getMonth() !== cursor.m ? "out" : "", d === today ? "today" : "", d === value.date ? "sel" : "", d < today ? "past" : ""].join(" ");
          return (
            <button key={d} className={cls} onClick={() => pick(d)}>
              {dt.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Floating date picker anchored at a screen point (used by row "S" shortcut and context menu). */
export function DatePickerPopover() {
  const dp = useStore((s) => s.datePicker);
  const task = useStore((s) => s.tasks.find((t) => t.id === s.datePicker?.taskId));
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!dp || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: Math.min(dp.x, window.innerWidth - r.width - 8), y: Math.min(dp.y, window.innerHeight - r.height - 8) });
  }, [dp]);

  useEffect(() => {
    if (!dp) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) useStore.getState().set({ datePicker: null });
    };
    setTimeout(() => window.addEventListener("mousedown", close), 0);
    return () => window.removeEventListener("mousedown", close);
  }, [dp]);

  if (!dp || !task) return null;
  return (
    <div className="popover" ref={ref} style={{ left: pos.x, top: pos.y, padding: 0 }}>
      <DatePickerPanel
        value={task}
        onChange={(v) => {
          useStore.getState().updateTask(task.id, v);
          useStore.getState().set({ datePicker: null });
        }}
      />
    </div>
  );
}
