import type React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { addDays, longDate, monthName, todayStr, weekdayName, parseLocal } from "../dates";
import { useStore } from "../store";
import { ratingHue } from "../ratings";
import { DayRater } from "./DayRater";

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (n: number) => n.toFixed(1);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const hueStyle = (score: number) => ({ "--rate-h": ratingHue(score) }) as React.CSSProperties;

function useRatings(): Map<string, number> {
  const settings = useStore((s) => s.settings);
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const [k, v] of Object.entries(settings)) {
      if (!k.startsWith("rating:") || v === "") continue;
      const n = Number(v);
      if (Number.isFinite(n)) m.set(k.slice(7), n);
    }
    return m;
  }, [settings]);
}

function shortDate(date: string) {
  const d = parseLocal(date);
  return `${monthName(d.getMonth(), true)} ${d.getDate()}`;
}

export function RatingsView() {
  const ratings = useRatings();
  const today = todayStr();
  const thisYear = parseLocal(today).getFullYear();
  const [year, setYear] = useState(thisYear);
  const [selected, setSelected] = useState(today);
  const [tip, setTip] = useState<{ date: string; x: number; y: number } | null>(null);

  const yearEntries = [...ratings.entries()].filter(([d]) => d.startsWith(`${year}-`)).sort(([a], [b]) => a.localeCompare(b));
  const yearAvg = avg(yearEntries.map(([, v]) => v));
  const best = yearEntries.reduce<[string, number] | null>((b, e) => (!b || e[1] > b[1] ? e : b), null);
  const worst = yearEntries.reduce<[string, number] | null>((w, e) => (!w || e[1] < w[1] ? e : w), null);

  const windowAvg = (endOffset: number) => {
    const xs: number[] = [];
    for (let i = endOffset; i < endOffset + 30; i++) {
      const v = ratings.get(addDays(today, -i));
      if (v !== undefined) xs.push(v);
    }
    return avg(xs);
  };
  const last30 = windowAvg(0);
  const prev30 = windowAvg(30);

  // Consecutive rated days ending today (or yesterday, if today isn't rated yet).
  let streak = 0;
  for (let d = ratings.has(today) ? today : addDays(today, -1); ratings.has(d); d = addDays(d, -1)) streak++;

  const buckets = Array.from({ length: 11 }, (_, i) => yearEntries.filter(([, v]) => Math.round(v) === i).length);
  const maxBucket = Math.max(1, ...buckets);

  const showTip = (date: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setTip({ date, x: r.left + r.width / 2, y: r.top });
  };

  return (
    <div className="main">
      <div className="main-header drag" data-tauri-drag-region>
        <h1 data-tauri-drag-region>Day ratings</h1>
        <span className="sub" data-tauri-drag-region>
          {yearEntries.length} day{yearEntries.length === 1 ? "" : "s"} rated in {year}
        </span>
        <div className="grow" data-tauri-drag-region />
        {year !== thisYear && (
          <button className="btn" onClick={() => setYear(thisYear)}>
            This year
          </button>
        )}
        <button className="icon-btn" onClick={() => setYear(year - 1)} title="Previous year">
          <ChevronLeft size={17} />
        </button>
        <span className="year-label">{year}</span>
        <button className="icon-btn" onClick={() => setYear(year + 1)} disabled={year >= thisYear} title="Next year">
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="ratings-scroll">
        <div className="stat-row">
          <Stat label={`${year} average`} value={yearAvg} sub={`${yearEntries.length} days`} />
          <Stat
            label="Last 30 days"
            value={last30}
            sub={
              last30 !== null && prev30 !== null
                ? `${last30 >= prev30 ? "▲" : "▼"} ${fmt(Math.abs(last30 - prev30))} vs previous 30`
                : "Not enough history yet"
            }
          />
          <Stat label="Best day" value={best?.[1] ?? null} sub={best ? longDate(best[0]) : "—"} onClick={best ? () => setSelected(best[0]) : undefined} />
          <Stat label="Toughest day" value={worst?.[1] ?? null} sub={worst ? longDate(worst[0]) : "—"} onClick={worst ? () => setSelected(worst[0]) : undefined} />
          <div className="stat">
            <div className="stat-label">Streak</div>
            <div className="stat-value">
              {streak}
              <span className="stat-unit">day{streak === 1 ? "" : "s"}</span>
            </div>
            <div className="stat-sub">{streak ? "Keep rating every day" : "Rate today to start one"}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Year in pixels</h3>
            <div className="grow" />
            <Legend />
          </div>
          <div className="pixels" onMouseLeave={() => setTip(null)}>
            <div className="px-corner" />
            {Array.from({ length: 31 }, (_, i) => (
              <div key={i} className="px-day-label">
                {(i + 1) % 5 === 0 || i === 0 ? i + 1 : ""}
              </div>
            ))}
            <div className="px-avg-head">avg</div>
            {Array.from({ length: 12 }, (_, m) => {
              const daysIn = new Date(year, m + 1, 0).getDate();
              const monthVals = Array.from({ length: daysIn }, (_, i) => ratings.get(`${year}-${pad(m + 1)}-${pad(i + 1)}`)).filter(
                (v): v is number => v !== undefined,
              );
              const mAvg = avg(monthVals);
              return (
                <div key={m} style={{ display: "contents" }}>
                  <div className="px-month">{monthName(m, true)}</div>
                  {Array.from({ length: 31 }, (_, i) => {
                    if (i >= daysIn) return <div key={i} />;
                    const date = `${year}-${pad(m + 1)}-${pad(i + 1)}`;
                    const v = ratings.get(date);
                    const future = date > today;
                    const cls = ["px", v !== undefined ? "rated" : "", future ? "future" : "", date === today ? "today" : "", date === selected ? "sel" : ""].join(" ");
                    return (
                      <button
                        key={i}
                        className={cls}
                        style={v !== undefined ? hueStyle(v) : undefined}
                        disabled={future}
                        aria-label={`${longDate(date)}: ${v !== undefined ? `${fmt(v)} out of 10` : "not rated"}`}
                        onMouseEnter={(e) => showTip(date, e.currentTarget)}
                        onFocus={(e) => showTip(date, e.currentTarget)}
                        onBlur={() => setTip(null)}
                        onClick={() => setSelected(date)}
                      />
                    );
                  })}
                  <div className="px-avg">
                    {mAvg !== null && (
                      <>
                        <span className="swatch-dot" style={hueStyle(mAvg)} />
                        {fmt(mAvg)}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ratings-bottom">
          <div className="card">
            <div className="card-head">
              <h3>Distribution</h3>
              <div className="grow" />
              <span className="hint">days per score, {year}</span>
            </div>
            <div className="histo">
              {buckets.map((count, score) => (
                <div key={score} className="histo-col" title={`${count} day${count === 1 ? "" : "s"} rated ≈${score}`}>
                  <span className="histo-count">{count || ""}</span>
                  <div className="histo-track">
                    <div className="histo-bar" style={{ ...hueStyle(score), height: `${(count / maxBucket) * 100}%` }} />
                  </div>
                  <span className="histo-x">{score}</span>
                </div>
              ))}
            </div>
          </div>
          <SelectedDay date={selected} rating={ratings.get(selected)} />
        </div>
      </div>

      {tip && <PixelTip date={tip.date} x={tip.x} y={tip.y} rating={ratings.get(tip.date)} />}
    </div>
  );
}

function Stat({ label, value, sub, onClick }: { label: string; value: number | null; sub: string; onClick?: () => void }) {
  return (
    <button className="stat" onClick={onClick} disabled={!onClick} style={onClick ? undefined : { cursor: "default" }}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value !== null && <span className="swatch-dot lg" style={hueStyle(value)} />}
        {value !== null ? fmt(value) : "—"}
        {value !== null && <span className="stat-unit">/10</span>}
      </div>
      <div className="stat-sub">{sub}</div>
    </button>
  );
}

function Legend() {
  return (
    <div className="rate-legend" aria-label="Color scale from 0 (red) to 10 (green)">
      <span>0</span>
      <div className="rate-legend-bar" />
      <span>10</span>
      <span className="legend-empty">
        <i /> not rated
      </span>
    </div>
  );
}

function PixelTip({ date, x, y, rating }: { date: string; x: number; y: number; rating?: number }) {
  return (
    <div className="px-tip" style={{ left: x, top: y - 8 }}>
      <strong>{rating !== undefined ? `${fmt(rating)}/10` : "Not rated"}</strong>
      <span>
        {weekdayName(date, true)}, {shortDate(date)}
      </span>
    </div>
  );
}

function SelectedDay({ date, rating }: { date: string; rating?: number }) {
  const tasks = useStore((s) => s.tasks);
  const done = tasks.filter((t) => t.done && (t.doneAt ?? "").slice(0, 10) === date);
  const today = todayStr();
  const label = date === today ? "Today" : date === addDays(today, -1) ? "Yesterday" : weekdayName(date);
  return (
    <div className="card selected-day" style={rating !== undefined ? hueStyle(rating) : undefined}>
      <div className="card-head">
        <h3>{label}</h3>
        <span className="hint" style={{ marginLeft: 8 }}>
          {longDate(date).split(", ")[1]}, {parseLocal(date).getFullYear()}
        </span>
      </div>
      <div className="selected-body">
        <DayRater date={date} />
        <div className="hint" style={{ marginTop: 12 }}>
          {done.length ? `${done.length} task${done.length === 1 ? "" : "s"} completed` : "No completed tasks recorded"}
        </div>
        {done.slice(0, 5).map((t) => (
          <div key={t.id} className="selected-task">
            ✓ {t.title}
          </div>
        ))}
        <div className="hint" style={{ marginTop: "auto", paddingTop: 12 }}>
          Click any square to rate or review that day.
        </div>
      </div>
    </div>
  );
}

