import { addDays, startOfWeek, todayStr } from "./dates";
import { MenuItem, useStore } from "./store";
import type { Task } from "./types";

const st = () => useStore.getState();

export function scheduleFor(task: Task, when: "today" | "tomorrow" | "nextweek" | "someday" | "none") {
  const today = todayStr();
  const weekStart = Number(st().settings.weekStartsOn ?? 1);
  const keepTime = (date: string) => (task.start ? `${date}T${task.start.slice(11)}` : null);
  switch (when) {
    case "today":
      return st().updateTask(task.id, { date: today, start: keepTime(today), someday: false });
    case "tomorrow": {
      const d = addDays(today, 1);
      return st().updateTask(task.id, { date: d, start: keepTime(d), someday: false });
    }
    case "nextweek": {
      const d = addDays(startOfWeek(today, weekStart), 7);
      return st().updateTask(task.id, { date: d, start: null, someday: false });
    }
    case "someday":
      return st().updateTask(task.id, { date: null, start: null, someday: true });
    case "none":
      return st().updateTask(task.id, { date: null, start: null, someday: false });
  }
}

export function taskMenu(task: Task, pos?: { x: number; y: number }): MenuItem[] {
  const s = st();
  return [
    { label: task.done ? "Mark as not done" : "Complete", icon: "check", shortcut: "E", onSelect: () => s.toggleDone(task.id) },
    { label: "Open", icon: "open", shortcut: "↵", onSelect: () => s.openDetail(task.id) },
    { label: "Start focus", icon: "focus", shortcut: "F", onSelect: () => s.startFocus(task.id) },
    { separator: true },
    { label: "Do today", icon: "today", shortcut: "T", onSelect: () => scheduleFor(task, "today") },
    { label: "Do tomorrow", icon: "tomorrow", shortcut: "M", onSelect: () => scheduleFor(task, "tomorrow") },
    {
      label: "Schedule…",
      icon: "calendar",
      shortcut: "S",
      onSelect: () => s.set({ datePicker: { taskId: task.id, x: pos?.x ?? window.innerWidth / 2 - 134, y: pos?.y ?? 160 } }),
    },
    { label: "Move to Someday", icon: "someday", onSelect: () => scheduleFor(task, "someday") },
    ...(task.start ? [{ label: "Remove from calendar", icon: "unschedule", onSelect: () => s.updateTask(task.id, { start: null }) }] : []),
    ...(task.date || task.someday ? [{ label: "Move to Inbox", icon: "inbox", onSelect: () => scheduleFor(task, "none") }] : []),
    { separator: true },
    { label: "Duplicate", icon: "copy", shortcut: "⌘D", onSelect: () => s.duplicateTask(task.id) },
    { label: "Delete", icon: "trash", shortcut: "⌫", danger: true, onSelect: () => s.deleteTasks([task.id]) },
  ];
}
