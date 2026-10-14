import { useEffect } from "react";
import { scheduleFor, taskMenu } from "./actions";
import { api, onDataChanged } from "./api";
import { CalendarView, RightPanel } from "./components/CalendarViews";
import { CommandBar } from "./components/CommandBar";
import { DatePickerPopover } from "./components/DatePicker";
import { EventEditor } from "./components/EventEditor";
import { fmtClock, focusElapsed, FocusMode } from "./components/FocusMode";
import { ListView } from "./components/ListView";
import { PlanningMode } from "./components/PlanningMode";
import { ContextMenu, ShortcutsHelp, Toast } from "./components/Popups";
import { QuickAddModal } from "./components/QuickAdd";
import { SettingsModal } from "./components/Settings";
import { Sidebar } from "./components/Sidebar";
import { TaskDetail } from "./components/TaskDetail";
import { addDays, diffMinutes, minutesOfDay, setClock24, todayStr, toDateTimeStr } from "./dates";
import { shallow } from "zustand/shallow";
import { useStore } from "./store";
import type { View } from "./types";

export function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  const clock24 = useStore((s) => s.settings.clock24);
  setClock24(clock24 === "1");
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme !== "light" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}

const VIEW_KEYS: Record<string, View> = {
  i: { kind: "inbox" },
  t: { kind: "today" },
  u: { kind: "upcoming" },
  c: { kind: "calendar" },
  s: { kind: "someday" },
  d: { kind: "done" },
};
const NUMBERED_VIEWS: View[] = [
  { kind: "inbox" },
  { kind: "today" },
  { kind: "upcoming" },
  { kind: "calendar" },
  { kind: "someday" },
  { kind: "done" },
];

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

