import { AlignLeft, CalendarClock, Clock, ListChecks, Repeat } from "lucide-react";
import { memo, useState } from "react";
import { taskMenu } from "../actions";
import { formatDuration, formatTime, relativeDay, todayStr } from "../dates";
import { droppedTaskId, endTaskDrag, isTaskDrag, startTaskDrag } from "../dnd";
import { useStore } from "../store";
import type { Task } from "../types";
import { Checkbox, PriorityFlag } from "./common";

interface Props {
  task: Task;
  showDate?: boolean;
  showProject?: boolean;
  compact?: boolean;
  /** Called when another task is dropped onto this row (insert before). */
  onDropBefore?: (draggedId: string, target: Task) => void;
  onClick?: (task: Task) => void;
}

export const TaskRow = memo(function TaskRow({ task, showDate = true, showProject = true, compact, onDropBefore, onClick }: Props) {
  const selected = useStore((s) => s.selectedId === task.id);
  const project = useStore((s) => (task.projectId ? s.projects.find((p) => p.id === task.projectId) : undefined));
  const allTags = useStore((s) => s.tags);
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);

  const today = todayStr();
  const overdue = !task.done && task.date && task.date < today;
  const tags = task.tags.map((id) => allTags.find((t) => t.id === id)).filter(Boolean);
  const subDone = task.subtasks.filter((s) => s.done).length;

  const dateLabel = task.date
    ? task.date === today && task.start
      ? null
      : relativeDay(task.date)
    : null;

  const hasMeta =
    (showDate && dateLabel) || task.recurrence || task.notes || task.subtasks.length || (showProject && project) || tags.length;

  return (
    <div
      className={`task-row ${selected ? "selected" : ""} ${task.done ? "done" : ""} ${dragging ? "dragging" : ""} ${over ? "drop-before" : ""}`}
      data-task-id={task.id}
      draggable
      onDragStart={(e) => {
        startTaskDrag(e, task.id);
        setDragging(true);
      }}
      onDragEnd={() => {
        endTaskDrag();
        setDragging(false);
      }}
      onDragOver={(e) => {
        if (!onDropBefore || !isTaskDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (!onDropBefore) return;
        const id = droppedTaskId(e);
        if (id && id !== task.id) {
          e.preventDefault();
          e.stopPropagation();
          onDropBefore(id, task);
        }
      }}
      onClick={() => (onClick ? onClick(task) : useStore.getState().select(task.id))}
      onDoubleClick={() => useStore.getState().openDetail(task.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        const s = useStore.getState();
        s.select(task.id);
        s.openMenu(e.clientX, e.clientY, taskMenu(task, { x: e.clientX, y: e.clientY }));
      }}
    >
      <Checkbox task={task} onToggle={() => useStore.getState().toggleDone(task.id)} />
      <div className="task-main">
        <div className="task-title">{task.title || <span style={{ color: "var(--text-4)" }}>Untitled task</span>}</div>
        {!compact && hasMeta ? (
          <div className="task-meta">
            {showDate && dateLabel && (
              <span className={`meta ${overdue ? "overdue" : task.date === today ? "today" : ""}`}>
                <CalendarClock size={12} />
                {dateLabel}
                {task.start ? ` · ${formatTime(task.start, true)}` : ""}
              </span>
            )}
            {task.recurrence && (
              <span className="meta">
                <Repeat size={12} />
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span className="meta">
                <ListChecks size={12} />
                {subDone}/{task.subtasks.length}
              </span>
            )}
            {task.notes && (
              <span className="meta">
                <AlignLeft size={12} />
              </span>
            )}
            {showProject && project && (
              <span className="meta">
                <span className="nav-dot" style={{ background: project.color, width: 8, height: 8, margin: 0 }} />
                {project.name}
              </span>
            )}
            {tags.map((t) => (
              <span className="meta" key={t!.id} style={{ color: t!.color }}>
                #{t!.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="task-right">
        <PriorityFlag priority={task.priority} />
        {task.start && (
          <span className="chip time">
            {formatTime(task.start, true)}
          </span>
        )}
        {task.duration > 0 && (
          <span className="chip time">
            <Clock size={11} />
            {formatDuration(task.duration)}
          </span>
        )}
      </div>
    </div>
  );
});
