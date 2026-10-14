import {
  Archive,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Hash,
  Inbox,
  Keyboard,
  Plus,
  Search,
  Settings,
  Sun,
  Zap,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { formatDuration, todayStr } from "../dates";
import { droppedTaskId, isTaskDrag } from "../dnd";
import { countFor, isOverdue, plannedMinutes, sameView } from "../selectors";
import { PALETTE, useStore } from "../store";
import type { Task, View } from "../types";
import { Keys, ProgressRing } from "./common";

export function Sidebar() {
  const view = useStore((s) => s.view);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const settings = useStore((s) => s.settings);
  const [adding, setAdding] = useState<"project" | "tag" | null>(null);
  const today = todayStr();
  const overdue = tasks.filter((t) => isOverdue(t, today)).length;

  const planned = plannedMinutes(tasks, today);
  const goal = (Number(settings.dailyGoalHours) || 6) * 60;
  const doneToday = tasks.filter((t) => t.done && t.doneAt?.slice(0, 10) === today).length;
  const openToday = tasks.filter((t) => !t.done && t.date === today).length;

  const s = useStore.getState;
  const projectMenu = (id: string, x: number, y: number) => {
    const p = s().projects.find((p) => p.id === id)!;
    s().openMenu(x, y, [
      { label: "Rename", onSelect: () => { const n = prompt("Rename project", p.name); if (n?.trim()) s().updateProject({ ...p, name: n.trim() }); } },
      { label: "Change color", onSelect: () => s().updateProject({ ...p, color: PALETTE[(PALETTE.indexOf(p.color) + 1) % PALETTE.length] }) },
      { separator: true },
      { label: "Delete project", danger: true, icon: "trash", onSelect: () => { if (confirm(`Delete “${p.name}”? Its tasks move to no project.`)) s().deleteProject(p.id); } },
    ]);
  };
  const tagMenu = (id: string, x: number, y: number) => {
    const t = s().tags.find((t) => t.id === id)!;
    s().openMenu(x, y, [
      { label: "Rename", onSelect: () => { const n = prompt("Rename tag", t.name); if (n?.trim()) s().updateTag({ ...t, name: n.trim() }); } },
      { label: "Change color", onSelect: () => s().updateTag({ ...t, color: PALETTE[(PALETTE.indexOf(t.color) + 1) % PALETTE.length] }) },
      { separator: true },
      { label: "Delete tag", danger: true, icon: "trash", onSelect: () => s().deleteTag(t.id) },
    ]);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-top drag" data-tauri-drag-region>
        <button className="icon-btn" title="Quick add (⌘N)" onClick={() => s().set({ quickAdd: { open: true } })}>
          <Plus size={17} />
        </button>
      </div>
      <button className="sidebar-search" onClick={() => s().set({ commandOpen: true })}>
        <Search size={14} />
        Search or command
        <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
          <Keys keys="mod K" />
        </span>
      </button>

      <div className="sidebar-scroll">
        <NavItem view={{ kind: "inbox" }} icon={<Inbox size={16} />} label="Inbox" count={countFor({ kind: "inbox" }, tasks)} drop={{ date: null, start: null, someday: false }} />
        <NavItem
          view={{ kind: "today" }}
          icon={<Sun size={16} />}
          label="Today"
          count={countFor({ kind: "today" }, tasks)}
          alert={overdue > 0}
          drop={{ date: today }}
        />
        <NavItem view={{ kind: "upcoming" }} icon={<CalendarRange size={16} />} label="Upcoming" count={countFor({ kind: "upcoming" }, tasks)} />
        <NavItem view={{ kind: "calendar" }} icon={<CalendarDays size={16} />} label="Calendar" />
        <NavItem view={{ kind: "someday" }} icon={<Archive size={16} />} label="Someday" count={countFor({ kind: "someday" }, tasks)} drop={{ someday: true, date: null, start: null }} />
        <NavItem view={{ kind: "done" }} icon={<CheckCircle2 size={16} />} label="Done" />

        <div className="nav-section">
          <div className="nav-section-head">
            <span className="grow">Projects</span>
            <button className="icon-btn sm" title="New project" onClick={() => setAdding("project")}>
              <Plus size={14} />
            </button>
          </div>
          {projects.map((p) => (
            <NavItem
              key={p.id}
              view={{ kind: "project", id: p.id }}
              icon={<span className="nav-dot" style={{ background: p.color }} />}
              label={p.name}
              count={countFor({ kind: "project", id: p.id }, tasks)}
              drop={{ projectId: p.id }}
              onContext={(x, y) => projectMenu(p.id, x, y)}
            />
          ))}
          {adding === "project" && <AddInput placeholder="Project name" onDone={(name) => { if (name) s().setView({ kind: "project", id: s().addProject(name).id }); setAdding(null); }} />}
        </div>

        <div className="nav-section">
          <div className="nav-section-head">
            <span className="grow">Tags</span>
            <button className="icon-btn sm" title="New tag" onClick={() => setAdding("tag")}>
              <Plus size={14} />
            </button>
          </div>
          {tags.map((t) => (
            <NavItem
              key={t.id}
              view={{ kind: "tag", id: t.id }}
              icon={<Hash size={15} style={{ color: t.color }} />}
              label={t.name}
              count={countFor({ kind: "tag", id: t.id }, tasks)}
              dropFn={(task) => ({ tags: task.tags.includes(t.id) ? task.tags : [...task.tags, t.id] })}
              onContext={(x, y) => tagMenu(t.id, x, y)}
            />
          ))}
          {adding === "tag" && <AddInput placeholder="Tag name" onDone={(name) => { if (name) s().addTag(name); setAdding(null); }} />}
        </div>
      </div>

      <div className="sidebar-bottom">
        <button className="plan-cta" onClick={() => s().set({ planningOpen: true })}>
          <ProgressRing value={doneToday / Math.max(1, doneToday + openToday)} />
          <div style={{ minWidth: 0 }}>
            <div className="title">Plan your day</div>
            <div className="sub">
              {formatDuration(planned) || "0m"} of {formatDuration(goal)} · {doneToday}/{doneToday + openToday} done
            </div>
          </div>
        </button>
        <div className="sidebar-footer">
          <button className="icon-btn" title="Settings (⌘,)" onClick={() => s().set({ settingsOpen: true })}>
            <Settings size={16} />
          </button>
          <button className="icon-btn" title="Keyboard shortcuts (?)" onClick={() => s().set({ shortcutsOpen: true })}>
            <Keyboard size={16} />
          </button>
          <div className="grow" />
          <button className="icon-btn" title="Global quick add" onClick={() => s().set({ quickAdd: { open: true } })}>
            <Zap size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  view,
  icon,
  label,
  count,
  alert,
  drop,
  dropFn,
  onContext,
}: {
  view: View;
  icon: ReactNode;
  label: string;
  count?: number;
  alert?: boolean;
  drop?: Partial<Task>;
  dropFn?: (t: Task) => Partial<Task>;
  onContext?: (x: number, y: number) => void;
}) {
  const active = useStore((s) => sameView(s.view, view));
  const [over, setOver] = useState(false);
  const canDrop = !!(drop || dropFn);
  return (
    <button
      className={`nav-item ${active ? "active" : ""} ${over ? "drop-over" : ""}`}
      onClick={() => useStore.getState().setView(view)}
      onContextMenu={(e) => {
        if (!onContext) return;
        e.preventDefault();
        onContext(e.clientX, e.clientY);
      }}
      onDragOver={(e) => {
        if (!canDrop || !isTaskDrag(e)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = droppedTaskId(e);
        if (!id) return;
        e.preventDefault();
        const s = useStore.getState();
        const task = s.tasks.find((t) => t.id === id);
        if (!task) return;
        const patch = dropFn ? dropFn(task) : { ...drop };
        // Dropping onto Today keeps an existing time of day.
        if (patch.date && task.start) patch.start = `${patch.date}T${task.start.slice(11)}`;
        s.updateTask(id, patch);
        s.showToast(`Moved to ${label}`);
      }}
    >
      {icon}
      <span className="label">{label}</span>
      {count ? <span className={`count ${alert ? "alert" : ""}`}>{count}</span> : null}
    </button>
  );
}

function AddInput({ placeholder, onDone: done }: { placeholder: string; onDone: (v: string) => void }) {
  const [v, setV] = useState("");
  const fired = useRef(false);
  const onDone = (value: string) => {
    if (fired.current) return;
    fired.current = true;
    done(value);
  };
  return (
    <input
      className="nav-input"
      autoFocus
      placeholder={placeholder}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onDone(v.trim())}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onDone(v.trim());
        if (e.key === "Escape") onDone("");
      }}
    />
  );
}
