import type React from "react";
import { CheckCircle2, ChevronDown, Inbox, PanelRightClose, PanelRightOpen, Plus, Sparkles, Sun, Archive, CalendarRange, Hash, Folder } from "lucide-react";
import { useState } from "react";
import { formatDuration, longDate, todayStr } from "../dates";
import { droppedTaskId, isTaskDrag } from "../dnd";
import { defaultsFor, plannedMinutes, sectionsFor, viewTitle, type Section } from "../selectors";
import { useStore } from "../store";
import type { Task, View } from "../types";
import { Composer } from "./Composer";
import { TaskRow } from "./TaskRow";

export function ListView() {
  const view = useStore((s) => s.view);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const showCompleted = useStore((s) => s.settings.showCompletedToday !== "0");
  const rightPanel = useStore((s) => s.rightPanel);
  const sections = sectionsFor(view, tasks, showCompleted);
  const total = sections.reduce((n, s) => n + s.tasks.filter((t) => !t.done).length, 0);
  const today = todayStr();

  let sub = "";
  if (view.kind === "today") sub = longDate(today);
  else if (total) sub = `${total} task${total === 1 ? "" : "s"}`;

  const planned = view.kind === "today" ? plannedMinutes(tasks, today) : 0;
  const project = view.kind === "project" ? projects.find((p) => p.id === view.id) : null;

  return (
    <div className="main">
      <div className="main-header drag" data-tauri-drag-region>
        {project && <span className="nav-dot" style={{ background: project.color, width: 14, height: 14, borderRadius: 4, margin: 0 }} />}
        <h1 data-tauri-drag-region>{viewTitle(view, projects, tags)}</h1>
        <span className="sub" data-tauri-drag-region>
          {sub}
        </span>
        <div className="grow" data-tauri-drag-region />
        {view.kind === "today" && planned > 0 && (
          <span className="chip time" title="Estimated time planned for today">
            {formatDuration(planned)} planned
          </span>
        )}
        {view.kind === "today" && (
          <button className="btn" onClick={() => useStore.getState().set({ planningOpen: true })}>
            <Sparkles size={14} color="var(--accent)" />
            Plan day
          </button>
        )}
        <button
          className={`icon-btn ${rightPanel ? "active" : ""}`}
          title="Toggle calendar (⌘\\)"
          onClick={() => useStore.getState().set({ rightPanel: !rightPanel })}
        >
          {rightPanel ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>
      <div className="list-scroll">
        {view.kind !== "done" && <InlineAdd view={view} />}
        <Sections sections={sections} view={view} />
        {total === 0 && sections.every((s) => !s.tasks.length) && <Empty view={view} />}
      </div>
    </div>
  );
}

export function Sections({ sections, view, compact }: { sections: Section[]; view: View; compact?: boolean }) {
  return (
    <>
      {sections.map((s) => (
        <SectionBlock key={s.id} section={s} view={view} compact={compact} />
      ))}
    </>
  );
}

function SectionBlock({ section, view, compact }: { section: Section; view: View; compact?: boolean }) {
  const [closed, setClosed] = useState(false);
  const [over, setOver] = useState(false);
  const minutes = section.tasks.filter((t) => !t.done).reduce((m, t) => m + t.duration, 0);
  const showDate = !["today", "upcoming"].includes(view.kind) || section.id === "overdue" || section.id === "later";

  const onDropBefore = (draggedId: string, target: Task) => {
    const s = useStore.getState();
    const list = section.tasks;
    const i = list.findIndex((t) => t.id === target.id);
    const prev = list[i - 1];
    const sortOrder = prev && prev.id !== draggedId ? (prev.sortOrder + target.sortOrder) / 2 : target.sortOrder - 1;
    s.updateTask(draggedId, { ...(section.dropPatch ?? {}), sortOrder });
  };

  const onDropEnd = (e: React.DragEvent) => {
    setOver(false);
    const id = droppedTaskId(e);
    if (!id || !section.dropPatch) return;
    e.preventDefault();
    const max = section.tasks.reduce((m, t) => Math.max(m, t.sortOrder), 0);
    useStore.getState().updateTask(id, { ...section.dropPatch, sortOrder: max + 1 });
  };

  if (!section.tasks.length && !section.dropPatch) return null;
  const upcomingEmpty = view.kind === "upcoming" && !section.tasks.length;

  return (
    <div className="section">
      {section.title && (
        <div
          className={`section-head ${section.tone ?? ""}`}
          onClick={() => section.collapsible && setClosed(!closed)}
        >
          {section.collapsible && <ChevronDown size={14} className={`chev ${closed ? "closed" : ""}`} />}
          <span>{section.title}</span>
          {section.subtitle && section.subtitle !== section.title && <span className="sub">{section.subtitle}</span>}
          <span className="meta">
            {section.tasks.length > 0 && section.tone !== "muted" && minutes > 0 && formatDuration(minutes)}
            {section.tone === "muted" && section.tasks.length}
          </span>
        </div>
      )}
      {!closed && (
        <div
          className={`section-body ${over ? "drop-over" : ""}`}
          onDragOver={(e) => {
            if (!section.dropPatch || !isTaskDrag(e)) return;
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
          }}
          onDrop={onDropEnd}
        >
          {section.tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              compact={compact}
              showDate={showDate}
              showProject={view.kind !== "project"}
              onDropBefore={section.dropPatch ? onDropBefore : undefined}
            />
          ))}
          {upcomingEmpty && <div className="section-empty" />}
        </div>
      )}
    </div>
  );
}

function InlineAdd({ view }: { view: View }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button className="inline-add" style={{ width: "100%" }} onClick={() => setOpen(true)}>
        <span className="plus">
          <Plus size={16} />
        </span>
        Add task
      </button>
    );
  return (
    <div className="inline-add-box">
      <Composer
        autoFocus
        defaults={defaultsFor(view)}
        onCancel={() => setOpen(false)}
        onDone={(t, keep) => {
          if (t) useStore.getState().select(t.id);
          if (!keep) setOpen(false);
        }}
      />
    </div>
  );
}

function Empty({ view }: { view: View }) {
  const content: Record<string, [JSX.Element, string, string]> = {
    inbox: [<Inbox size={30} />, "Inbox zero", "Everything is organized. Capture new tasks with ⌘N or the global shortcut."],
    today: [<Sun size={30} />, "Nothing planned for today", "Pull tasks in from your Inbox or plan your day with ⇧⌘P."],
    upcoming: [<CalendarRange size={30} />, "Nothing coming up", "Tasks with a future date will show up here."],
    someday: [<Archive size={30} />, "No someday tasks", "Park ideas here that you don't want to schedule yet."],
    done: [<CheckCircle2 size={30} />, "No completed tasks yet", "Completed tasks are kept here as your logbook."],
    project: [<Folder size={30} />, "This project is empty", "Add a task above, or type #project in quick add."],
    tag: [<Hash size={30} />, "No tasks with this tag", "Type @tag in quick add to tag a task."],
  };
  const [icon, title, body] = content[view.kind] ?? content.inbox;
  return (
    <div className="empty">
      <div className="art">{icon}</div>
      <h3>{title}</h3>
      <div>{body}</div>
    </div>
  );
}
