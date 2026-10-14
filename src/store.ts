import { create } from "zustand";
import { api } from "./api";
import { addDays, addMinutes, diffDays, nextOccurrence, nowStr, todayStr, toDateStr, toDateTimeStr } from "./dates";
import type { CalEvent, CalendarMode, Project, Settings, Tag, Task, View } from "./types";

export const PALETTE = [
  "#6F5BF5", "#F2545B", "#F59E0B", "#10B981", "#3B82F6",
  "#EC4899", "#8B5CF6", "#14B8A6", "#64748B", "#EAB308",
];

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  weekStartsOn: "1",
  workStart: "9",
  workEnd: "18",
  defaultDuration: "30",
  clock24: "0",
  hourHeight: "56",
  quickShortcut: "CommandOrControl+Shift+Space",
  showCompletedToday: "1",
  dailyGoalHours: "6",
};

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export interface MenuItem {
  label?: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  separator?: boolean;
  onSelect?: () => void;
}

interface Toast {
  id: number;
  message: string;
  undo?: () => void;
}

interface State {
  loaded: boolean;
  tasks: Task[];
  projects: Project[];
  tags: Tag[];
  events: CalEvent[];
  settings: Settings;

  view: View;
  selectedId: string | null;
  detailId: string | null;
  eventEditor: { event: CalEvent; isNew: boolean } | null;
  commandOpen: boolean;
  quickAdd: { open: boolean; defaults?: Partial<Task> };
  planningOpen: boolean;
  focus: { taskId: string; startedAt: number; pausedAt: number | null; elapsedBefore: number } | null;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  rightPanel: boolean;
  calDate: string;
  calMode: CalendarMode;
  panelDate: string;
  toast: Toast | null;
  menu: { x: number; y: number; items: MenuItem[] } | null;
  datePicker: { taskId: string; x: number; y: number } | null;

  load: (opts?: { seed?: boolean }) => Promise<void>;
  setView: (v: View) => void;
  select: (id: string | null) => void;
  openDetail: (id: string | null) => void;
  set: (patch: Partial<State>) => void;

  createTask: (t: Partial<Task>) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  updateTasks: (patches: [string, Partial<Task>][]) => void;
  toggleDone: (id: string) => void;
  deleteTasks: (ids: string[]) => void;
  duplicateTask: (id: string) => void;

  addProject: (name: string, color?: string) => Project;
  updateProject: (p: Project) => void;
  deleteProject: (id: string) => void;
  addTag: (name: string) => Tag;
  updateTag: (t: Tag) => void;
  deleteTag: (id: string) => void;

  saveEvent: (e: CalEvent) => void;
  deleteEvent: (id: string) => void;

  setSetting: (key: string, value: string) => void;
  showToast: (message: string, undo?: () => void) => void;
  openMenu: (x: number, y: number, items: MenuItem[]) => void;

  startFocus: (taskId: string) => void;
}