function useKeyboard() {
  useEffect(() => {
    let gPending = 0;
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();

      if (e.key === "Escape") {
        if (s.menu) return s.set({ menu: null });
        if (s.datePicker) return s.set({ datePicker: null });
        if (s.eventEditor) return s.set({ eventEditor: null });
        if (s.detailId) return s.openDetail(null);
        if (s.commandOpen) return s.set({ commandOpen: false });
        if (s.quickAdd.open) return s.set({ quickAdd: { open: false } });
        if (s.settingsOpen) return s.set({ settingsOpen: false });
        if (s.shortcutsOpen) return s.set({ shortcutsOpen: false });
        if (s.focus) return s.set({ focus: null });
        if (s.planningOpen) return s.set({ planningOpen: false });
        if (s.selectedId) return s.select(null);
        return;
      }

      // Shortcuts that work everywhere, even while typing.
      if (mod && k === "k") {
        e.preventDefault();
        return s.set({ commandOpen: !s.commandOpen });
      }
      if (isTyping(e)) return;
      if (mod && k === "z" && !e.shiftKey) {
        if (s.toast?.undo) {
          e.preventDefault();
          s.toast.undo();
          s.set({ toast: null });
        }
        return;
      }
      if (mod && e.shiftKey && k === "p") {
        e.preventDefault();
        return s.set({ planningOpen: true });
      }
      if (mod && e.key === "\\") {
        e.preventDefault();
        return s.set({ rightPanel: !s.rightPanel });
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        return s.set({ settingsOpen: true });
      }
      if (mod && k === "n") {
        e.preventDefault();
        return s.set({ quickAdd: { open: true } });
      }
      if (mod && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        return s.setView(NUMBERED_VIEWS[Number(e.key) - 1]);
      }

      const overlay = s.commandOpen || s.quickAdd.open || s.detailId || s.eventEditor || s.settingsOpen || s.shortcutsOpen || s.focus || s.menu || s.datePicker;
      if (overlay) return;

      const sel = s.tasks.find((t) => t.id === s.selectedId);

      if (mod && k === "d" && sel) {
        e.preventDefault();
        return s.duplicateTask(sel.id);
      }
      if (mod || e.altKey) return;

      // g-prefixed navigation.
      if (gPending && Date.now() - gPending < 1200) {
        gPending = 0;
        if (k === "g" && sel) return s.updateTask(sel.id, { priority: sel.priority === 4 ? 0 : 4 });
        const v = VIEW_KEYS[k];
        if (v) return s.setView(v);
        return;
      }

      if (s.view.kind === "calendar" && !s.planningOpen) {
        const step = s.calMode === "day" ? 1 : s.calMode === "3day" ? 3 : 7;
        if (e.key === "[") return s.set({ calDate: addDays(s.calDate, -step) });
        if (e.key === "]") return s.set({ calDate: addDays(s.calDate, step) });
        if (e.key === ".") return s.set({ calDate: todayStr() });
        if (k === "d" && !sel) return s.set({ calMode: "day" });
        if (k === "w" && !sel) return s.set({ calMode: "week" });
      }

      if (k === "g") {
        gPending = Date.now();
        return;
      }
      if (k === "n") {
        e.preventDefault();
        return s.set({ quickAdd: { open: true } });
      }
      if (e.key === "/") {
        e.preventDefault();
        return s.set({ commandOpen: true });
      }
      if (e.key === "?") return s.set({ shortcutsOpen: true });

      if (["j", "k", "arrowdown", "arrowup"].includes(k)) {
        e.preventDefault();
        const scope = s.planningOpen ? ".planning" : ".main";
        const rows = [...document.querySelectorAll<HTMLElement>(`${scope} .task-row[data-task-id]`)];
        if (!rows.length) return;
        const ids = rows.map((r) => r.dataset.taskId!);
        const i = sel ? ids.indexOf(sel.id) : -1;
        const next = k === "j" || k === "arrowdown" ? Math.min(ids.length - 1, i + 1) : Math.max(0, i - 1);
        s.select(ids[next]);
        rows[next].scrollIntoView({ block: "nearest" });
        return;
      }

      if (!sel) return;
      switch (k) {
        case "enter":
          e.preventDefault();
          return s.openDetail(sel.id);
        case "e":
        case "x":
          return s.toggleDone(sel.id);
        case "t":
          return scheduleFor(sel, "today");
        case "m":
          return scheduleFor(sel, "tomorrow");
        case "z":
          return scheduleFor(sel, "someday");
        case "f":
          return s.startFocus(sel.id);
        case "s": {
          const el = document.querySelector<HTMLElement>(`.task-row[data-task-id="${sel.id}"]`);
          const r = el?.getBoundingClientRect();
          return s.set({ datePicker: { taskId: sel.id, x: r ? r.right - 280 : 300, y: r ? r.bottom + 4 : 160 } });
        }
        case "1":
          return s.updateTask(sel.id, { priority: 3 });
        case "2":
          return s.updateTask(sel.id, { priority: 2 });
        case "3":
          return s.updateTask(sel.id, { priority: 1 });
        case "0":
          return s.updateTask(sel.id, { priority: 0 });
        case "backspace":
        case "delete":
          e.preventDefault();
          return s.deleteTasks([sel.id]);
        case "contextmenu": {
          const el = document.querySelector<HTMLElement>(`.task-row[data-task-id="${sel.id}"]`);
          const r = el?.getBoundingClientRect();
          return s.openMenu(r?.left ?? 200, r?.bottom ?? 200, taskMenu(sel));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Keeps the menu bar title in sync: running focus timer, or the next thing on the calendar. */
function useTrayTitle() {
  useEffect(() => {
    let last: string | null | undefined;
    const update = () => {
      const s = useStore.getState();
      let title: string | null = null;
      const clip = (t: string) => (t.length > 24 ? t.slice(0, 23) + "…" : t);
      if (s.focus) {
        const t = s.tasks.find((x) => x.id === s.focus!.taskId);
        if (t) title = `◉ ${fmtClock((t.duration || 25) * 60_000 - focusElapsed(s.focus))} ${clip(t.title)}`;
      } else {
        const now = toDateTimeStr(new Date());
        const today = todayStr();
        const items = [
          ...s.events.filter((e) => !e.allDay && e.start.slice(0, 10) === today).map((e) => ({ title: e.title, start: e.start, end: e.end })),
          ...s.tasks
            .filter((t) => !t.done && t.start?.slice(0, 10) === today)
            .map((t) => ({ title: t.title, start: t.start!, end: toDateTimeStr(new Date(new Date(t.start!).getTime() + (t.duration || 30) * 60000)) })),
        ].sort((a, b) => a.start.localeCompare(b.start));
        const current = items.find((i) => i.start <= now && i.end > now);
        const next = items.find((i) => i.start > now);
        if (current) title = `${clip(current.title)} · ${diffMinutes(now, current.end)}m left`;
        else if (next && minutesOfDay(next.start) - minutesOfDay(now) <= 120) title = `${clip(next.title)} in ${diffMinutes(now, next.start)}m`;
      }
      if (title !== last) {
        last = title;
        api.setTrayTitle(title).catch(() => {});
      }
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
}

export function App() {
  const loaded = useStore((s) => s.loaded);
  const view = useStore((s) => s.view);
  const rightPanel = useStore((s) => s.rightPanel);
  const o = useStore((s) => ({
    command: s.commandOpen,
    quick: s.quickAdd.open,
    detail: !!s.detailId,
    event: !!s.eventEditor,
    planning: s.planningOpen,
    focus: !!s.focus,
    settings: s.settingsOpen,
    shortcuts: s.shortcutsOpen,
  }), shallow);
  useTheme();
  useKeyboard();
  useTrayTitle();

  useEffect(() => {
    let un: (() => void) | undefined;
    onDataChanged((source) => {
      if (source !== "main") useStore.getState().load();
    }).then((u) => (un = u));
    return () => un?.();
  }, []);

  if (!loaded) return null;
  const showPanel = rightPanel && view.kind !== "calendar";

  return (
    <>
      <div className="app" style={showPanel ? undefined : { gridTemplateColumns: "var(--sidebar-w) minmax(0, 1fr)" }}>
        <Sidebar />
        {view.kind === "calendar" ? <CalendarView /> : <ListView />}
        {showPanel && <RightPanel />}
      </div>
      {o.planning && <PlanningMode />}
      {o.focus && <FocusMode />}
      {o.detail && <TaskDetail />}
      {o.event && <EventEditor />}
      {o.command && <CommandBar />}
      {o.quick && <QuickAddModal />}
      {o.settings && <SettingsModal />}
      {o.shortcuts && <ShortcutsHelp />}
      <DatePickerPopover />
      <ContextMenu />
      <Toast />
    </>
  );
}
