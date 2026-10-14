import type React from "react";
import { Calendar, Database, Folder, Keyboard, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useState } from "react";
import { api, isTauri } from "../api";
import { PALETTE, useStore } from "../store";
import type { AppData } from "../types";

type Tab = "general" | "calendar" | "shortcuts" | "projects" | "data";

export function SettingsModal() {
  const [tab, setTab] = useState<Tab>("general");
  const close = () => useStore.getState().set({ settingsOpen: false });
  const tabs: [Tab, string, JSX.Element][] = [
    ["general", "General", <SlidersHorizontal size={15} />],
    ["calendar", "Calendar", <Calendar size={15} />],
    ["shortcuts", "Shortcuts", <Keyboard size={15} />],
    ["projects", "Projects & tags", <Folder size={15} />],
    ["data", "Data", <Database size={15} />],
  ];
  return (
    <div className="overlay" onMouseDown={close} onKeyDown={(e) => e.key === "Escape" && close()}>
      <div className="modal settings" onMouseDown={(e) => e.stopPropagation()}>
        <nav>
          <h3>Settings</h3>
          {tabs.map(([id, label, icon]) => (
            <button key={id} className={`nav-item ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              {icon}
              <span className="label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="pane">
          <div style={{ display: "flex", alignItems: "center" }}>
            <h4 style={{ flex: 1 }}>{tabs.find((t) => t[0] === tab)![1]}</h4>
            <button className="icon-btn" onClick={close} style={{ marginTop: -14 }}>
              <X size={16} />
            </button>
          </div>
          {tab === "general" && <General />}
          {tab === "calendar" && <CalendarPrefs />}
          {tab === "shortcuts" && <Shortcuts />}
          {tab === "projects" && <ProjectsTags />}
          {tab === "data" && <DataPane />}
        </div>
      </div>
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="set-row">
      <div className="txt">
        <div>{title}</div>
        {desc && <div>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function Select({ k, options }: { k: string; options: [string, string][] }) {
  const v = useStore((s) => s.settings[k]);
  return (
    <select className="select" value={v} onChange={(e) => useStore.getState().setSetting(k, e.target.value)}>
      {options.map(([val, label]) => (
        <option key={val} value={val}>
          {label}
        </option>
      ))}
    </select>
  );
}

const hourOpts = Array.from({ length: 24 }, (_, h) => [String(h), `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`] as [string, string]);

function General() {
  return (
    <>
      <Row title="Appearance" desc="Follow macOS, or force light or dark.">
        <Select k="theme" options={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} />
      </Row>
      <Row title="Default task duration" desc="Used when a task has no estimate.">
        <Select k="defaultDuration" options={[["15", "15 min"], ["30", "30 min"], ["45", "45 min"], ["60", "1 hour"]]} />
      </Row>
      <Row title="Daily capacity" desc="How many hours of tasks you aim to plan per day.">
        <Select k="dailyGoalHours" options={["3", "4", "5", "6", "7", "8", "10"].map((h) => [h, `${h} hours`])} />
      </Row>
      <Row title="Show completed tasks in Today">
        <Select k="showCompletedToday" options={[["1", "Show"], ["0", "Hide"]]} />
      </Row>
    </>
  );
}

function CalendarPrefs() {
  return (
    <>
      <Row title="Week starts on">
        <Select k="weekStartsOn" options={[["0", "Sunday"], ["1", "Monday"], ["6", "Saturday"]]} />
      </Row>
      <Row title="Working hours start">
        <Select k="workStart" options={hourOpts} />
      </Row>
      <Row title="Working hours end">
        <Select k="workEnd" options={hourOpts} />
      </Row>
      <Row title="Time format">
        <Select k="clock24" options={[["0", "12-hour (3:00 PM)"], ["1", "24-hour (15:00)"]]} />
      </Row>
      <Row title="Calendar zoom" desc="Height of one hour in the calendar.">
        <Select k="hourHeight" options={[["40", "Compact"], ["56", "Default"], ["72", "Comfortable"], ["96", "Large"]]} />
      </Row>
    </>
  );
}

const KEY_NAMES: Record<string, string> = { Space: "Space", Enter: "Enter", Backquote: "`", Minus: "-", Equal: "=", Comma: ",", Period: ".", Slash: "/", Semicolon: ";", Quote: "'", BracketLeft: "[", BracketRight: "]", Backslash: "\\" };

function toAccelerator(e: React.KeyboardEvent): string | null {
  let key: string | null = null;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
  else if (/^F\d{1,2}$/.test(e.code)) key = e.code;
  else key = KEY_NAMES[e.code] ?? null;
  if (!key) return null;
  const mods = [e.metaKey && "CommandOrControl", e.ctrlKey && "Control", e.altKey && "Alt", e.shiftKey && "Shift"].filter(Boolean);
  if (!mods.length) return null;
  return [...mods, key].join("+");
}

const pretty = (accel: string) =>
  accel
    .replace("CommandOrControl", "⌘")
    .replace("Control", "⌃")
    .replace("Alt", "⌥")
    .replace("Shift", "⇧")
    .split("+");

function Shortcuts() {
  const current = useStore((s) => s.settings.quickShortcut);
  const [rec, setRec] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Row title="Global quick add" desc="Capture a task from anywhere in macOS, even when Aqiflow is in the background.">
        <button
          className={`shortcut-cap ${rec ? "rec" : ""}`}
          onClick={() => {
            setRec(true);
            setError("");
          }}
          onBlur={() => setRec(false)}
          onKeyDown={async (e) => {
            if (!rec) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.key === "Escape") return setRec(false);
            const accel = toAccelerator(e);
            if (!accel) return;
            setRec(false);
            try {
              if (isTauri) await api.setQuickShortcut(accel);
              useStore.getState().set({ settings: { ...useStore.getState().settings, quickShortcut: accel } });
              if (!isTauri) useStore.getState().setSetting("quickShortcut", accel);
            } catch (err) {
              setError(`Couldn't register ${pretty(accel).join("")}: ${err}`);
            }
          }}
        >
          {rec ? "Press shortcut…" : pretty(current).map((k, i) => <kbd key={i}>{k}</kbd>)}
        </button>
      </Row>
      {error && <div style={{ color: "var(--danger)", fontSize: 12, padding: "6px 0" }}>{error}</div>}
      <p className="hint" style={{ marginTop: 16 }}>
        In-app shortcuts are listed under Help → Keyboard shortcuts (press ?).
      </p>
    </>
  );
}

function ProjectsTags() {
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const s = useStore.getState();
  return (
    <>
      <div className="section-head" style={{ padding: "0 0 4px" }}>Projects</div>
      {projects.map((p) => (
        <div className="list-edit" key={p.id}>
          <input className="input" defaultValue={p.name} onBlur={(e) => e.target.value.trim() && s.updateProject({ ...p, name: e.target.value.trim() })} />
          <div className="swatches">
            {PALETTE.map((c) => (
              <button key={c} className={`swatch ${p.color === c ? "on" : ""}`} style={{ background: c }} onClick={() => s.updateProject({ ...p, color: c })} />
            ))}
          </div>
          <button className="icon-btn" onClick={() => confirm(`Delete project “${p.name}”?`) && s.deleteProject(p.id)}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button className="btn" style={{ margin: "6px 0 22px" }} onClick={() => s.addProject("New project")}>
        Add project
      </button>
      <div className="section-head" style={{ padding: "0 0 4px" }}>Tags</div>
      {tags.map((t) => (
        <div className="list-edit" key={t.id}>
          <input className="input" defaultValue={t.name} onBlur={(e) => e.target.value.trim() && s.updateTag({ ...t, name: e.target.value.trim() })} />
          <div className="swatches">
            {PALETTE.map((c) => (
              <button key={c} className={`swatch ${t.color === c ? "on" : ""}`} style={{ background: c }} onClick={() => s.updateTag({ ...t, color: c })} />
            ))}
          </div>
          <button className="icon-btn" onClick={() => s.deleteTag(t.id)}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button className="btn" style={{ marginTop: 6 }} onClick={() => s.addTag("new-tag")}>
        Add tag
      </button>
    </>
  );
}

function DataPane() {
  const [json, setJson] = useState("");
  const [msg, setMsg] = useState("");
  const st = useStore();
  const exportData = async () => {
    const data: AppData = { tasks: st.tasks, projects: st.projects, tags: st.tags, events: st.events, settings: st.settings };
    const text = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setMsg(`Copied ${st.tasks.length} tasks, ${st.events.length} events to the clipboard.`);
    } catch {
      setJson(text);
      setMsg("Clipboard unavailable — copy the JSON below.");
    }
  };
  const importData = async () => {
    try {
      const d = JSON.parse(json) as AppData;
      if (!Array.isArray(d.tasks)) throw new Error("missing tasks array");
      await api.saveTasks(d.tasks);
      for (const p of d.projects ?? []) await api.saveProject(p);
      for (const t of d.tags ?? []) await api.saveTag(t);
      for (const e of d.events ?? []) await api.saveEvent(e);
      await useStore.getState().load();
      setMsg(`Imported ${d.tasks.length} tasks.`);
      setJson("");
    } catch (e) {
      setMsg(`Import failed: ${e}`);
    }
  };
  return (
    <>
      <Row title="Export" desc="Copy all your tasks, projects, tags and events as JSON.">
        <button className="btn" onClick={exportData}>
          Copy JSON
        </button>
      </Row>
      <div style={{ padding: "14px 0" }}>
        <div style={{ fontWeight: 550, marginBottom: 6 }}>Import</div>
        <textarea className="input" style={{ height: 120, padding: 8, fontFamily: "var(--mono)", fontSize: 11 }} placeholder="Paste exported JSON…" value={json} onChange={(e) => setJson(e.target.value)} />
        <button className="btn" style={{ marginTop: 8 }} disabled={!json.trim()} onClick={importData}>
          Import (merges by id)
        </button>
      </div>
      {msg && <div className="hint">{msg}</div>}
      <p className="hint" style={{ marginTop: 18 }}>
        Your data lives locally in a SQLite database in ~/Library/Application Support/com.aqiflow.app.
      </p>
    </>
  );
}
