import type React from "react";
import { CheckCircle2, ChevronDown, CirclePlus, Hourglass, Inbox, SlidersHorizontal, Sun, Archive, CalendarRange, Hash, Folder, LayoutList } from "lucide-react";
import { useState } from "react";
import { addDays, formatDuration, relativeDay, todayStr } from "../dates";
import { droppedTaskId, isTaskDrag } from "../dnd";
import { defaultsFor, plannedMinutes, sectionsFor, viewTitle, type Section } from "../selectors";
import { useStore, type MenuItem } from "../store";
import type { Task, View } from "../types";
import { Composer } from "./Composer";
import { DayRater } from "./DayRater";
import { TaskRow } from "./TaskRow";

export function ListView() {
  const view = useStore((s) => s.view);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const showCompleted = useStore((s) => s.settings.showCompletedToday !== "0");
  const sections = sectionsFor(view, tasks, showCompleted, projects);
  const total = sections.reduce((n, s) => n + s.tasks.filter((t) => !t.done).length, 0);
  const today = todayStr();

  const s = useStore.getState;

  // Title dropdown: jump between lists, like a view switcher.
  const pickView = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const st = s();
    const go = (v: View) => () => st.setView(v);
    st.openMenu(r.left, r.bottom + 4, [
      { label: "Inbox", icon: "inbox", shortcut: "1", onSelect: go({ kind: "inbox" }) },
      { label: "Today", icon: "today", shortcut: "2", onSelect: go({ kind: "today" }) },
      { label: "Upcoming", icon: "upcoming", onSelect: go({ kind: "upcoming" }) },
      { label: "Someday", icon: "someday", onSelect: go({ kind: "someday" }) },
      { label: "All tasks", icon: "done", onSelect: go({ kind: "tasks" }) },
      { label: "Done", icon: "check", onSelect: go({ kind: "done" }) },
      ...(projects.length ? [{ separator: true }] : []),
      ...projects.map((p) => ({ label: p.name, icon: "project", onSelect: go({ kind: "project", id: p.id }) })),
      ...(tags.length ? [{ separator: true }] : []),
      ...tags.map((t) => ({ label: "#" + t.name, icon: "tag", onSelect: go({ kind: "tag", id: t.id }) })),
    ]);
  };

  const options = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const st = s();
    st.openMenu(r.right - 220, r.bottom + 4, [
      { label: "Plan my day", icon: "plan", shortcut: "⇧⌘P", onSelect: () => st.set({ planningOpen: true }) },
      {
        label: showCompleted ? "Hide completed tasks" : "Show completed tasks",
        icon: "done",
        onSelect: () => st.setSetting("showCompletedToday", showCompleted ? "0" : "1"),
      },
      { label: "Hide task list", icon: "panel", shortcut: "⌘\\", onSelect: () => st.set({ listHidden: true }) },
    ]);
  };

  const planned = view.kind === "today" ? plannedMinutes(tasks, today) : 0;
  const project = view.kind === "project" ? projects.find((p) => p.id === view.id) : null;

  return (
    <section className="panel task-panel">
      <header className="panel-header" data-tauri-drag-region>
        <button className="panel-title-btn" onClick={pickView}>
          {project && <span className="dot" style={{ background: project.color }} />}
          <span className="panel-title">{viewTitle(view, projects, tags)}</span>
          <ChevronDown size={15} />
        </button>
        <div className="grow" data-tauri-drag-region />
        {view.kind === "today" && <DayRater date={today} compact />}
        <button className="icon-btn" title={view.kind === "today" && planned ? `${formatDuration(planned)} planned · options` : "List options"} onClick={options}>
          <SlidersHorizontal size={16} />
        </button>
      </header>
      {view.kind !== "done" && <InlineAdd view={view} />}
      <div className="list-scroll">
        <Sections sections={sections} view={view} />
        {total === 0 && sections.every((sec) => !sec.tasks.length) && <Empty view={view} />}
      </div>
    </section>
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
          {section.color && <span className="dot" style={{ background: section.color }} />}
          <span className="section-label">{section.title}</span>
          {section.tasks.length > 0 && <span className="count-chip">{section.tasks.length}</span>}
          {section.subtitle && section.subtitle !== section.title && <span className="sub">{section.subtitle}</span>}
          {section.collapsible && <ChevronDown size={13} className={`chev ${closed ? "closed" : ""}`} />}
          <span className="meta">{section.tasks.length > 0 && section.tone !== "muted" && minutes > 0 && formatDuration(minutes)}</span>
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

const DURATIONS = [0, 5, 10, 15, 30, 45, 60, 90, 120];

/** "Add new task" bar that expands in place, with date / duration / project chips. */
function InlineAdd({ view }: { view: View }) {
  const open = useStore((s) => s.addBarOpen);
  const projects = useStore((s) => s.projects);
  const defaultDuration = useStore((s) => Number(s.settings.defaultDuration) || 30);
  const [over, setOver] = useState<Partial<Task>>({});
  const st = useStore.getState;
  const setOpen = (v: boolean) => {
    st().set({ addBarOpen: v });
    if (!v) setOver({});
  };

  if (!open)
    return (
      <button className="add-bar" onClick={() => setOpen(true)}>
        <CirclePlus size={16} />
        <span className="add-bar-text">Add new task</span>
        <kbd>C</kbd>
      </button>
    );

  const defaults = { ...defaultsFor(view), ...over };
  const today = todayStr();
  const dateLabel = defaults.someday ? "Someday" : defaults.date ? relativeDay(defaults.date) : "No date";
  const duration = defaults.duration ?? defaultDuration;
  const project = projects.find((p) => p.id === defaults.projectId);

  const menuAt = (e: React.MouseEvent, items: MenuItem[]) => {
    const r = e.currentTarget.getBoundingClientRect();
    st().openMenu(r.left, r.bottom + 4, items);
  };

  return (
    <div className="add-bar-open">
      <div className="add-row">
        <CirclePlus size={16} className="add-plus" />
        <Composer
          autoFocus
          placeholder="Task title"
          defaults={defaults}
          onCancel={() => setOpen(false)}
          onDone={(t, keep) => {
            if (t) st().select(t.id);
            if (!keep) setOpen(false);
          }}
        />
        <button
          className="add-chip"
          title="When"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) =>
            menuAt(e, [
              { label: "Today", icon: "today", onSelect: () => setOver({ ...over, date: today, someday: false }) },
              { label: "Tomorrow", icon: "tomorrow", onSelect: () => setOver({ ...over, date: addDays(today, 1), someday: false }) },
              { label: "Someday", icon: "someday", onSelect: () => setOver({ ...over, date: null, someday: true }) },
              { label: "No date", icon: "inbox", onSelect: () => setOver({ ...over, date: null, someday: false }) },
            ])
          }
        >
          {dateLabel.length > 3 && dateLabel !== "Someday" && dateLabel !== "No date" ? dateLabel.slice(0, 3) : dateLabel}
        </button>
        <button
          className="add-chip icon"
          title={`Duration: ${formatDuration(duration) || "none"}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) =>
            menuAt(
              e,
              DURATIONS.map((d) => ({ label: d ? formatDuration(d) : "No estimate", icon: d === duration ? "check" : undefined, onSelect: () => setOver({ ...over, duration: d }) })),
            )
          }
        >
          {over.duration !== undefined ? formatDuration(duration) || <Hourglass size={12} /> : <Hourglass size={12} />}
        </button>
        <button
          className="add-chip icon"
          title={project ? `Project: ${project.name}` : "Project"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) =>
            menuAt(e, [
              { label: "No project", icon: !project ? "check" : undefined, onSelect: () => setOver({ ...over, projectId: null }) },
              ...projects.map((p) => ({ label: p.name, icon: p.id === project?.id ? "check" : "project", onSelect: () => setOver({ ...over, projectId: p.id }) })),
            ])
          }
        >
          {project ? <span className="dot" style={{ background: project.color }} /> : <Hash size={12} />}
        </button>
      </div>
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
    tasks: [<LayoutList size={30} />, "No open tasks", "Everything is done. Add a task above."],
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