let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<State>((set, get) => {
  const persist = (tasks: Task[]) => {
    api.saveTasks(tasks).catch((e) => get().showToast(`Couldn't save: ${e}`));
  };

  const blankTask = (t: Partial<Task>): Task => {
    const now = nowStr();
    const minOrder = get().tasks.reduce((m, x) => Math.min(m, x.sortOrder), 0);
    return {
      id: uid(),
      title: "",
      notes: "",
      done: false,
      doneAt: null,
      date: null,
      start: null,
      duration: Number(get().settings.defaultDuration) || 30,
      priority: 0,
      projectId: null,
      tags: [],
      sortOrder: minOrder - 1,
      someday: false,
      recurrence: null,
      subtasks: [],
      createdAt: now,
      updatedAt: now,
      ...t,
    };
  };

  // Keeps `date` consistent with `start`, and clears someday once scheduled.
  const normalize = (t: Task): Task => {
    if (t.start) t.date = t.start.slice(0, 10);
    if (t.date) t.someday = false;
    return t;
  };

  return {
    loaded: false,
    tasks: [],
    projects: [],
    tags: [],
    events: [],
    settings: { ...DEFAULT_SETTINGS },

    view: { kind: "today" },
    selectedId: null,
    detailId: null,
    eventEditor: null,
    commandOpen: false,
    quickAdd: { open: false },
    planningOpen: false,
    focus: null,
    settingsOpen: false,
    shortcutsOpen: false,
    rightPanel: true,
    calDate: todayStr(),
    calMode: "week",
    panelDate: todayStr(),
    toast: null,
    menu: null,
    datePicker: null,

    load: async (opts) => {
      const data = await api.loadAll();
      set({
        loaded: true,
        tasks: data.tasks,
        projects: data.projects,
        tags: data.tags,
        events: data.events,
        settings: { ...DEFAULT_SETTINGS, ...data.settings },
      });
      if (opts?.seed && !data.settings.seeded) await seed(get);
    },

    setView: (view) => set({ view, selectedId: null }),
    select: (selectedId) => set({ selectedId }),
    openDetail: (detailId) => set({ detailId, selectedId: detailId ?? get().selectedId }),
    set: (patch) => set(patch),

    createTask: (partial) => {
      const t = normalize(blankTask(partial));
      set({ tasks: [...get().tasks, t] });
      persist([t]);
      return t;
    },

    updateTask: (id, patch) => get().updateTasks([[id, patch]]),

    updateTasks: (patches) => {
      const byId = new Map(patches);
      const changed: Task[] = [];
      const tasks = get().tasks.map((t) => {
        const p = byId.get(t.id);
        if (!p) return t;
        const next = normalize({ ...t, ...p, updatedAt: nowStr() });
        changed.push(next);
        return next;
      });
      set({ tasks });
      if (changed.length) persist(changed);
    },

    toggleDone: (id) => {
      const t = get().tasks.find((x) => x.id === id);
      if (!t) return;
      if (t.done) {
        get().updateTask(id, { done: false, doneAt: null });
        return;
      }
      const before = { ...t };
      let spawned: Task | null = null;
      if (t.recurrence) {
        const base = t.date ?? todayStr();
        const nextDate = nextOccurrence(base, t.recurrence);
        const shift = diffDays(base, nextDate);
        spawned = get().createTask({
          ...t,
          id: uid(),
          done: false,
          doneAt: null,
          date: nextDate,
          start: t.start ? addMinutes(t.start, shift * 1440) : null,
          subtasks: t.subtasks.map((s) => ({ ...s, done: false })),
          createdAt: nowStr(),
        });
      }
      get().updateTask(id, { done: true, doneAt: toDateTimeStr(new Date()) });
      get().showToast(spawned ? "Completed — next one scheduled" : "Task completed", () => {
        get().updateTask(id, { done: before.done, doneAt: before.doneAt });
        if (spawned) get().deleteTasks([spawned.id]);
      });
    },

    deleteTasks: (ids) => {
      const removed = get().tasks.filter((t) => ids.includes(t.id));
      set({
        tasks: get().tasks.filter((t) => !ids.includes(t.id)),
        selectedId: ids.includes(get().selectedId ?? "") ? null : get().selectedId,
        detailId: ids.includes(get().detailId ?? "") ? null : get().detailId,
      });
      api.deleteTasks(ids);
      if (removed.length)
        get().showToast(removed.length === 1 ? "Task deleted" : `${removed.length} tasks deleted`, () => {
          set({ tasks: [...get().tasks, ...removed] });
          persist(removed);
        });
    },

    duplicateTask: (id) => {
      const t = get().tasks.find((x) => x.id === id);
      if (!t) return;
      const copy = get().createTask({ ...t, id: uid(), title: t.title, sortOrder: t.sortOrder + 0.001, createdAt: nowStr() });
      set({ selectedId: copy.id });
    },

    addProject: (name, color) => {
      const p: Project = {
        id: uid(),
        name: name.trim(),
        color: color ?? PALETTE[get().projects.length % PALETTE.length],
        sortOrder: get().projects.length,
      };
      set({ projects: [...get().projects, p] });
      api.saveProject(p);
      return p;
    },
    updateProject: (p) => {
      set({ projects: get().projects.map((x) => (x.id === p.id ? p : x)) });
      api.saveProject(p);
    },
    deleteProject: (id) => {
      set({
        projects: get().projects.filter((p) => p.id !== id),
        tasks: get().tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
        view: get().view.kind === "project" && (get().view as { id: string }).id === id ? { kind: "inbox" } : get().view,
      });
      api.deleteProject(id);
    },

    addTag: (name) => {
      const t: Tag = { id: uid(), name: name.trim(), color: PALETTE[(get().tags.length + 3) % PALETTE.length] };
      set({ tags: [...get().tags, t] });
      api.saveTag(t);
      return t;
    },
    updateTag: (t) => {
      set({ tags: get().tags.map((x) => (x.id === t.id ? t : x)) });
      api.saveTag(t);
    },
    deleteTag: (id) => {
      set({
        tags: get().tags.filter((t) => t.id !== id),
        tasks: get().tasks.map((t) => (t.tags.includes(id) ? { ...t, tags: t.tags.filter((x) => x !== id) } : t)),
      });
      api.deleteTag(id);
    },

    saveEvent: (e) => {
      const exists = get().events.some((x) => x.id === e.id);
      set({ events: exists ? get().events.map((x) => (x.id === e.id ? e : x)) : [...get().events, e] });
      api.saveEvent(e);
    },
    deleteEvent: (id) => {
      const removed = get().events.find((e) => e.id === id);
      set({ events: get().events.filter((e) => e.id !== id), eventEditor: null });
      api.deleteEvent(id);
      if (removed) get().showToast("Event deleted", () => get().saveEvent(removed));
    },

    setSetting: (key, value) => {
      set({ settings: { ...get().settings, [key]: value } });
      api.setSetting(key, value);
    },

    showToast: (message, undo) => {
      clearTimeout(toastTimer);
      const id = ++toastSeq;
      set({ toast: { id, message, undo } });
      toastTimer = setTimeout(() => get().toast?.id === id && set({ toast: null }), 5000);
    },

    openMenu: (x, y, items) => set({ menu: { x, y, items } }),

    startFocus: (taskId) => set({ focus: { taskId, startedAt: Date.now(), pausedAt: null, elapsedBefore: 0 } }),
  };
});

