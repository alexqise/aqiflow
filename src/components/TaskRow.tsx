import { AlignLeft, ListChecks, Repeat } from "lucide-react";
import { memo, useState } from "react";
import { taskMenu } from "../actions";
import { diffDays, formatDuration, formatTime, relativeDay, todayStr } from "../dates";
import { droppedTaskId, endTaskDrag, isTaskDrag, startTaskDrag } from "../dnd";
import { anchorOf, useStore } from "../store";
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
      onClick={(e) => (onClick ? onClick(task) : useStore.getState().openDetail(task.id, anchorOf(e.currentTarget)))}
      onContextMenu={(e) => {
        e.preventDefault();
        const s = useStore.getState();
        s.select(task.id);
        s.openMenu(e.clientX, e.clientY, taskMenu(task, { x: e.clientX, y: e.clientY }));
      }}
    >
      <Checkbox task={task} onToggle={() => useStore.getState().toggleDone(task.id)} />
      <div className="task-main">
        <span className="task-title">{task.title || <span style={{ color: "var(--text-4)" }}>Untitled task</span>}</span>
        {!compact && (
          <span className="task-icons">
            {task.recurrence && <Repeat size={12} />}
            {task.notes && <AlignLeft size={12} />}
            {task.subtasks.length > 0 && (
              <span className="sub-count">
                <ListChecks size={12} />
                {subDone}/{task.subtasks.length}
              </span>
            )}
          </span>
        )}
      </div>
      <div className="task-right">
        <PriorityFlag priority={task.priority} />
        {overdue && <span className="chip age">{diffDays(task.date!, today)}d ago</span>}
        {showDate && !overdue && dateLabel && <span className="chip">{dateLabel}</span>}
        {task.start && <span className="chip">{formatTime(task.start, true)}</span>}
        {task.duration > 0 && <span className="chip">{formatDuration(task.duration)}</span>}
        {showProject && project && <span className="chip-dot" style={{ background: project.color }} title={project.name} />}
      </div>
    </div>
  );
});
