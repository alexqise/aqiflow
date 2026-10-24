import { useEffect, useRef, useState } from "react";
import { noteKey, useDayNote } from "../ratings";
import { useStore } from "../store";

/** Free-form journal note for a day; saves as you type and on blur. */
export function DayNote({ date, autoFocus, rows = 5 }: { date: string; autoFocus?: boolean; rows?: number }) {
  const saved = useDayNote(date);
  const [draft, setDraft] = useState(saved);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const dirty = useRef(false);

  // Follow the stored value when switching days or when another window edits it.
  useEffect(() => {
    if (!dirty.current) setDraft(saved);
  }, [saved, date]);

  useEffect(() => {
    dirty.current = false;
    setStatus("idle");
    return () => clearTimeout(timer.current);
  }, [date]);

  const save = (value: string) => {
    clearTimeout(timer.current);
    dirty.current = false;
    if (value !== useStore.getState().settings[noteKey(date)]) {
      useStore.getState().setSetting(noteKey(date), value);
      setStatus("saved");
    }
  };

  return (
    <div className="day-note">
      <textarea
        autoFocus={autoFocus}
        rows={rows}
        value={draft}
        placeholder="How did the day go? Wins, struggles, anything worth remembering…"
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          dirty.current = true;
          setStatus("saving");
          clearTimeout(timer.current);
          timer.current = setTimeout(() => save(v), 600);
        }}
        onBlur={(e) => save(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
        }}
      />
      <div className="day-note-status">{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}</div>
    </div>
  );
}
