import { ArrowRight, Check, MoonStar, X } from "lucide-react";
import { addDays, formatDuration, longDate, parseLocal, startOfWeek, todayStr, weekdayName } from "../dates";
import { ratingHue, ratingKey } from "../ratings";
import { useStore } from "../store";
import type { Task } from "../types";
import { DayNote } from "./DayNote";
import { DayRater } from "./DayRater";

/** End-of-day / end-of-week ritual: see what got done, roll over the rest, rate and journal. */
export function Shutdown() {
  const scope = useStore((s) => s.shutdown);
  const tasks = useStore((s) => s.tasks);
  const settings = useStore((s) => s.settings);
  if (!scope) return null;
  const s = useStore.getState();
  const close = () => s.set({ shutdown: null });
  const today = todayStr();
  const weekStart = startOfWeek(today, Number(settings.weekStartsOn ?? 1));
  const days = scope === "day" ? [today] : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter((d) => d <= today);
  const inRange = (d: string | null | undefined) => !!d && d >= days[0] && d <= days[days.length - 1];

  const done = tasks.filter((t) => t.done && inRange(t.doneAt?.slice(0, 10)));
  const left = tasks.filter((t) => !t.done && !t.someday && t.date && t.date <= today);
  const minutes = done.reduce((m, t) => m + (t.duration || 0), 0);
  const tomorrow = addDays(today, 1);
  const nextMonday = addDays(weekStart, 7);
  const target = scope === "day" ? tomorrow : nextMonday;

  const rollOver = (list: Task[]) =>
    s.updateTasks(list.map((t) => [t.id, { date: target, start: t.start ? `${target}T${t.start.slice(11)}` : null }]));

  return (
    <div className="overlay" onMouseDown={close} onKeyDown={(e) => e.key === "Escape" && close()}>
      <div className="modal shutdown" onMouseDown={(e) => e.stopPropagation()}>
        <header className="shutdown-head">
          <MoonStar size={18} />
          <div>
            <h2>{scope === "day" ? "Daily shutdown" : "Weekly shutdown"}</h2>
            <span className="hint">
              {scope === "day" ? longDate(today) : `${longDate(days[0])} – ${longDate(days[days.length - 1])}`}
            </span>
          </div>
          <div className="grow" />
          <button className="icon-btn" onClick={close} title="Close (esc)">
            <X size={16} />
          </button>
        </header>

        <div className="shutdown-body">
          <section>
            <div className="section-label">
              <span>Completed</span>
              <span className="count-chip">{done.length}</span>
              <span className="grow" />
              {minutes > 0 && <span className="hint">{formatDuration(minutes)}</span>}
            </div>
            {done.length ? (
              <ul className="shutdown-list">
                {done.slice(0, 12).map((t) => (
                  <li key={t.id} className="done">
                    <Check size={13} /> {t.title}
                  </li>
                ))}
                {done.length > 12 && <li className="hint">and {done.length - 12} more</li>}
              </ul>
            ) : (
              <p className="hint">Nothing checked off {scope === "day" ? "today" : "this week"} yet.</p>
            )}
          </section>

          <section>
            <div className="section-label">
              <span>Still open</span>
              <span className="count-chip">{left.length}</span>
              <span className="grow" />
              {left.length > 0 && (
                <button className="btn ghost sm" onClick={() => rollOver(left)}>
                  Move all to {scope === "day" ? "tomorrow" : "next week"} <ArrowRight size={13} />
                </button>
              )}
            </div>
            {left.length ? (
              <ul className="shutdown-list">
                {left.map((t) => (
                  <li key={t.id}>
                    <button className="checkbox" onClick={() => s.toggleDone(t.id)} aria-label="Mark as done">
                      <Check size={11} strokeWidth={3.2} />
                    </button>
                    <span className="t">{t.title}</span>
                    <button className="pop-chip" onClick={() => rollOver([t])}>
                      {scope === "day" ? "Tomorrow" : "Next week"}
                    </button>
                    <button className="pop-chip" onClick={() => s.updateTask(t.id, { someday: true, date: null, start: null })}>
                      Someday
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">All clear. Nothing carries over.</p>
            )}
          </section>

          {scope === "day" ? (
            <section>
              <div className="section-label">
                <span>How was today?</span>
              </div>
              <DayRater date={today} noteButton={false} />
              <DayNote date={today} rows={4} />
            </section>
          ) : (
            <section>
              <div className="section-label">
                <span>Your week</span>
              </div>
              <div className="week-strip">
                {days.map((d) => {
                  const raw = settings[ratingKey(d)];
                  const r = raw ? Number(raw) : null;
                  const n = tasks.filter((t) => t.done && t.doneAt?.slice(0, 10) === d).length;
                  return (
                    <div key={d} className="week-day">
                      <span className="dow">{weekdayName(d, true)}</span>
                      <span
                        className="score"
                        style={r !== null ? { background: `hsl(${ratingHue(r)} 60% 42%)`, color: "#fff" } : undefined}
                        title={r !== null ? `Rated ${r.toFixed(1)}` : "Not rated"}
                      >
                        {r !== null ? r.toFixed(1) : "–"}
                      </span>
                      <span className="hint">
                        {n} done · {parseLocal(d).getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <footer className="shutdown-foot">
          <button className="btn primary" onClick={close}>
            {scope === "day" ? "Shut down for today" : "Close the week"}
          </button>
        </footer>
      </div>
    </div>
  );
}
