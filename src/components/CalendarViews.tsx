import { ChevronLeft, ChevronRight, PanelRightClose, Plus } from "lucide-react";
import { addDays, longDate, monthName, parseLocal, relativeDay, startOfWeek, todayStr } from "../dates";
import { inboxTasks, sortTasks } from "../selectors";
import { PALETTE, uid, useStore } from "../store";
import type { CalendarMode } from "../types";
import { TaskRow } from "./TaskRow";
import { TimeGrid } from "./TimeGrid";

/** The day calendar docked to the right of the task list. */
export function RightPanel() {
  const date = useStore((s) => s.panelDate);
  const set = useStore((s) => s.set);
  const today = todayStr();
  return (
    <div className="right-panel">
      <div className="panel-head drag" data-tauri-drag-region>
        <span className="title" data-tauri-drag-region>
          {relativeDay(date)}
        </span>
        <span className="sub" data-tauri-drag-region>
          {date === today || relativeDay(date).length > 7 ? longDate(date).split(", ")[1] : longDate(date)}
        </span>
        <div className="grow" data-tauri-drag-region />
        {date !== today && (
          <button className="btn ghost" style={{ height: 26, padding: "0 8px" }} onClick={() => set({ panelDate: today })}>
            Today
          </button>
        )}
        <button className="icon-btn" onClick={() => set({ panelDate: addDays(date, -1) })} title="Previous day">
          <ChevronLeft size={16} />
        </button>
        <button className="icon-btn" onClick={() => set({ panelDate: addDays(date, 1) })} title="Next day">
          <ChevronRight size={16} />
        </button>
        <button className="icon-btn" onClick={() => set({ rightPanel: false })} title="Hide calendar (⌘\)">
          <PanelRightClose size={16} />
        </button>
      </div>
      <TimeGrid days={[date]} compact />
    </div>
  );
}

export function calendarDays(date: string, mode: CalendarMode, weekStartsOn: number) {
  if (mode === "day") return [date];
  if (mode === "3day") return [date, addDays(date, 1), addDays(date, 2)];
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Full-width calendar with an unscheduled-task tray to drag from. */
export function CalendarView() {
  const date = useStore((s) => s.calDate);
  const mode = useStore((s) => s.calMode);
  const weekStartsOn = useStore((s) => Number(s.settings.weekStartsOn ?? 1));
  const tasks = useStore((s) => s.tasks);
  const set = useStore((s) => s.set);
  const days = calendarDays(date, mode, weekStartsOn);
  const step = mode === "day" ? 1 : mode === "3day" ? 3 : 7;
  const first = parseLocal(days[0]);
  const last = parseLocal(days[days.length - 1]);
  const title =
    first.getMonth() === last.getMonth()
      ? `${monthName(first.getMonth())} ${first.getFullYear()}`
      : `${monthName(first.getMonth(), true)} – ${monthName(last.getMonth(), true)} ${last.getFullYear()}`;

  const today = todayStr();
  const todayUnscheduled = sortTasks(tasks.filter((t) => !t.done && !t.start && t.date && t.date <= today));
  const inbox = sortTasks(inboxTasks(tasks));

  return (
    <div className="main">
      <div className="main-header drag" data-tauri-drag-region>
        <h1 data-tauri-drag-region>{title}</h1>
        <div className="grow" data-tauri-drag-region />
        <div className="seg">
          {(["day", "3day", "week"] as CalendarMode[]).map((m) => (
            <button key={m} className={mode === m ? "on" : ""} onClick={() => set({ calMode: m })}>
              {m === "day" ? "Day" : m === "3day" ? "3 days" : "Week"}
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => set({ calDate: today })}>
          Today
        </button>
        <button className="icon-btn" onClick={() => set({ calDate: addDays(date, -step) })} title="Previous ([)">
          <ChevronLeft size={17} />
        </button>
        <button className="icon-btn" onClick={() => set({ calDate: addDays(date, step) })} title="Next (])">
          <ChevronRight size={17} />
        </button>
        <button
          className="btn primary"
          onClick={() => {
            const d = days.includes(today) ? today : days[0];
            const h = Math.min(22, new Date().getHours() + 1);
            set({
              eventEditor: {
                isNew: true,
                event: { id: uid(), title: "", start: `${d}T${String(h).padStart(2, "0")}:00`, end: `${d}T${String(h).padStart(2, "0")}:30`, allDay: false, color: PALETTE[4], notes: "", location: "" },
              },
            });
          }}
        >
          <Plus size={14} /> Event
        </button>
      </div>
      <div className="cal-view">
        <div className="cal-tray">
          <div className="list-scroll">
            <div className="tray-head">Today · to schedule</div>
            {todayUnscheduled.map((t) => (
              <TaskRow key={t.id} task={t} compact showDate={false} />
            ))}
            {!todayUnscheduled.length && <div className="hint" style={{ padding: "6px 14px 10px" }}>All of today's tasks are on the calendar.</div>}
            <div className="tray-head" style={{ marginTop: 10 }}>Inbox</div>
            {inbox.map((t) => (
              <TaskRow key={t.id} task={t} compact />
            ))}
            {!inbox.length && <div className="hint" style={{ padding: "6px 14px" }}>Inbox is empty.</div>}
          </div>
        </div>
        <TimeGrid days={days} />
      </div>
    </div>
  );
}