async function seed(get: () => State) {
  const s = get();
  const today = todayStr();
  const work = s.addProject("Work", PALETTE[0]);
  const personal = s.addProject("Personal", PALETTE[3]);
  const deep = s.addTag("deep-work");
  s.addTag("quick-win");
  const at = (h: number, m = 0) => `${today}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const tasks: Partial<Task>[] = [
    { title: "Welcome to Aqiflow 👋", notes: "Your tasks and calendar in one place. Press ⌘K to do anything.", date: today, priority: 4 },
    { title: "Drag a task onto the calendar to time-block it", date: today, duration: 30, projectId: work.id },
    { title: "Write the weekly update", start: at(10), duration: 60, projectId: work.id, tags: [deep.id], priority: 3 },
    { title: "Try quick add: “Call mom tomorrow at 6pm for 20m #personal”", date: today, projectId: personal.id },
    { title: "Plan the day with ⇧⌘P", date: today, recurrence: "weekdays", duration: 15 },
    { title: "Review pull requests", projectId: work.id, duration: 45, priority: 2 },
    { title: "Book dentist appointment", projectId: personal.id, duration: 10 },
    { title: "Read “Deep Work”", someday: true, projectId: personal.id },
    { title: "Prepare quarterly planning doc", date: addDays(today, 2), projectId: work.id, duration: 90, tags: [deep.id] },
  ];
  tasks.forEach((t, i) => s.createTask({ ...t, sortOrder: i }));
  s.saveEvent({ id: uid(), title: "Team standup", start: at(9, 30), end: at(9, 45), allDay: false, color: PALETTE[4], notes: "", location: "Zoom" });
  s.saveEvent({ id: uid(), title: "Lunch", start: at(12, 30), end: at(13, 30), allDay: false, color: PALETTE[3], notes: "", location: "" });
  s.saveEvent({
    id: uid(),
    title: "1:1 with Sam",
    start: `${addDays(today, 1)}T15:00`,
    end: `${addDays(today, 1)}T15:30`,
    allDay: false,
    color: PALETTE[1],
    notes: "",
    location: "",
  });
  s.setSetting("seeded", toDateStr(new Date()));
}
