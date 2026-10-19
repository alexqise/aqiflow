import { useMemo } from "react";
import { parseQuickAdd, type ParsedTask } from "./nlp";
import { useStore } from "./store";
import type { Task } from "./types";

/** Turns parsed quick-add text into a saved task, creating new projects/tags on the way. */
export function commitParsed(parsed: ParsedTask, defaults: Partial<Task> = {}): Task | null {
  if (!parsed.title) return null;
  const s = useStore.getState();
  let projectId = parsed.projectId ?? defaults.projectId ?? null;
  if (parsed.newProject) projectId = s.addProject(parsed.newProject).id;
  const tags = [...new Set([...(defaults.tags ?? []), ...parsed.tagIds, ...parsed.newTags.map((n) => s.addTag(n).id)])];
  const hasWhen = parsed.date || parsed.start || parsed.someday;
  return s.createTask({
    ...defaults,
    title: parsed.title,
    projectId,
    tags,
    date: hasWhen ? parsed.date : defaults.date ?? null,
    start: hasWhen ? parsed.start : defaults.start ?? null,
    someday: hasWhen ? parsed.someday : defaults.someday ?? false,
    duration: parsed.duration ?? defaults.duration ?? (Number(s.settings.defaultDuration) || 30),
    priority: parsed.priority ?? defaults.priority ?? 0,
    recurrence: parsed.recurrence ?? defaults.recurrence ?? null,
  });
}

export function useParsed(text: string) {
  const projects = useStore((s) => s.projects);
  const tags = useStore((s) => s.tags);
  return useMemo(() => parseQuickAdd(text, projects, tags), [text, projects, tags]);
}
