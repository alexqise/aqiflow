import type React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus } from "lucide-react";
import { addDays, isoWeek, monthName, parseLocal, startOfWeek, todayStr } from "../dates";
import { PALETTE, uid, useStore } from "../store";
import type { CalendarMode } from "../types";
import { TimeGrid } from "./TimeGrid";

function calendarDays(date: string, mode: CalendarMode, weekStartsOn: number) {
  if (mode === "day") return [date];
  if (mode === "3day") return [date, addDays(date, 1), addDays(date, 2)];
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const MODE_LABEL: Record<CalendarMode, string> = { day: "Day", "3day": "3 Days", week: "Week" };

/** The main calendar panel beside the task list. */
export function CalendarPanel() {
  const date = useStore((s) => s.calDate);
  const mode = useStore((s) => s.calMode);
  const listHidden = useStore((s) => s.listHidden);
  const weekStartsOn = useStore((s) => Number(s.settings.weekStartsOn ?? 1));
  const set = useStore((s) => s.set);
  const days = calendarDays(date, mode, weekStartsOn);
  const step = mode === "day" ? 1 : mode === "3day" ? 3 : 7;
  const first = parseLocal(days[0]);
  const today = todayStr();

  const pickMode = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const s = useStore.getState();
    s.openMenu(r.left, r.bottom + 6, [
      ...(["day", "3day", "week"] as CalendarMode[]).map((m) => ({
        label: MODE_LABEL[m],
        icon: m === mode ? "check" : undefined,
        shortcut: m === "day" ? "D" : m === "week" ? "W" : "3",
        onSelect: () => s.set({ calMode: m }),
      })),
    ]);
  };

  return (
    <section className="panel cal-panel">
      <header className="panel-header" data-tauri-drag-region>
        <button className="icon-btn" onClick={() => set({ listHidden: !listHidden })} title={listHidden ? "Show task list" : "Hide task list"}>
          {listHidden ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
        </button>
        <h2 className="panel-title" data-tauri-drag-region>
          {monthName(first.getMonth(), true)} {first.getFullYear()}
        </h2>
        <span className="week-chip">W{isoWeek(days[0])}</span>
        <div className="grow" data-tauri-drag-region />
        <button className="icon-btn text" onClick={() => set({ calDate: today })} title="Go to today (.)">
          T
        </button>
        <button className="icon-btn" onClick={() => set({ calDate: addDays(date, -step) })} title="Previous ([)">
          <ChevronLeft size={17} />
        </button>
        <button className="icon-btn" onClick={() => set({ calDate: addDays(date, step) })} title="Next (])">
          <ChevronRight size={17} />
        </button>
        <button
          className="icon-btn"
          title="New event"
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
          <Plus size={17} />
        </button>
        <button className="mode-btn" onClick={pickMode} title="Change calendar view">
          {MODE_LABEL[mode]}
        </button>
      </header>
      <TimeGrid days={days} />
    </section>
  );
}
