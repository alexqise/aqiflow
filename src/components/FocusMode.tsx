import { Check, Pause, Play, SkipForward, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDuration } from "../dates";
import { sortTasks } from "../selectors";
import { useStore } from "../store";
import { fmtClock, focusElapsed } from "../focus";
import { PriorityFlag } from "./common";

export function FocusMode() {
  const focus = useStore((s) => s.focus)!;
  const task = useStore((s) => s.tasks.find((t) => t.id === s.focus?.taskId));
  const project = useStore((s) => s.projects.find((p) => p.id === task?.projectId));
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  if (!task) return null;
  const s = useStore.getState();
  const elapsed = focusElapsed(focus);
  const target = (task.duration || 25) * 60_000;
  const remaining = target - elapsed;
  const paused = focus.pausedAt !== null;

  // Closing minimizes to the title-bar pill; Stop ends the session.
  const exit = () => s.set({ focusOpen: false });
  const stop = () => s.set({ focus: null, focusOpen: false });
  const togglePause = () =>
    s.set({
      focus: paused
        ? { ...focus, startedAt: Date.now(), pausedAt: null, elapsedBefore: focus.elapsedBefore + (focus.pausedAt! - focus.startedAt) }
        : { ...focus, pausedAt: Date.now() },
    });
  const nextTask = () => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return sortTasks(s.tasks.filter((t) => !t.done && t.date === key && t.id !== task.id))[0];
  };
  const complete = () => {
    s.toggleDone(task.id);
    const n = nextTask();
    if (n) s.startFocus(n.id);
    else stop();
  };

  return (
    <div
      className="focus"
      tabIndex={-1}
      ref={(el) => el?.focus()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") exit();
        if (e.key === " ") togglePause();
        if (e.key === "e" || (e.metaKey && e.key === "Enter")) complete();
      }}
    >
      <button className="icon-btn close" onClick={exit} title="Minimize to title bar (esc)">
        <X size={18} />
      </button>
      <div className="label">{paused ? "Paused" : "Focusing on"}</div>
      <h2>{task.title}</h2>
      <div className="meta-line">
        <PriorityFlag priority={task.priority} />
        {project && (
          <span>
            <span className="nav-dot" style={{ background: project.color, display: "inline-block", width: 8, height: 8, margin: "0 6px 0 0" }} />
            {project.name}
          </span>
        )}
        {task.duration > 0 && <span>Estimate {formatDuration(task.duration)}</span>}
      </div>
      <div className={`timer ${remaining < 0 ? "over" : ""}`}>
        {remaining < 0 ? "+" : ""}
        {fmtClock(remaining)}
      </div>
      <div className="progress">
        <i style={{ width: `${Math.min(100, (elapsed / target) * 100)}%`, background: remaining < 0 ? "var(--danger)" : undefined }} />
      </div>
      <div className="actions">
        <button className="btn" onClick={togglePause}>
          {paused ? <Play size={15} /> : <Pause size={15} />} {paused ? "Resume" : "Pause"}
        </button>
        <button className="btn primary" onClick={complete}>
          <Check size={15} /> Complete
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            const n = nextTask();
            if (n) s.startFocus(n.id);
          }}
          title="Skip to the next task for today"
        >
          <SkipForward size={15} /> Skip
        </button>
        <button className="btn ghost" onClick={stop} title="End this focus session">
          Stop
        </button>
      </div>
      {task.notes && <div className="notes">{task.notes}</div>}
      <div className="hint" style={{ position: "absolute", bottom: 20 }}>
        space pause · E complete · esc exit — elapsed {fmtClock(elapsed)}
      </div>
    </div>
  );
}
