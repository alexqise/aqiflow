// All dates are handled as local, timezone-less strings:
//   date     → "YYYY-MM-DD"
//   datetime → "YYYY-MM-DDTHH:mm"

const pad = (n: number) => String(n).padStart(2, "0");

export const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toDateTimeStr = (d: Date) => `${toDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function parseLocal(s: string): Date {
  const [datePart, timePart] = s.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = (timePart ?? "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

export const todayStr = () => toDateStr(new Date());
export const nowStr = () => new Date().toISOString();

export function addDays(date: string, n: number): string {
  const d = parseLocal(date);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function addMinutes(dt: string, n: number): string {
  const d = parseLocal(dt);
  d.setMinutes(d.getMinutes() + n);
  return toDateTimeStr(d);
}

export const minutesOfDay = (dt: string) => {
  const d = parseLocal(dt);
  return d.getHours() * 60 + d.getMinutes();
};

export const atMinutes = (date: string, minutes: number) =>
  `${date}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export const diffMinutes = (a: string, b: string) => Math.round((parseLocal(b).getTime() - parseLocal(a).getTime()) / 60000);

export const diffDays = (a: string, b: string) => Math.round((parseLocal(b).getTime() - parseLocal(a).getTime()) / 86400000);

export function startOfWeek(date: string, weekStartsOn: number): string {
  const d = parseLocal(date);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  return addDays(date, -diff);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const weekdayName = (date: string, short = false) => {
  const n = WEEKDAYS[parseLocal(date).getDay()];
  return short ? n.slice(0, 3) : n;
};
export const monthName = (m: number, short = false) => (short ? MONTHS[m].slice(0, 3) : MONTHS[m]);

/** "Today", "Tomorrow", "Yesterday", "Fri", "Oct 21", "Oct 21, 2027" */
export function relativeDay(date: string): string {
  const t = todayStr();
  const diff = diffDays(t, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const d = parseLocal(date);
  if (diff > 1 && diff < 7) return weekdayName(date, true);
  const base = `${monthName(d.getMonth(), true)} ${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

/** "Wednesday, October 14" */
export function longDate(date: string): string {
  const d = parseLocal(date);
  return `${weekdayName(date)}, ${monthName(d.getMonth())} ${d.getDate()}`;
}

let use24h = false;
export const setClock24 = (v: boolean) => {
  use24h = v;
};

export function formatTime(dt: string | number, compact = false): string {
  const minutes = typeof dt === "number" ? dt : minutesOfDay(dt);
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  if (use24h) return `${pad(h)}:${pad(m)}`;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (compact && m === 0) return `${h12}${suffix}`;
  return `${h12}:${pad(m)}${compact ? suffix : " " + suffix.toUpperCase()}`;
}

export function formatHourLabel(h: number): string {
  if (use24h) return `${pad(h)}:00`;
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export function formatDuration(minutes: number): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

export function nextOccurrence(date: string, rule: string): string {
  const d = parseLocal(date);
  switch (rule) {
    case "daily":
      return addDays(date, 1);
    case "weekdays": {
      let next = addDays(date, 1);
      while ([0, 6].includes(parseLocal(next).getDay())) next = addDays(next, 1);
      return next;
    }
    case "weekly":
      return addDays(date, 7);
    case "biweekly":
      return addDays(date, 14);
    case "monthly": {
      const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
      n.setDate(Math.min(d.getDate(), last));
      return toDateStr(n);
    }
    case "yearly":
      return toDateStr(new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()));
    default:
      return addDays(date, 1);
  }
}

export const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Every day",
  weekdays: "Every weekday",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
  yearly: "Every year",
};

/** Calendar month grid: 6 rows × 7 columns of date strings. */
export function monthGrid(year: number, month: number, weekStartsOn: number): string[] {
  const first = toDateStr(new Date(year, month, 1));
  const start = startOfWeek(first, weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
