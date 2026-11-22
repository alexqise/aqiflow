import type React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus } from "lucide-react";
import { calendarDays, DENSITY, densityName, modeLabel, stepDate } from "../calendar";
import { formatTime, isoWeek, monthName, parseLocal, todayStr, weekdayName } from "../dates";
import type { MenuItem } from "../store";
import { anchorOf, PALETTE, uid, useStore } from "../store";
import { TimeGrid } from "./TimeGrid";

/** Builds the view menu; toggles rebuild it so their switches stay current. */
function viewMenu(x: number, y: number): MenuItem[] {
  const s = useStore.getState();
  const st = s.settings;
  const hh = Number(st.hourHeight) || 96;
  const again = () => s.openMenu(x, y, viewMenu(x, y));
  const flip = (k: string) => () => {
    s.setSetting(k, st[k] === "0" ? "1" : "0");
    setTimeout(again, 0);
  };
  const days = Number(st.calDays) || 3;
  return [
    { label: "1 Day", shortcut: "1", onSelect: () => s.set({ calMode: "day" }) },
    {
      label: "Multiple days",
      value: s.calMode === "3day" ? `${days}` : undefined,
      submenu: true,
      onSelect: () =>
        setTimeout(() =>
          s.openMenu(
            x,
            y,
            [2, 3, 4, 5, 6].map((n) => ({
              label: `${n} days`,
              icon: s.calMode === "3day" && days === n ? "check" : undefined,
              onSelect: () => (s.setSetting("calDays", String(n)), s.set({ calMode: "3day" })),
            })),
          ),
        ),
    },
    { label: "Week", shortcut: "W", onSelect: () => s.set({ calMode: "week" }) },
    { label: "Month", shortcut: "M", onSelect: () => s.set({ calMode: "month" }) },
    { separator: true },
    {
      label: "Density",
      value: densityName(hh),
      submenu: true,
      onSelect: () =>
        setTimeout(() =>
          s.openMenu(
            x,
            y,
            Object.entries(DENSITY).map(([name, v]) => ({
              label: name,
              icon: v === hh ? "check" : undefined,
              onSelect: () => s.setSetting("hourHeight", String(v)),
            })),
          ),
        ),
    },
    { separator: true },
    { label: "Weekends", toggle: st.calWeekends !== "0", onSelect: flip("calWeekends") },
    { label: "Done tasks", toggle: st.calShowDone !== "0", onSelect: flip("calShowDone") },
  ];
}

/** The main calendar panel beside the task list. */
export function CalendarPanel() {
  const date = useStore((s) => s.calDate);
  const mode = useStore((s) => s.calMode);
  const listHidden = useStore((s) => s.listHidden);
  const settings = useStore((s) => s.settings);
  const set = useStore((s) => s.set);
  const days = calendarDays(date, mode, settings);
  const first = parseLocal(mode === "month" ? date : days[0]);
  const today = todayStr();

  const pickMode = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.right - 252;
    const y = r.bottom + 6;
    useStore.getState().openMenu(x, y, viewMenu(x, y));
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
        {mode !== "month" && <span className="week-chip">W{isoWeek(days[0])}</span>}
        <div className="grow" data-tauri-drag-region />
        <button className="icon-btn text" onClick={() => set({ calDate: today })} title="Go to today (.)">
          T
        </button>
        <button className="icon-btn" onClick={() => set({ calDate: stepDate(date, mode, settings, -1) })} title="Previous ([)">
          <ChevronLeft size={17} />
        </button>
        <button className="icon-btn" onClick={() => set({ calDate: stepDate(date, mode, settings, 1) })} title="Next (])">
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
          {modeLabel(mode, settings)}
        </button>
      </header>
      {mode === "month" ? <MonthGrid days={days} month={first.getMonth()} /> : <TimeGrid days={days} />}
    </section>
  );
}

/** Six-week month overview; click a day number to open it in day view. */
function MonthGrid({ days, month }: { days: string[]; month: number }) {
  const tasks = useStore((s) => s.tasks);
  const events = useStore((s) => s.events);
  const projects = useStore((s) => s.projects);
  const showDone = useStore((s) => s.settings.calShowDone !== "0");
  const today = todayStr();
  const s = useStore.getState();

  return (
    <div className="month">
      <div className="month-head">
        {days.slice(0, 7).map((d) => (
          <span key={d}>{weekdayName(d, true)}</span>
        ))}
      </div>
      <div className="month-grid">
        {days.map((d) => {
          const evs = events.filter((e) => e.start.slice(0, 10) <= d && e.end.slice(0, 10) >= d).sort((a, b) => a.start.localeCompare(b.start));
          const ts = tasks.filter((t) => t.date === d && (showDone || !t.done)).sort((a, b) => (a.start ?? "~").localeCompare(b.start ?? "~"));
          const items = [
            ...evs.map((e) => ({ k: "e" + e.id, label: e.title || "(No title)", time: e.allDay ? "" : formatTime(e.start, true), color: e.color, done: false, open: () => s.set({ eventEditor: { isNew: false, event: e } }) })),
            ...ts.map((t) => ({
              k: "t" + t.id,
              label: t.title || "Untitled task",
              time: t.start ? formatTime(t.start, true) : "",
              color: projects.find((p) => p.id === t.projectId)?.color ?? "var(--text-3)",
              done: t.done,
              open: (el: Element) => s.openDetail(t.id, anchorOf(el)),
            })),
          ];
          const out = parseLocal(d).getMonth() !== month;
          return (
            <div key={d} className={`month-cell ${out ? "out" : ""} ${d === today ? "today" : ""}`}>
              <button className="month-num" onClick={() => s.set({ calDate: d, calMode: "day" })}>
                {parseLocal(d).getDate()}
              </button>
              {items.slice(0, 4).map((it) => (
                <button key={it.k} className={`month-item ${it.done ? "done" : ""}`} style={{ ["--c" as string]: it.color }} onClick={(e) => it.open(e.currentTarget)}>
                  <span className="bar" />
                  <span className="t">{it.label}</span>
                  {it.time && <span className="tm">{it.time}</span>}
                </button>
              ))}
              {items.length > 4 && (
                <button className="month-more" onClick={() => s.set({ calDate: d, calMode: "day" })}>
                  {items.length - 4} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
