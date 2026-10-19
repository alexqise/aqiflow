import { useStore } from "./store";

export const ratingKey = (date: string) => `rating:${date}`;

/** 0 → red, 5 → yellow, 10 → green. */
export const ratingHue = (score: number) => Math.round(Math.max(0, Math.min(10, score)) * 12);

export function useRating(date: string): number | null {
  const raw = useStore((s) => s.settings[ratingKey(date)]);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}
