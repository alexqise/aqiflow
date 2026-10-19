import { useRef, useState } from "react";
import { relativeDay, formatTime } from "../dates";
import type { ParsedTask } from "../nlp";
import { commitParsed, useParsed } from "../quickadd";
import { useStore } from "../store";
import type { Task } from "../types";

export function Tokens({ parsed, defaults }: { parsed: ParsedTask; defaults?: Partial<Task> }) {
  const projects = useStore((s) => s.projects);
  const tokens = parsed.tokens.map((t, i) => {
    let label = t.label;
    if (t.kind === "date") {
      label = parsed.start ? `${relativeDay(parsed.date!)} ${formatTime(parsed.start, true)}` : relativeDay(parsed.date!);
    }
    return (
      <span key={i} className={`token ${t.kind}`}>
        {t.kind === "project" ? "#" : t.kind === "tag" ? "@" : ""}
        {label}
      </span>
    );
  });
  const defaultProject = !parsed.projectId && !parsed.newProject && defaults?.projectId ? projects.find((p) => p.id === defaults.projectId) : null;
  return (
    <>
      {tokens}
      {defaultProject && <span className="token project">#{defaultProject.name}</span>}
    </>
  );
}

interface ComposerProps {
  defaults?: Partial<Task>;
  autoFocus?: boolean;
  placeholder?: string;
  onDone?: (task: Task | null, keepOpen: boolean) => void;
  onCancel?: () => void;
  className?: string;
  big?: boolean;
  /** Enter closes; ⌘/⇧-Enter keeps the composer open for the next task. */
  closeOnSubmit?: boolean;
}

/** Single-line natural-language task input with live token preview. */
export function Composer({ defaults, autoFocus, placeholder, onDone, onCancel, big, closeOnSubmit }: ComposerProps) {
  const [text, setText] = useState("");
  const parsed = useParsed(text);
  const ref = useRef<HTMLInputElement>(null);

  const submit = (keepOpen: boolean) => {
    const t = commitParsed(parsed, defaults);
    setText("");
    onDone?.(t, keepOpen);
    ref.current?.focus();
  };

  return (
    <>
      <input
        ref={ref}
        autoFocus={autoFocus}
        value={text}
        placeholder={placeholder ?? "Task name — try “Write report tomorrow 3pm for 1h #work !1”"}
        style={big ? { fontSize: 17 } : undefined}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (!parsed.title) return;
            submit(!closeOnSubmit || e.metaKey || e.shiftKey);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setText("");
            onCancel?.();
          }
        }}
      />
      <div className="token-row">
        <Tokens parsed={parsed} defaults={defaults} />
        {!parsed.tokens.length && <span className="hint">tomorrow 3pm · 30m · #project · @tag · !1 · every week</span>}
      </div>
    </>
  );
}
