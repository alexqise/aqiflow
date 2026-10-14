import * as chrono from "chrono-node";
import { toDateStr, toDateTimeStr, diffMinutes } from "./dates";
import type { Project, Tag } from "./types";

export interface ParsedToken {
  kind: "date" | "time" | "duration" | "priority" | "project" | "tag" | "recurrence" | "someday";
  label: string;
}

export interface ParsedTask {
  title: string;
  date: string | null;
  start: string | null;
  duration: number | null;
  priority: number | null;
  projectId: string | null;
  /** `#name` that matched no project — created on submit. */
  newProject: string | null;
  tagIds: string[];
  /** `@name`s that matched no tag — created on submit. */
  newTags: string[];
  recurrence: string | null;
  someday: boolean;
  tokens: ParsedToken[];
}

const norm = (s: string) => s.toLowerCase().replace(/[-_]/g, " ").trim();

const RECURRENCE: [RegExp, string, string][] = [
  [/\b(every ?day|daily)\b/i, "daily", "Every day"],
  [/\b(every ?weekday|weekdays)\b/i, "weekdays", "Every weekday"],
  [/\b(every other week|every 2 weeks|biweekly)\b/i, "biweekly", "Every 2 weeks"],
  [/\b(every ?week|weekly)\b/i, "weekly", "Every week"],
  [/\b(every ?month|monthly)\b/i, "monthly", "Every month"],
  [/\b(every ?year|yearly|annually)\b/i, "yearly", "Every year"],
];

const PRIORITY: [RegExp, number, string][] = [
  [/(^|\s)(!goal|!g)\b/i, 4, "Goal"],
  [/(^|\s)(!1|!high|p1)\b/i, 3, "High priority"],
  [/(^|\s)(!2|!medium|!med|p2)\b/i, 2, "Medium priority"],
  [/(^|\s)(!3|!low|p3)\b/i, 1, "Low priority"],
];

export function parseQuickAdd(input: string, projects: Project[], tags: Tag[], ref = new Date()): ParsedTask {
  let text = ` ${input} `;
  const out: ParsedTask = {
    title: "",
    date: null,
    start: null,
    duration: null,
    priority: null,
    projectId: null,
    newProject: null,
    tagIds: [],
    newTags: [],
    recurrence: null,
    someday: false,
    tokens: [],
  };
  const strip = (m: RegExpMatchArray | null) => {
    if (m && m.index !== undefined) text = text.slice(0, m.index) + " " + text.slice(m.index + m[0].length);
  };

  // #project — "#side-project", "#side_project" and "#sideproject" all match "Side Project".
  const hash = text.match(/(^|\s)#([^\s#@]+)/);
  if (hash) {
    strip(hash);
    const key = compact(hash[2]);
    const p = projects.find((p) => compact(p.name) === key) ?? projects.find((p) => compact(p.name).startsWith(key));
    if (p) {
      out.projectId = p.id;
      out.tokens.push({ kind: "project", label: p.name });
    } else {
      out.newProject = hash[2].replace(/[-_]/g, " ");
      out.tokens.push({ kind: "project", label: `${out.newProject} (new)` });
    }
  }

  // @tags
  for (;;) {
    const m = text.match(/(^|\s)@([^\s#@]+)/);
    if (!m) break;
    strip(m);
    const t = tags.find((t) => norm(t.name) === norm(m[2]));
    if (t) {
      if (!out.tagIds.includes(t.id)) out.tagIds.push(t.id);
      out.tokens.push({ kind: "tag", label: t.name });
    } else {
      out.newTags.push(m[2]);
      out.tokens.push({ kind: "tag", label: `${m[2]} (new)` });
    }
  }

  for (const [re, p, label] of PRIORITY) {
    const m = text.match(re);
    if (m) {
      strip(m);
      out.priority = p;
      out.tokens.push({ kind: "priority", label });
      break;
    }
  }

  for (const [re, rule, label] of RECURRENCE) {
    const m = text.match(re);
    if (m) {
      strip(m);
      out.recurrence = rule;
      out.tokens.push({ kind: "recurrence", label });
      break;
    }
  }

  const someday = text.match(/(^|\s)(someday|sometime|later)(\s|$)/i);
  if (someday) {
    strip(someday);
    out.someday = true;
    out.tokens.push({ kind: "someday", label: "Someday" });
  }

  // Durations: "for 30m", "45min", "1h", "1.5h", "1h30m"
  const dur =
    text.match(/(^|\s)(?:for\s+)?(\d+)\s?h(?:rs?|ours?)?\s?(\d+)\s?m(?:ins?|inutes?)?(?=\s)/i) ??
    text.match(/(^|\s)(?:for\s+)?(\d+(?:\.\d+)?)\s?(m|mins?|minutes?|h|hrs?|hours?)(?=\s)/i);
  if (dur) {
    let minutes: number;
    if (dur.length === 4 && /^\d+$/.test(dur[3] ?? "")) {
      minutes = Number(dur[2]) * 60 + Number(dur[3]);
    } else {
      const n = parseFloat(dur[2]);
      minutes = /^h/i.test(dur[3]) ? Math.round(n * 60) : Math.round(n);
    }
    if (minutes > 0 && minutes <= 24 * 60) {
      strip(dur);
      out.duration = minutes;
    }
  }

  // Dates & times via chrono.
  if (!out.someday) {
    const results = chrono.parse(text, ref, { forwardDate: true });
    const r = results[0];
    if (r) {
      text = text.slice(0, r.index) + " " + text.slice(r.index + r.text.length);
      const d = r.start.date();
      out.date = toDateStr(d);
      if (r.start.isCertain("hour")) {
        out.start = toDateTimeStr(d);
        if (r.end) {
          const mins = diffMinutes(out.start, toDateTimeStr(r.end.date()));
          if (mins > 0) out.duration = mins;
        }
      }
      out.tokens.push({ kind: "date", label: r.text.trim() });
    }
  }
  if (out.duration) out.tokens.push({ kind: "duration", label: `${out.duration}m` });

  out.title = text.replace(/\s+/g, " ").trim();
  return out;
}

function compact(s: string) {
  return s.toLowerCase().replace(/[\s_-]/g, "");
}
