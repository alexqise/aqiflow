import type { AppData, CalEvent, Project, Tag, Task } from "./types";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let invokeImpl: Invoke | null = null;
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!invokeImpl) {
    if (isTauri) {
      const core = await import("@tauri-apps/api/core");
      invokeImpl = core.invoke as Invoke;
    } else {
      invokeImpl = browserInvoke as Invoke;
    }
  }
  return invokeImpl<T>(cmd, args);
}

export const api = {
  loadAll: () => invoke<AppData>("load_all"),
  saveTasks: (tasks: Task[]) => invoke<void>("save_tasks", { tasks }),
  deleteTasks: (ids: string[]) => invoke<void>("delete_tasks", { ids }),
  saveProject: (project: Project) => invoke<void>("save_project", { project }),
  deleteProject: (id: string) => invoke<void>("delete_project", { id }),
  saveTag: (tag: Tag) => invoke<void>("save_tag", { tag }),
  deleteTag: (id: string) => invoke<void>("delete_tag", { id }),
  saveEvent: (event: CalEvent) => invoke<void>("save_event", { event }),
  deleteEvent: (id: string) => invoke<void>("delete_event", { id }),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),
  setQuickShortcut: (accelerator: string) => invoke<void>("set_quick_shortcut", { accelerator }),
  setTrayTitle: (title: string | null) => (isTauri ? invoke<void>("set_tray_title", { title }) : Promise.resolve()),
  hideQuick: () => (isTauri ? invoke<void>("hide_quick") : Promise.resolve()),
  showMain: () => (isTauri ? invoke<void>("show_main") : Promise.resolve()),
};

export async function onDataChanged(cb: (source: string) => void): Promise<() => void> {
  if (!isTauri) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen<string>("data-changed", (e) => cb(e.payload));
}

export async function windowLabel(): Promise<string> {
  if (!isTauri) return new URLSearchParams(location.search).get("window") ?? "main";
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().label;
}

// ---------------------------------------------------------------------------
// Browser fallback (plain `vite` dev without Tauri): persists to localStorage.

const LS_KEY = "aqiflow-data";
function readLS(): AppData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { tasks: [], projects: [], tags: [], events: [], settings: {} };
}
function writeLS(d: AppData) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(d));
  } catch {}
}

async function browserInvoke(cmd: string, args: Record<string, any> = {}): Promise<unknown> {
  const d = readLS();
  const upsert = <T extends { id: string }>(list: T[], item: T) => {
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = item;
    else list.push(item);
  };
  switch (cmd) {
    case "load_all":
      return d;
    case "save_tasks":
      for (const t of args.tasks) upsert(d.tasks, t);
      break;
    case "delete_tasks":
      d.tasks = d.tasks.filter((t) => !args.ids.includes(t.id));
      break;
    case "save_project":
      upsert(d.projects, args.project);
      break;
    case "delete_project":
      d.projects = d.projects.filter((p) => p.id !== args.id);
      d.tasks.forEach((t) => t.projectId === args.id && (t.projectId = null));
      break;
    case "save_tag":
      upsert(d.tags, args.tag);
      break;
    case "delete_tag":
      d.tags = d.tags.filter((t) => t.id !== args.id);
      d.tasks.forEach((t) => (t.tags = t.tags.filter((x) => x !== args.id)));
      break;
    case "save_event":
      upsert(d.events, args.event);
      break;
    case "delete_event":
      d.events = d.events.filter((e) => e.id !== args.id);
      break;
    case "set_setting":
      d.settings[args.key] = args.value;
      break;
    default:
      return null;
  }
  writeLS(d);
  return null;
}
