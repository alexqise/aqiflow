import { Check, Flag, Star } from "lucide-react";
import { useState } from "react";
import type { Task } from "../types";

export function Checkbox({ task, onToggle, size }: { task: Task; onToggle: () => void; size?: number }) {
  const [pop, setPop] = useState(false);
  return (
    <button
      className={`checkbox p${task.priority} ${task.done ? "checked" : ""} ${pop ? "pop" : ""}`}
      style={size ? { width: size, height: size } : undefined}
      onClick={(e) => {
        e.stopPropagation();
        setPop(true);
        setTimeout(() => setPop(false), 260);
        onToggle();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={task.done ? "Mark as not done" : "Mark as done"}
    >
      <Check size={size ? size - 6 : 11} strokeWidth={3.2} />
    </button>
  );
}

export const PRIORITIES = [
  { value: 0, label: "No priority", short: "None" },
  { value: 3, label: "High", short: "High" },
  { value: 2, label: "Medium", short: "Medium" },
  { value: 1, label: "Low", short: "Low" },
  { value: 4, label: "Goal of the day", short: "Goal" },
];

export function PriorityFlag({ priority, size = 13 }: { priority: number; size?: number }) {
  if (!priority) return null;
  return (
    <span className={`prio-flag p${priority}`} title={PRIORITIES.find((p) => p.value === priority)?.label}>
      {priority === 4 ? <Star size={size} fill="currentColor" /> : <Flag size={size} fill="currentColor" />}
    </span>
  );
}

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

export function Keys({ keys }: { keys: string }) {
  return (
    <>
      {keys.split(" ").map((k, i) => (
        <kbd key={i}>{k === "mod" ? (isMac ? "⌘" : "Ctrl") : k}</kbd>
      ))}
    </>
  );
}

export function ProgressRing({ value, size = 28, stroke = 3 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-active)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .4s" }}
      />
    </svg>
  );
}
