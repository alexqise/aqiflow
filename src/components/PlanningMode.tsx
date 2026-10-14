import { Archive, ArrowRight, Check, ChevronLeft, Plus, Sun, Sunrise, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { scheduleFor } from "../actions";
import { addDays, formatDuration, longDate, todayStr } from "../dates";
import { droppedTaskId, isTaskDrag } from "../dnd";
import { inboxTasks, isOverdue, sortTasks } from "../selectors";
import { useStore } from "../store";
import type { Task } from "../types";
import { TaskRow } from "./TaskRow";
import { TimeGrid } from "./TimeGrid";

const STEPS = ["Review", "Choose", "Time-block", "Ready"];

export function PlanningMode() {
  const tasks = useStore((s) => s.tasks);
  const settings = useStore((s) => s.settings);
  const today = todayStr();
  const overdue = sortTasks(tasks.filter((t) => isOverdue(t, today)));
  const [step, setStep] = useState(overdue.length ? 0 : 1);
  const close = () => useStore.getState().set({ planningOpen: false });

  const todays = sortTasks(tasks.filter((t) => !t.done && t.date === today));
  const planned = todays.reduce((m, t) => m + (t.duration || 0), 0);
  const capacity = (Number(settings.dailyGoalHours) || 6) * 60;
  const blocked = todays.filter((t) => t.start).length;

  return (
    <div className="planning" onKeyDown={(e) => e.key === "Escape" && close()} tabIndex={-1}>
      <div className="planning-head drag" data-tauri-drag-region>
        <h2 data-tauri-drag-region>Plan your day</h2>
        <span className="hint" data-tauri-drag-region>
          {longDate(today)}
        </span>
        <div className="steps">
          {STEPS.map((s, i) => (
            <span key={s} style={{ display: "contents" }}>
              {i > 0 && <span className="step-line" />}
              <button className={`step ${i === step ? "on" : ""} ${i < step ? "complete" : ""}`} onClick={() => setStep(i)}>
                <span className="n">{i < step ? <Check size={11} strokeWidth={3} /> : i + 1}</span>
                {s}
              </button>
            </span>
          ))}
        </div>
        <button className="icon-btn" onClick={close} title="Close (esc)">
          <X size={17} />
        </button>
      </div>

      <div className="planning-body">
        {step === 0 && <ReviewStep overdue={overdue} />}
        {step === 1 && <ChooseStep todays={todays} planned={planned} capacity={capacity} />}
        {step === 2 && <BlockStep todays={todays} />}
        {step === 3 && (
          <div className="plan-done">
            <div className="big">☀️</div>
            <h3>You're all set</h3>
            <p>
              {todays.length} task{todays.length === 1 ? "" : "s"} planned · {formatDuration(planned) || "0m"} estimated · {blocked} on your calendar.
              {planned > capacity && " That's more than your daily capacity — consider moving something to tomorrow."}
            </p>
            <button
              className="btn primary"
              style={{ height: 38, padding: "0 20px", fontSize: 14 }}
              onClick={() => {
                const s = useStore.getState();
                s.setSetting("lastPlanned", today);
                s.setView({ kind: "today" });
                close();
              }}
            >
              Start my day <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>

      {step < 3 && (
        <div className="planning-foot">
          {step > 0 && (
            <button className="btn ghost" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={15} /> Back
            </button>
          )}
          <div className="grow" />
          <span className="hint" style={{ marginRight: 8 }}>
            {formatDuration(planned) || "0m"} of {formatDuration(capacity)} planned
          </span>
          <button className="btn primary" onClick={() => setStep(step + 1)}>
            {step === 0 && overdue.length ? "Continue" : "Next"} <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function ActionRow({ task, children }: { task: Task; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <TaskRow task={task} />
      </div>
      <div style={{ display: "flex", gap: 2 }}>{children}</div>
    </div>
  );
}

function ReviewStep({ overdue }: { overdue: Task[] }) {
  return (
    <div className="planning-col">
      <div className="col-head">
        <h3>Review unfinished tasks</h3>
        <p>
          {overdue.length
            ? `${overdue.length} task${overdue.length === 1 ? "" : "s"} slipped from previous days. Decide what to do with each one.`
            : "Nothing left over from previous days. Nice!"}
        </p>
      </div>
      <div className="list-scroll" style={{ maxWidth: 820 }}>
        {overdue.map((t) => (
          <ActionRow key={t.id} task={t}>
            <button className="btn ghost" title="Do today" onClick={() => scheduleFor(t, "today")}>
              <Sun size={14} /> Today
            </button>
            <button className="btn ghost" title="Do tomorrow" onClick={() => scheduleFor(t, "tomorrow")}>
              <Sunrise size={14} /> Tomorrow
            </button>
            <button className="btn ghost" title="Someday" onClick={() => scheduleFor(t, "someday")}>
              <Archive size={14} />
            </button>
          </ActionRow>
        ))}
        {overdue.length > 1 && (
          <button
            className="btn"
            style={{ margin: "14px 12px" }}
            onClick={() => overdue.forEach((t) => scheduleFor(t, "today"))}
          >
            Move all to today
          </button>
        )}
      </div>
    </div>
  );
}

function DropCol({ patch, children, className }: { patch: Partial<Task>; children: ReactNode; className?: string }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`planning-col ${className ?? ""}`}
      style={over ? { background: "var(--accent-softer)" } : undefined}
      onDragOver={(e) => {
        if (!isTaskDrag(e)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = droppedTaskId(e);
        if (!id) return;
        e.preventDefault();
        useStore.getState().updateTask(id, patch);
      }}
    >
      {children}
    </div>
  );
}

function ChooseStep({ todays, planned, capacity }: { todays: Task[]; planned: number; capacity: number }) {
  const tasks = useStore((s) => s.tasks);
  const today = todayStr();
  const inbox = sortTasks(inboxTasks(tasks));
  const soon = sortTasks(tasks.filter((t) => !t.done && t.date && t.date > today && t.date <= addDays(today, 7)));
  const pct = Math.min(100, (planned / capacity) * 100);

  const add = (t: Task) => scheduleFor(t, "today");
  return (
    <>
      <DropCol patch={{ date: null, start: null }}>
        <div className="col-head">
          <h3>Choose what to work on</h3>
          <p>Pull tasks into today from your inbox and the week ahead. Drag them across, or click +.</p>
        </div>
        <div className="list-scroll">
          <div className="section-head">Inbox <span className="meta">{inbox.length}</span></div>
          {inbox.map((t) => (
            <ActionRow key={t.id} task={t}>
              <button className="icon-btn" title="Add to today" onClick={() => add(t)}>
                <Plus size={16} />
              </button>
            </ActionRow>
          ))}
          {!inbox.length && <div className="hint" style={{ padding: "4px 12px" }}>Inbox is empty.</div>}
          <div className="section-head" style={{ marginTop: 12 }}>Next 7 days <span className="meta">{soon.length}</span></div>
          {soon.map((t) => (
            <ActionRow key={t.id} task={t}>
              <button className="icon-btn" title="Pull into today" onClick={() => add(t)}>
                <Plus size={16} />
              </button>
            </ActionRow>
          ))}
        </div>
      </DropCol>
      <DropCol patch={{ date: today }} className="narrow">
        <div className="col-head">
          <h3>Today</h3>
          <p>{todays.length} tasks</p>
        </div>
        <div className="capacity">
          <div className="nums">
            {formatDuration(planned) || "0m"} <span>of {formatDuration(capacity)} capacity</span>
          </div>
          <div className="bar">
            <i className={planned > capacity ? "over" : ""} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="list-scroll">
          {todays.map((t) => (
            <ActionRow key={t.id} task={t}>
              <button className="icon-btn" title="Remove from today" onClick={() => scheduleFor(t, "none")}>
                <X size={14} />
              </button>
            </ActionRow>
          ))}
        </div>
      </DropCol>
    </>
  );
}

function BlockStep({ todays }: { todays: Task[] }) {
  const unblocked = todays.filter((t) => !t.start);
  return (
    <>
      <div className="planning-col">
        <div className="col-head">
          <h3>Time-block your day</h3>
          <p>Drag tasks onto the calendar to reserve time for them. Drag the bottom edge to resize.</p>
        </div>
        <div className="list-scroll">
          {unblocked.map((t) => (
            <TaskRow key={t.id} task={t} showDate={false} />
          ))}
          {!unblocked.length && <div className="hint" style={{ padding: "8px 12px" }}>Every task for today has a time slot. 🎯</div>}
        </div>
      </div>
      <div className="planning-col narrow" style={{ width: 460 }}>
        <TimeGrid days={[todayStr()]} />
      </div>
    </>
  );
}
