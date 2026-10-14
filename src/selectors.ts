import { addDays, longDate, relativeDay, todayStr } from "./dates";
import type { Project, Tag, Task, View } from "./types";

export interface Section {
  id: string;
  title: string;
  subtitle?: string;
  tasks: Task[];
  /** Patch applied to a task dropped into / created in this section. */
  dropPatch?: Partial<Task>;
  collapsible?: boolean;
  tone?: "danger" | "muted";
}

export const isOverdue = (t: Task, today = todayStr()) => !t.done && !!t.date && t.date < today;

export function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    if (a.start && b.start) return a.start.localeCompare(b.start);
    if (a.start) return -1;
    if (b.start) return 1;
    return a.sortOrder - b.sortOrder;
  });
}

const byDoneAtDesc = (a: Task, b: Task) => (b.doneAt ?? "").localeCompare(a.doneAt ?? "");

export const inboxTasks = (tasks: Task[]) => tasks.filter((t) => !t.done && !t.date && !t.someday);

export function viewTitle(view: View, projects: Project[], tags: Tag[]): string {
  switch (view.kind) {
    case "inbox":
      return "Inbox";
    case "today":
      return "Today";
    case "upcoming":
      return "Upcoming";
    case "someday":
      return "Someday";
    case "done":
      return "Done";
    case "calendar":
      return "Calendar";
    case "project":
      return projects.find((p) => p.id === view.id)?.name ?? "Project";
    case "tag":
      return "#" + (tags.find((t) => t.id === view.id)?.name ?? "tag");
  }
}

export function sectionsFor(view: View, tasks: Task[], showCompletedToday: boolean): Section[] {
  const today = todayStr();
  switch (view.kind) {
    case "inbox":
      return [{ id: "inbox", title: "", tasks: sortTasks(inboxTasks(tasks)), dropPatch: { date: null, start: null, someday: false } }];

    case "today": {
      const overdue = tasks.filter((t) => isOverdue(t, today));
      const todays = tasks.filter((t) => !t.done && t.date === today);
      const done = tasks.filter((t) => t.done && (t.doneAt ? t.doneAt.slice(0, 10) === today || t.date === today : false));
      const out: Section[] = [];
      if (overdue.length)
        out.push({ id: "overdue", title: "Overdue", tasks: sortTasks(overdue), tone: "danger", collapsible: true });
      out.push({ id: "today", title: overdue.length ? "Today" : "", tasks: sortTasks(todays), dropPatch: { date: today } });
      if (showCompletedToday && done.length)
        out.push({ id: "done-today", title: "Completed", tasks: done.sort(byDoneAtDesc), tone: "muted", collapsible: true });
      return out;
    }

    case "upcoming": {
      const out: Section[] = [];
      for (let i = 1; i <= 14; i++) {
        const d = addDays(today, i);
        out.push({
          id: d,
          title: relativeDay(d),
          subtitle: longDate(d),
          tasks: sortTasks(tasks.filter((t) => !t.done && t.date === d)),
          dropPatch: { date: d, start: null },
        });
      }
      const later = tasks.filter((t) => !t.done && t.date && t.date > addDays(today, 14));
      if (later.length)
        out.push({ id: "later", title: "Later", tasks: [...later].sort((a, b) => a.date!.localeCompare(b.date!)) });
      return out;
    }

    case "someday":
      return [{ id: "someday", title: "", tasks: sortTasks(tasks.filter((t) => !t.done && t.someday)), dropPatch: { someday: true, date: null, start: null } }];

    case "done": {
      const done = tasks.filter((t) => t.done).sort(byDoneAtDesc);
      const groups = new Map<string, Task[]>();
      for (const t of done) {
        const d = (t.doneAt ?? t.updatedAt).slice(0, 10);
        groups.set(d, [...(groups.get(d) ?? []), t]);
      }
      return [...groups.entries()].map(([d, list]) => ({ id: d, title: relativeDay(d), subtitle: longDate(d), tasks: list }));
    }

    case "project":
    case "tag": {
      const match = (t: Task) => (view.kind === "project" ? t.projectId === view.id : t.tags.includes(view.id));
      const mine = tasks.filter(match);
      const open = mine.filter((t) => !t.done);
      const base: Partial<Task> = view.kind === "project" ? { projectId: view.id } : {};
      return [
        { id: "scheduled", title: "Scheduled", tasks: open.filter((t) => t.date).sort((a, b) => a.date!.localeCompare(b.date!) || (a.start ?? "").localeCompare(b.start ?? "")) },
        { id: "unscheduled", title: "Unscheduled", tasks: sortTasks(open.filter((t) => !t.date && !t.someday)), dropPatch: { ...base, date: null, start: null, someday: false } },
        { id: "someday", title: "Someday", tasks: sortTasks(open.filter((t) => t.someday)), dropPatch: { ...base, someday: true, date: null }, collapsible: true },
        { id: "done", title: "Completed", tasks: mine.filter((t) => t.done).sort(byDoneAtDesc), tone: "muted", collapsible: true },
      ].filter((s) => s.tasks.length || s.id === "unscheduled") as Section[];
    }

    case "calendar":
      return [];
  }
}

export function countFor(view: View, tasks: Task[]): number {
  const today = todayStr();
  switch (view.kind) {
    case "inbox":
      return inboxTasks(tasks).length;
    case "today":
      return tasks.filter((t) => !t.done && t.date && t.date <= today).length;
    case "upcoming":
      return tasks.filter((t) => !t.done && t.date && t.date > today).length;
    case "someday":
      return tasks.filter((t) => !t.done && t.someday).length;
    case "project":
      return tasks.filter((t) => !t.done && t.projectId === view.id).length;
    case "tag":
      return tasks.filter((t) => !t.done && t.tags.includes(view.id)).length;
    default:
      return 0;
  }
}

/** Defaults for a task created while looking at `view`. */
export function defaultsFor(view: View): Partial<Task> {
  switch (view.kind) {
    case "today":
      return { date: todayStr() };
    case "upcoming":
      return { date: addDays(todayStr(), 1) };
    case "someday":
      return { someday: true };
    case "project":
      return { projectId: view.id };
    case "tag":
      return { tags: [view.id] };
    default:
      return {};
  }
}

export const sameView = (a: View, b: View) =>
  a.kind === b.kind && (a as { id?: string }).id === (b as { id?: string }).id;

export function plannedMinutes(tasks: Task[], date: string) {
  return tasks.filter((t) => t.date === date && !t.done).reduce((m, t) => m + (t.duration || 0), 0);
}
