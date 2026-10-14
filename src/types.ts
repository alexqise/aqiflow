export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  done: boolean;
  doneAt: string | null;
  /** Local date `YYYY-MM-DD`. */
  date: string | null;
  /** Local datetime `YYYY-MM-DDTHH:mm` when time-blocked on the calendar. */
  start: string | null;
  /** Minutes. 0 = unestimated. */
  duration: number;
  /** 0 none · 1 low · 2 medium · 3 high · 4 goal */
  priority: number;
  projectId: string | null;
  tags: string[];
  sortOrder: number;
  someday: boolean;
  /** daily · weekdays · weekly · biweekly · monthly · yearly */
  recurrence: string | null;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  notes: string;
  location: string;
}

export type Settings = Record<string, string>;

export interface AppData {
  tasks: Task[];
  projects: Project[];
  tags: Tag[];
  events: CalEvent[];
  settings: Settings;
}

export type View =
  | { kind: "inbox" }
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "someday" }
  | { kind: "done" }
  | { kind: "calendar" }
  | { kind: "project"; id: string }
  | { kind: "tag"; id: string };

export type CalendarMode = "day" | "3day" | "week";
