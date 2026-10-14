import type React from "react";

// HTML5 drag payloads aren't readable during dragover, so the active
// drag is mirrored here for drop targets that need to preview it.

export const TASK_MIME = "application/x-aqiflow-task";

export const drag = {
  taskId: null as string | null,
};

export function startTaskDrag(e: React.DragEvent, taskId: string) {
  drag.taskId = taskId;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData(TASK_MIME, taskId);
  e.dataTransfer.setData("text/plain", taskId);
}

export function endTaskDrag() {
  drag.taskId = null;
}

export const isTaskDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(TASK_MIME);

export function droppedTaskId(e: React.DragEvent): string | null {
  return e.dataTransfer.getData(TASK_MIME) || drag.taskId;
}
