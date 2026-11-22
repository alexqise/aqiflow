import { ArrowLeft, ArrowRight, CalendarCheck, Plus, Sun, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { scheduleFor } from "../actions";
import { addDays, formatDuration, minutesOfDay, todayStr, weekdayName } from "../dates";
import { droppedTaskId, isTaskDrag } from "../dnd";
import { inboxTasks, isOverdue, sortTasks } from "../selectors";
import { useStore } from "../store";
import type { Task } from "../types";
import { DayRater } from "./DayRater";
import { TaskRow } from "./TaskRow";
import { TimeGrid } from "./TimeGrid";

/** Two-step daily planning ritual: recap yesterday, then plan today. */
export function PlanningMode() {
  const [step, setStep] = useState<1 | 2>(1);
  const close = () => useStore.getState().set({ planningOpen: false });
  const today = todayStr();
  const yesterday = addDays(today, -1);
  const day = step === 1 ? yesterday : today;

  return (
    <div className="planning" onKeyDown={(e) => e.key === "Escape" && close()} tabIndex={-1}>
      <aside className="plan-side">
        <button className="plan-back" onClick={close}>
          <ArrowLeft size={13} /> Back to Aqiflow
        </button>
        {step === 1 ? <RecapSide yesterday={yesterday} onNext={() => setStep(2)} /> : <PlanSide onBack={() => setStep(1)} onDone={close} />}
      </aside>

      <section className="panel plan-main">
        <header className="panel-header">
          <span className="plan-step">
            <Sun size={14} /> Daily Planning - {step}/2
          </span>
          <div className="grow" />
          <button className="icon-btn" onClick={close} title="Close (esc)">
            <X size={16} />
          </button>
        </header>
        {step === 1 ? <RecapList yesterday={yesterday} /> : <PlanList />}
      </section>

      <section className="panel plan-cal">
        <TimeGrid key={day} days={[day]} />
      </section>
    </div>
  );
}

/* ----------------------------------------------------------- step 1: recap */

function Card({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <div className="plan-card">
      <div className="plan-card-head">
        <span>{title}</span>
        {meta && <span className="meta">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function doneOn(tasks: Task[], date: string) {
  return tasks.filter((t) => t.done && t.doneAt?.slice(0, 10) === date);
}

function RecapSide({ yesterday, onNext }: { yesterday: string; onNext: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const events = useStore((s) => s.events);
  const before = addDays(yesterday, -1);
  const done = doneOn(tasks, yesterday);
  const prev = doneOn(tasks, before).length;
  const change = prev ? Math.round(((done.length - prev) / prev) * 100) : done.length ? 100 : 0;
  const minutes = done.reduce((m, t) => m + (t.duration || 0), 0);

  const byProject = new Map<string, number>();
  for (const t of done) byProject.set(t.projectId ?? "", (byProject.get(t.projectId ?? "") ?? 0) + (t.duration || 0));
  const rows = [...byProject.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const top = Math.max(1, ...rows.map((r) => r[1]));

  const evs = events.filter((e) => !e.allDay && e.start.slice(0, 10) === yesterday);
  const evMinutes = evs.reduce((m, e) => m + Math.max(0, minutesOfDay(e.end) - minutesOfDay(e.start)), 0);
  const circ = 2 * Math.PI * 30;
  const evShare = Math.min(1, evMinutes / (10 * 60));

  return (
    <>
      <h1>Yesterday’s Recap</h1>
      <p className="plan-sub">Reflect on your progress</p>

      <Card title="Tasks done yesterday">
        <div className="plan-big">
          <span>{done.length}</span>
          <span className="change">
            <b>{change > 0 ? "+" : ""}{change}%</b>
            From previous {weekdayName(before)}
          </span>
        </div>
      </Card>

      <Card title="Yesterday’s tasks" meta={formatDuration(minutes) || "0m"}>
        {rows.length ? (
          <div className="plan-bars">
            {rows.map(([pid, m]) => {
              const p = projects.find((x) => x.id === pid);
              return (
                <div key={pid} className="plan-bar">
                  <span className="name">{p?.name ?? "No project"}</span>
                  <span className="track">
                    <i style={{ width: `${(m / top) * 100}%`, background: p?.color ?? "var(--text-3)" }} />
                  </span>
                  <span className="m">{formatDuration(m) || "–"}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="plan-empty-card">Nothing finished yesterday</div>
        )}
      </Card>

      <Card title="Yesterday’s events" meta={formatDuration(evMinutes) || "0m"}>
        <div className="plan-events">
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="var(--chip)" strokeWidth="8" />
            {evShare > 0 && <circle
              cx="36"
              cy="36"
              r="30"
              fill="none"
              stroke="#e8955d"
              strokeWidth="8"
              strokeDasharray={`${circ * evShare} ${circ}`}
              transform="rotate(-90 36 36)"
              strokeLinecap="round"
            />}
            <text x="36" y="40" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)">
              {formatDuration(evMinutes) || "0m"}
            </text>
          </svg>
          <div className="plan-ev-list">
            {evs.slice(0, 3).map((e) => (
              <span key={e.id}>
                <i style={{ background: e.color }} />
                {e.title || "(No title)"}
              </span>
            ))}
            {!evs.length && <span className="hint">No meetings</span>}
          </div>
        </div>
      </Card>

      <div className="grow" />
      <Card title="Rate yesterday">
        <DayRater date={yesterday} noteButton />
      </Card>
      <button className="btn primary plan-next" onClick={onNext}>
        Next: Plan Today
      </button>
    </>
  );
}

function RecapList({ yesterday }: { yesterday: string }) {
  const tasks = useStore((s) => s.tasks);
  const [draft, setDraft] = useState("");
  const list = sortTasks(tasks.filter((t) => t.doneAt?.slice(0, 10) === yesterday || (t.date === yesterday && !t.done)));
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    const s = useStore.getState();
    const t = s.createTask({ title, date: yesterday });
    s.updateTask(t.id, { done: true, doneAt: `${yesterday}T18:00` });
    setDraft("");
  };
  return (
    <div className="plan-list">
      <h3>Yesterday</h3>
      <label className="add-bar plan-add">
        <Plus size={15} />
        <input placeholder="Add an achievement" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <kbd>↵</kbd>
      </label>
      {list.map((t) => (
        <TaskRow key={t.id} task={t} showDate={false} />
      ))}
      {!list.length && (
        <div className="plan-empty">
          <CalendarCheck size={22} />
          <b>Reflect and celebrate</b>
          <span>Add your achievements</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------- step 2: plan today */

function PlanSide({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const settings = useStore((s) => s.settings);
  const today = todayStr();
  const todays = tasks.filter((t) => !t.done && t.date === today);
  const planned = todays.reduce((m, t) => m + (t.duration || 0), 0);
  const capacity = (Number(settings.dailyGoalHours) || 6) * 60;
  const blocked = todays.filter((t) => t.start).length;
  const overdue = tasks.filter((t) => isOverdue(t, today));
  const pct = Math.min(100, (planned / capacity) * 100);

  return (
    <>
      <h1>Plan Today</h1>
      <p className="plan-sub">Pick what matters, then give it time</p>

      <Card title="Planned" meta={`${formatDuration(capacity)} capacity`}>
        <div className="plan-big">
          <span>{formatDuration(planned) || "0m"}</span>
          <span className="change">
            <b>{todays.length} tasks</b>
            {blocked} on the calendar
          </span>
        </div>
        <div className="plan-capacity">
          <i className={planned > capacity ? "over" : ""} style={{ width: `${pct}%` }} />
        </div>
        {planned > capacity && <p className="plan-warn">More than your daily capacity. Consider moving something to tomorrow.</p>}
      </Card>

      {overdue.length > 0 && (
        <Card title="Overdue" meta={overdue.length}>
          <button className="btn ghost sm" onClick={() => overdue.forEach((t) => scheduleFor(t, "today"))}>
            Move all to today
          </button>
        </Card>
      )}

      <div className="grow" />
      <div className="plan-foot">
        <button className="btn ghost" onClick={onBack}>
          Back
        </button>
        <button
          className="btn primary plan-next"
          onClick={() => {
            const s = useStore.getState();
            s.setSetting("lastPlanned", today);
            s.setView({ kind: "today" });
            onDone();
          }}
        >
          Start my day <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}

function DropSection({ title, count, patch, children }: { title: string; count: number; patch?: Partial<Task>; children: ReactNode }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`plan-section ${over ? "over" : ""}`}
      onDragOver={(e) => {
        if (!patch || !isTaskDrag(e)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = droppedTaskId(e);
        if (!id || !patch) return;
        e.preventDefault();
        useStore.getState().updateTask(id, patch);
      }}
    >
      <div className="section-label">
        <span>{title}</span>
        <span className="count-chip">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Pull({ task }: { task: Task }) {
  return (
    <div className="plan-row">
      <TaskRow task={task} />
      <button className="icon-btn" title="Do today" onClick={() => scheduleFor(task, "today")}>
        <Plus size={16} />
      </button>
    </div>
  );
}

function PlanList() {
  const tasks = useStore((s) => s.tasks);
  const today = todayStr();
  const todays = sortTasks(tasks.filter((t) => !t.done && t.date === today));
  const overdue = sortTasks(tasks.filter((t) => isOverdue(t, today)));
  const inbox = sortTasks(inboxTasks(tasks));
  const soon = sortTasks(tasks.filter((t) => !t.done && t.date && t.date > today && t.date <= addDays(today, 7)));
  return (
    <div className="plan-list">
      <h3>Plan today</h3>
      <DropSection title="Today" count={todays.length} patch={{ date: today, someday: false }}>
        {todays.map((t) => (
          <div key={t.id} className="plan-row">
            <TaskRow task={t} showDate={false} />
            <button className="icon-btn" title="Remove from today" onClick={() => scheduleFor(t, "none")}>
              <X size={14} />
            </button>
          </div>
        ))}
        {!todays.length && <div className="hint plan-hint">Drag tasks here, or press + on one below.</div>}
      </DropSection>
      {overdue.length > 0 && (
        <DropSection title="Overdue" count={overdue.length}>
          {overdue.map((t) => (
            <Pull key={t.id} task={t} />
          ))}
        </DropSection>
      )}
      <DropSection title="Inbox" count={inbox.length} patch={{ date: null, start: null, someday: false }}>
        {inbox.map((t) => (
          <Pull key={t.id} task={t} />
        ))}
      </DropSection>
      {soon.length > 0 && (
        <DropSection title="Next 7 days" count={soon.length}>
          {soon.map((t) => (
            <Pull key={t.id} task={t} />
          ))}
        </DropSection>
      )}
    </div>
  );
}
