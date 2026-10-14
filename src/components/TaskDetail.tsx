import { CalendarDays, Clock, Copy, Folder, Hash, Plus, Repeat, Target, Trash2, X, Flag, CalendarClock, ChevronUp, ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatDuration, formatTime, longDate, RECURRENCE_LABELS, relativeDay, todayStr } from "../dates";
import { sectionsFor } from "../selectors";
import { uid, useStore } from "../store";
import type { Task } from "../types";
import { Checkbox, PRIORITIES, PriorityFlag } from "./common";
import { DatePickerPanel } from "./DatePicker";

const DURATIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];

export function TaskDetail() {
  const task = useStore((s) => s.tasks.find((t) => t.id === s.detailId));
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  const [pickDate, setPickDate] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");

  useEffect(() => {
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
    setPickDate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [title]);

  if (!task) return null;
  const s = useStore.getState();
  const update = (p: Partial<Task>) => s.updateTask(task.id, p);
  const close = () => {
    if (title !== task.title) update({ title: title.trim() || task.title });
    if (notes !== task.notes) update({ notes });
    s.openDetail(null);
  };

  // ↑/↓ arrows in the toolbar walk through the current list.
  const siblings = sectionsFor(s.view, s.tasks, true).flatMap((sec) => sec.tasks);
  const idx = siblings.findIndex((t) => t.id === task.id);
  const step = (d: number) => {
    const next = siblings[idx + d];
    if (!next) return;
    if (title !== task.title) update({ title: title.trim() || task.title });
    if (notes !== task.notes) update({ notes });
    s.openDetail(next.id);
  };

  const project = projects.find((p) => p.id === task.projectId);
  const whenLabel = task.someday
    ? "Someday"
    : task.date
      ? `${relativeDay(task.date)}${task.start ? ` · ${formatTime(task.start)}` : ""}`
      : "No date";

  return (
    <div className="overlay" onMouseDown={close}>
      <div className="modal detail" onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), close())}>
        <div className="detail-top">
          <button className="icon-btn" disabled={idx <= 0} onClick={() => step(-1)} title="Previous task">
            <ChevronUp size={16} />
          </button>
          <button className="icon-btn" disabled={idx < 0 || idx >= siblings.length - 1} onClick={() => step(1)} title="Next task">
            <ChevronDown size={16} />
          </button>
          <span style={{ marginLeft: 6 }}>
            {project ? (
              <span className="chip">
                <span className="dot" style={{ background: project.color }} /> {project.name}
              </span>
            ) : (
              <span className="chip">Inbox</span>
            )}
          </span>
          <div className="grow" />
          <button className="btn ghost" onClick={() => (close(), s.startFocus(task.id))}>
            <Target size={14} /> Focus
          </button>
          <button className="icon-btn" title="Duplicate" onClick={() => s.duplicateTask(task.id)}>
            <Copy size={15} />
          </button>
          <button className="icon-btn" title="Delete" onClick={() => s.deleteTasks([task.id])}>
            <Trash2 size={15} />
          </button>
          <button className="icon-btn" title="Close (esc)" onClick={close}>
            <X size={16} />
          </button>
        </div>
        <div className="detail-body">
          <div className="detail-main">
            <div className="detail-title">
              <Checkbox task={task} onToggle={() => s.toggleDone(task.id)} />
              <textarea
                ref={titleRef}
                rows={1}
                value={title}
                placeholder="Task name"
                onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
                onBlur={() => title.trim() && title !== task.title && update({ title: title.trim() })}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLTextAreaElement).blur();
                  }
                  if (e.key === "Escape") close();
                }}
              />
            </div>
            <textarea
              className="detail-notes"
              placeholder="Add notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== task.notes && update({ notes })}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Escape") close();
              }}
            />
            <Subtasks task={task} />
          </div>
          <div className="detail-side">
            <div className="field">
              <label>When</label>
              <button className={`field-btn ${task.date || task.someday ? "" : "placeholder"}`} onClick={() => setPickDate(!pickDate)}>
                <CalendarDays size={14} /> {whenLabel}
              </button>
              {pickDate && (
                <div className="popover" style={{ position: "relative", padding: 0, marginTop: 4, animation: "none" }}>
                  <DatePickerPanel
                    value={task}
                    onChange={(v) => {
                      update(v);
                      setPickDate(false);
                    }}
                  />
                </div>
              )}
            </div>
            <div className="field">
              <label>Time block</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="time"
                  value={task.start ? task.start.slice(11) : ""}
                  step={900}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return update({ start: null });
                    const date = task.date ?? todayStr();
                    update({ start: `${date}T${v}` });
                  }}
                />
                {task.start && (
                  <button className="icon-btn sm" title="Remove from calendar" onClick={() => update({ start: null })}>
                    <X size={13} />
                  </button>
                )}
              </div>
              {task.start && task.date && <span className="hint" style={{ paddingLeft: 2 }}>{longDate(task.date)}</span>}
            </div>
            <div className="field">
              <label>
                <Clock size={11} style={{ verticalAlign: -1 }} /> Duration
              </label>
              <select value={task.duration} onChange={(e) => update({ duration: Number(e.target.value) })}>
                {[...new Set([...DURATIONS, task.duration])].sort((a, b) => a - b).map((d) => (
                  <option key={d} value={d}>
                    {d ? formatDuration(d) : "None"}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>
                <Flag size={11} style={{ verticalAlign: -1 }} /> Priority
              </label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <PriorityFlag priority={task.priority} size={14} />
                <select value={task.priority} onChange={(e) => update({ priority: Number(e.target.value) })}>
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>
                <Folder size={11} style={{ verticalAlign: -1 }} /> Project
              </label>
              <select value={task.projectId ?? ""} onChange={(e) => update({ projectId: e.target.value || null })}>
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>
                <Hash size={11} style={{ verticalAlign: -1 }} /> Tags
              </label>
              <div className="tag-pills">
                {tags.map((t) => {
                  const on = task.tags.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      className="chip"
                      style={on ? { background: `color-mix(in srgb, ${t.color} 18%, transparent)`, color: t.color } : { opacity: 0.7 }}
                      onClick={() => update({ tags: on ? task.tags.filter((x) => x !== t.id) : [...task.tags, t.id] })}
                    >
                      #{t.name}
                    </button>
                  );
                })}
                <button
                  className="chip"
                  onClick={() => {
                    const n = prompt("New tag name");
                    if (n?.trim()) update({ tags: [...task.tags, s.addTag(n.trim().replace(/^[#@]/, "")).id] });
                  }}
                >
                  <Plus size={11} />
                </button>
              </div>
            </div>
            <div className="field">
              <label>
                <Repeat size={11} style={{ verticalAlign: -1 }} /> Repeat
              </label>
              <select value={task.recurrence ?? ""} onChange={(e) => update({ recurrence: e.target.value || null })}>
                <option value="">Never</option>
                {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="hint" style={{ padding: "12px 6px 0", lineHeight: 1.6 }}>
              <CalendarClock size={11} style={{ verticalAlign: -1 }} /> Created {relativeDay(task.createdAt.slice(0, 10))}
              {task.done && task.doneAt && (
                <>
                  <br />
                  Completed {relativeDay(task.doneAt.slice(0, 10))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Subtasks({ task }: { task: Task }) {
  const [draft, setDraft] = useState("");
  const update = (subtasks: Task["subtasks"]) => useStore.getState().updateTask(task.id, { subtasks });
  return (
    <div className="subtasks">
      {task.subtasks.map((st) => (
        <div key={st.id} className={`subtask ${st.done ? "done" : ""}`}>
          <button
            className={`checkbox ${st.done ? "checked" : ""}`}
            onClick={() => update(task.subtasks.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)))}
          >
            ✓
          </button>
          <input
            defaultValue={st.title}
            onBlur={(e) => update(task.subtasks.map((x) => (x.id === st.id ? { ...x, title: e.target.value } : x)))}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Backspace" && !(e.target as HTMLInputElement).value) update(task.subtasks.filter((x) => x.id !== st.id));
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </div>
      ))}
      <div className="subtask">
        <Plus size={15} color="var(--text-3)" />
        <input
          placeholder="Add subtask"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && draft.trim()) {
              update([...task.subtasks, { id: uid(), title: draft.trim(), done: false }]);
              setDraft("");
            }
          }}
        />
      </div>
    </div>
  );
}

