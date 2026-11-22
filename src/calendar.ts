import { addDays, monthGrid, parseLocal, startOfWeek } from "./dates";
import type { Settings } from "./types";
import type { CalendarMode } from "./types";

/** Hour heights for the calendar "Density" option. */
export const DENSITY: Record<string, number> = { Small: 64, Medium: 96, Large: 128 };

export const densityName = (hh: number) => Object.entries(DENSITY).find(([, v]) => v === hh)?.[0] ?? "Custom";

const isWeekend = (d: string) => [0, 6].includes(parseLocal(d).getDay());

/** Days shown by the time grid (month mode returns its 6-week grid). */
export function calendarDays(date: string, mode: CalendarMode, settings: Settings): string[] {
  const weekStartsOn = Number(settings.weekStartsOn ?? 1);
  if (mode === "day") return [date];
  if (mode === "3day") return Array.from({ length: Number(settings.calDays) || 3 }, (_, i) => addDays(date, i));
  if (mode === "month") {
    const d = parseLocal(date);
    return monthGrid(d.getFullYear(), d.getMonth(), weekStartsOn);
  }
  const start = startOfWeek(date, weekStartsOn);
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return settings.calWeekends === "0" ? week.filter((d) => !isWeekend(d)) : week;
}

/** Where the ‹ › buttons and [ ] keys move to. */
export function stepDate(date: string, mode: CalendarMode, settings: Settings, dir: 1 | -1): string {
  if (mode === "month") {
    const d = parseLocal(date);
    const m = new Date(d.getFullYear(), d.getMonth() + dir, 1);
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-01`;
  }
  const n = mode === "day" ? 1 : mode === "3day" ? Number(settings.calDays) || 3 : 7;
  return addDays(date, n * dir);
}

export function modeLabel(mode: CalendarMode, settings: Settings): string {
  if (mode === "day") return "1 Day";
  if (mode === "3day") return `${Number(settings.calDays) || 3} Days`;
  return mode === "week" ? "Week" : "Month";
}
