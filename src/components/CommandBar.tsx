import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { scheduleFor } from "../actions";
import { relativeDay, todayStr } from "../dates";
import { useStore } from "../store";
import type { Task, View } from "../types";
import { Keys } from "./common";
import { MenuIcon } from "./icons";

interface Cmd {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon?: string;
  color?: string;
  shortcut?: string;
  keywords?: string;
  run: () => void;
}

function score(text: string, q: string): number {
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t.startsWith(q)) return 3;
  if (t.includes(" " + q)) return 2.5;
  if (t.includes(q)) return 2;
  // Subsequence fuzzy match.
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  return i === q.length ? 1 : 0;
}

export function CommandBar() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const s = useStore.getState();
  const tasks = useStore((st) => st.tasks);
  const projects = useStore((st) => st.projects);
  const tags = useStore((st) => st.tags);
  const selected = useStore((st) => st.tasks.find((t) => t.id === st.selectedId) ?? null);
  const close = () => s.set({ commandOpen: false });
  const go = (v: View) => () => s.setView(v);

  const cmds = useMemo(() => {
    const list: Cmd[] = [];
    if (selected) {
      const t = selected;
      list.push(
        { id: "t-done", group: "Selected task", label: t.done ? "Mark as not done" : "Complete task", icon: "check", shortcut: "E", run: () => s.toggleDone(t.id) },
        { id: "t-today", group: "Selected task", label: "Do today", icon: "today", shortcut: "T", run: () => scheduleFor(t, "today") },
        { id: "t-tomorrow", group: "Selected task", label: "Do tomorrow", icon: "tomorrow", shortcut: "M", run: () => scheduleFor(t, "tomorrow") },
        { id: "t-nextweek", group: "Selected task", label: "Do next week", icon: "upcoming", run: () => scheduleFor(t, "nextweek") },
        { id: "t-someday", group: "Selected task", label: "Move to Someday", icon: "someday", run: () => scheduleFor(t, "someday") },
        { id: "t-focus", group: "Selected task", label: "Start focus session", icon: "focus", shortcut: "F", run: () => s.startFocus(t.id) },
        { id: "t-open", group: "Selected task", label: "Open task", icon: "open", shortcut: "↵", run: () => s.openDetail(t.id) },
        { id: "t-dup", group: "Selected task", label: "Duplicate task", icon: "copy", run: () => s.duplicateTask(t.id) },
        { id: "t-del", group: "Selected task", label: "Delete task", icon: "trash", shortcut: "⌫", run: () => s.deleteTasks([t.id]) },
        ...projects.map((p) => ({
          id: "t-proj-" + p.id,
          group: "Selected task",
          label: `Move to project: ${p.name}`,
          icon: "project",
          color: p.color,
          run: () => s.updateTask(t.id, { projectId: p.id }),
        })),
      );
    }
    list.push(
      { id: "new", group: "Create", label: "New task", icon: "plus", shortcut: "N", run: () => s.set({ quickAdd: { open: true } }) },
      { id: "new-event", group: "Create", label: "New event", icon: "event", run: () => s.setView({ kind: "calendar" }) },
      { id: "plan", group: "Create", label: "Plan my day", icon: "plan", shortcut: "⇧⌘P", keywords: "daily planning ritual", run: () => s.set({ planningOpen: true }) },
      { id: "nav-inbox", group: "Navigate", label: "Go to Inbox", icon: "inbox", shortcut: "G I", run: go({ kind: "inbox" }) },
      { id: "nav-today", group: "Navigate", label: "Go to Today", icon: "today", shortcut: "G T", run: go({ kind: "today" }) },
      { id: "nav-upcoming", group: "Navigate", label: "Go to Upcoming", icon: "upcoming", shortcut: "G U", run: go({ kind: "upcoming" }) },
      { id: "nav-cal", group: "Navigate", label: "Go to Calendar", icon: "calendar", shortcut: "G C", run: go({ kind: "calendar" }) },
      { id: "nav-someday", group: "Navigate", label: "Go to Someday", icon: "someday", shortcut: "G S", run: go({ kind: "someday" }) },
      { id: "nav-done", group: "Navigate", label: "Go to Done", icon: "done", shortcut: "G D", run: go({ kind: "done" }) },
      { id: "nav-ratings", group: "Navigate", label: "Go to Day ratings", icon: "rating", shortcut: "G R", keywords: "mood score year pixels", run: go({ kind: "ratings" }) },
      ...projects.map((p) => ({ id: "p-" + p.id, group: "Navigate", label: p.name, hint: "Project", icon: "project", color: p.color, run: go({ kind: "project", id: p.id }) })),
      ...tags.map((t) => ({ id: "tg-" + t.id, group: "Navigate", label: "#" + t.name, hint: "Tag", icon: "tag", color: t.color, run: go({ kind: "tag", id: t.id }) })),
      { id: "panel", group: "App", label: "Toggle calendar panel", icon: "panel", shortcut: "⌘\\", run: () => s.set({ rightPanel: !s.rightPanel }) },
      {
        id: "theme",
        group: "App",
        label: "Toggle dark mode",
        icon: "theme",
        keywords: "theme light dark appearance",
        run: () => s.setSetting("theme", document.documentElement.dataset.theme === "dark" ? "light" : "dark"),
      },
      { id: "settings", group: "App", label: "Settings", icon: "settings", shortcut: "⌘,", keywords: "preferences", run: () => s.set({ settingsOpen: true }) },
      { id: "shortcuts", group: "App", label: "Keyboard shortcuts", icon: "keyboard", shortcut: "?", run: () => s.set({ shortcutsOpen: true }) },
    );
    return list;
  }, [selected, projects, tags]);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    const scored = cmds
      .map((c) => ({ c, sc: Math.max(score(c.label, query), score(c.keywords ?? "", query) * 0.8) }))
      .filter((x) => x.sc > 0);
    if (query) scored.sort((a, b) => b.sc - a.sc);
    let out = scored.map((x) => x.c);
    if (!query) out = out.filter((c) => c.group !== "Navigate" || c.id.startsWith("nav-"));

    if (query) {
      const matches: Task[] = tasks
        .filter((t) => score(t.title, query) >= 2 || t.notes.toLowerCase().includes(query))
        .sort((a, b) => Number(a.done) - Number(b.done) || score(b.title, query) - score(a.title, query))
        .slice(0, 8);
      const taskCmds: Cmd[] = matches.map((t) => ({
        id: "task-" + t.id,
        group: "Tasks",
        label: t.title,
        hint: t.done ? "Done" : t.date ? relativeDay(t.date) : t.someday ? "Someday" : "Inbox",
        icon: t.done ? "done" : "open",
        run: () => {
          const v: View = t.done ? { kind: "done" } : t.someday ? { kind: "someday" } : !t.date ? { kind: "inbox" } : t.date <= todayStr() ? { kind: "today" } : { kind: "upcoming" };
          s.setView(v);
          s.openDetail(t.id);
        },
      }));
      const create: Cmd = { id: "create", group: "Create", label: `Create task “${q.trim()}”`, icon: "plus", run: () => s.set({ quickAdd: { open: true, defaults: { title: q.trim() } } }) };
      out = [...out.slice(0, 6), ...taskCmds, create, ...out.slice(6)];
    }
    return out;
  }, [cmds, query, tasks]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(".cmd-item.active")?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (c: Cmd | undefined) => {
    if (!c) return;
    close();
    c.run();
  };

  let lastGroup = "";
  return (
    <div className="overlay" onMouseDown={close}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmd-input">
          <Search size={18} />
          <input
            autoFocus
            placeholder={selected ? `Do something with “${selected.title.slice(0, 40)}”…` : "Search tasks, run a command…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(results[active]);
              } else if (e.key === "Escape") {
                close();
              }
            }}
          />
        </div>
        <div className="cmd-list" ref={listRef}>
          {results.map((c, i) => {
            const head = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {head && <div className="cmd-group">{head}</div>}
                <button className={`cmd-item ${i === active ? "active" : ""}`} onMouseMove={() => setActive(i)} onClick={() => run(c)}>
                  {c.color ? <span className="nav-dot" style={{ background: c.color, margin: "0 2px" }} /> : <MenuIcon name={c.icon} size={16} />}
                  <span className="label">
                    {c.label} {c.hint && <em>· {c.hint}</em>}
                  </span>
                  {c.shortcut && (
                    <span style={{ display: "flex", gap: 2 }}>
                      <Keys keys={c.shortcut} />
                    </span>
                  )}
                </button>
              </div>
            );
          })}
          {!results.length && <div className="hint" style={{ padding: 16 }}>No results</div>}
        </div>
        <div className="cmd-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> run
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
