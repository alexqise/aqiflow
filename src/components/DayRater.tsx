import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";

export const ratingKey = (date: string) => `rating:${date}`;

/** 0 → red, 5 → yellow, 10 → green. */
export const ratingHue = (score: number) => Math.round(Math.max(0, Math.min(10, score)) * 12);

export function useRating(date: string): number | null {
  const raw = useStore((s) => s.settings[ratingKey(date)]);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

const VALID_DRAFT = /^(\d{0,2})(\.\d?)?$/;

function parse(draft: string): number | null | "invalid" {
  const t = draft.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 10) return "invalid";
  return Math.round(n * 10) / 10;
}

/** Inline 0.0–10.0 score for a day, color-graded along a red→green spectrum. */
export function DayRater({ date, compact }: { date: string; compact?: boolean }) {
  const rating = useRating(date);
  const [draft, setDraft] = useState(rating === null ? "" : rating.toFixed(1));
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) setDraft(rating === null ? "" : rating.toFixed(1));
  }, [rating, focused, date]);

  const preview = parse(draft);
  const score = typeof preview === "number" ? preview : null;
  const invalid = preview === "invalid";

  const commit = () => {
    // Read the live field value: blur can fire before the latest keystroke re-renders.
    const v = parse(ref.current?.value ?? draft);
    if (v === "invalid") {
      setDraft(rating === null ? "" : rating.toFixed(1));
      return;
    }
    useStore.getState().setSetting(ratingKey(date), v === null ? "" : v.toFixed(1));
    setDraft(v === null ? "" : v.toFixed(1));
  };

  const nudge = (delta: number) => {
    const base = score ?? rating ?? 5;
    const next = Math.round(Math.max(0, Math.min(10, base + delta)) * 10) / 10;
    setDraft(next.toFixed(1));
  };

  return (
    <label
      className={`day-rater ${score !== null ? "rated" : ""} ${invalid ? "invalid" : ""} ${compact ? "compact" : ""}`}
      style={score !== null ? ({ "--rate-h": ratingHue(score) } as React.CSSProperties) : undefined}
      title="Rate this day from 0.0 to 10.0 (↑/↓ to adjust, ⇧ for whole points)"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {!compact && <span className="day-rater-label">Day</span>}
      <input
        ref={ref}
        value={draft}
        inputMode="decimal"
        placeholder="–"
        aria-label="Day rating out of 10"
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onChange={(e) => {
          const v = e.target.value.replace(",", ".");
          if (VALID_DRAFT.test(v)) setDraft(v);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") ref.current?.blur();
          else if (e.key === "Escape") {
            setDraft(rating === null ? "" : rating.toFixed(1));
            setTimeout(() => ref.current?.blur());
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            nudge((e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 1 : 0.1));
          }
        }}
      />
      <span className="day-rater-max">/10</span>
    </label>
  );
}

/** Read-only colored score, used in calendar day headers. */
export function RatingBadge({ date }: { date: string }) {
  const rating = useRating(date);
  if (rating === null) return null;
  return (
    <span className="rating-badge" style={{ "--rate-h": ratingHue(rating) } as React.CSSProperties} title={`Day rated ${rating.toFixed(1)}/10`}>
      {rating.toFixed(1)}
    </span>
  );
}
