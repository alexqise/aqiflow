import type React from "react";
import { CircleCheckBig, Gauge, Inbox, LayoutGrid, MoreVertical, Pause, Play, RefreshCw, Search, SquareTerminal, User } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { fmtClock, focusElapsed } from "../focus";
import { countFor, isOverdue, sameView } from "../selectors";
import { useStore } from "../store";
import { todayStr, parseLocal } from "../dates";
import type { View } from "../types";

/** Window title bar: drag region with the focus-timer pill in the middle. */
export function TitleBar() {
  const s = useStore.getState;
  return (
    <div className="titlebar" data-tauri-drag-region>
      <FocusPill />
      <div className="titlebar-actions">
        <button className="icon-btn" title="Command bar (⌘K)" onClick={() => s().set({ commandOpen: true })}>
          <SquareTerminal size={16} />
        </button>
        <button className="icon-btn" title="Reload data" onClick={() => s().load().then(() => s().showToast("Up to date"))}>
          <RefreshCw size={15} />
        </button>
      </div>
    </div>
  );
}

function FocusPill() {
  const focus = useStore((s) => s.focus);
  const task = useStore((s) => s.tasks.find((t) => t.id === s.focus?.taskId));
  const selected = useStore((s) => s.tasks.find((t) => t.id === s.selectedId));
  const [, tick] = useState(0);
  useEffect(() => {
    if (!focus) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [focus]);

  const s = useStore.getState();
  const target = (task?.duration || 25) * 60_000;
  const remaining = focus ? target - focusElapsed(focus) : 25 * 60_000;
  const paused = focus?.pausedAt != null;

  const start = () => {
    const candidate = selected && !selected.done ? selected : s.tasks.find((t) => !t.done && t.date === todayStr());
    if (candidate) s.startFocus(candidate.id);
    else s.showToast("Select a task to focus on");
  };

  return (
    <div className="focus-pill" data-tauri-drag-region>
      <button
        className="focus-pill-play"
        title={focus ? (paused ? "Resume" : "Pause") : "Start a focus session"}
        onClick={() => {
          if (!focus) return start();
          s.set({
            focus: paused
              ? { ...focus, startedAt: Date.now(), pausedAt: null, elapsedBefore: focus.elapsedBefore + (focus.pausedAt! - focus.startedAt) }
              : { ...focus, pausedAt: Date.now() },
          });
        }}
      >
        {focus && !paused ? <Pause size={12} /> : <Play size={12} />}
      </button>
      <button className="focus-pill-time" onClick={() => (focus ? s.set({ focusOpen: true }) : start())} title={task?.title}>
        {remaining < 0 ? "+" : ""}
        {fmtClock(remaining)}
        {task && <span className="focus-pill-task">{task.title}</span>}
      </button>
      <button
        className="focus-pill-more"
        title="Focus options"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          s.openMenu(r.left - 160, r.bottom + 6, [
            { label: "Open focus mode", icon: "focus", onSelect: () => (focus ? s.set({ focusOpen: true }) : start()) },
            ...(focus ? [{ label: "Stop session", icon: "unschedule", onSelect: () => s.set({ focus: null }) }] : []),
          ]);
        }}
      >
        <MoreVertical size={13} />
      </button>
    </div>
  );
}

/** Today's date drawn as a small calendar glyph (rail icon). */
function TodayGlyph() {
  const day = parseLocal(todayStr()).getDate();
  return (
    <svg width="19" height="19" viewBox="0 0 19 19" aria-hidden>
      <rect x="1.75" y="2.75" width="15.5" height="14.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.75 6.5h15.5" stroke="currentColor" strokeWidth="1.5" />
      <text x="9.5" y="14.6" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" fontFamily="Inter Variable, system-ui">
        {day}
      </text>
    </svg>
  );
}

/** Narrow icon rail on the far left. */
export function Rail() {
  const tasks = useStore((s) => s.tasks);
  const today = todayStr();
  const s = useStore.getState;
  const todayCount = tasks.filter((t) => !t.done && t.date && (t.date === today || isOverdue(t, today))).length;

  const more = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const st = s();
    st.openMenu(r.right + 8, r.top - 260, [
      { label: "Rituals", header: true },
      { label: "Daily Planning", icon: "plan-day", shortcut: "⇧⌘P", onSelect: () => st.set({ planningOpen: true }) },
      { label: "Daily Shutdown", icon: "shutdown-day", onSelect: () => st.set({ shutdown: "day" }) },
      { label: "Weekly Planning", icon: "plan-week", onSelect: () => (st.setView({ kind: "upcoming" }), st.set({ calMode: "week", calDate: todayStr(), listHidden: false })) },
      { label: "Weekly Shutdown", icon: "shutdown-week", onSelect: () => st.set({ shutdown: "week" }) },
      { separator: true },
      { label: "Upcoming", icon: "upcoming", onSelect: () => st.setView({ kind: "upcoming" }) },
      { label: "Someday", icon: "someday", onSelect: () => st.setView({ kind: "someday" }) },
      { label: "Done", icon: "done", onSelect: () => st.setView({ kind: "done" }) },
      { separator: true },
      { label: "Settings", icon: "settings", shortcut: "⌘,", onSelect: () => st.set({ settingsOpen: true }) },
      { label: "Shortcuts", icon: "keyboard", shortcut: "?", onSelect: () => st.set({ shortcutsOpen: true }) },
    ]);
  };

  return (
    <nav className="rail">
      <RailItem view={{ kind: "inbox" }} label="Inbox" badge={countFor({ kind: "inbox" }, tasks)} icon={<Inbox size={18} />} />
      <RailItem view={{ kind: "today" }} label="Today" badge={todayCount} icon={<TodayGlyph />} />
      <RailItem view={{ kind: "tasks" }} label="Tasks" icon={<CircleCheckBig size={18} />} />
      <div className="rail-divider" />
      <RailItem view={{ kind: "ratings" }} label="Ratings" icon={<Gauge size={18} />} />
      <div className="rail-grow" />
      <RailButton label="Search" icon={<Search size={17} />} onClick={() => s().set({ commandOpen: true })} />
      <RailButton label="More" icon={<LayoutGrid size={17} />} onClick={more} />
      <button className="rail-avatar" title="Settings" onClick={() => s().set({ settingsOpen: true })}>
        <User size={15} />
      </button>
    </nav>
  );
}

function RailItem({ view, label, icon, badge }: { view: View; label: string; icon: ReactNode; badge?: number }) {
  const active = useStore((s) => sameView(s.view, view));
  return (
    <button className={`rail-item ${active ? "active" : ""}`} onClick={() => useStore.getState().setView(view)} title={label}>
      <span className="rail-icon">
        {icon}
        {badge ? <span className="rail-badge">{badge > 99 ? "99+" : badge}</span> : null}
      </span>
      <span className="rail-label">{label}</span>
    </button>
  );
}

function RailButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button className="rail-item" onClick={onClick} title={label}>
      <span className="rail-icon">{icon}</span>
      <span className="rail-label">{label}</span>
    </button>
  );
}

