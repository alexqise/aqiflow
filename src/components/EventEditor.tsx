import { CalendarDays, Clock, ListTodo, MapPin, Trash2, X } from "lucide-react";
import { useState } from "react";
import { addMinutes, diffMinutes } from "../dates";
import { PALETTE, useStore } from "../store";
import type { CalEvent } from "../types";

export function EventEditor() {
  const ed = useStore((s) => s.eventEditor)!;
  const [ev, setEv] = useState<CalEvent>(ed.event);
  const s = useStore.getState();
  const close = () => s.set({ eventEditor: null });

  const date = ev.start.slice(0, 10);
  const startT = ev.start.slice(11, 16);
  const endT = ev.end.slice(11, 16);
  const valid = ev.allDay || ev.end > ev.start;

  const save = () => {
    if (!valid) return;
    s.saveEvent({ ...ev, title: ev.title.trim() || "New event" });
    close();
  };

  const asTask = () => {
    s.createTask({
      title: ev.title.trim() || "New task",
      notes: ev.notes,
      date,
      start: ev.allDay ? null : ev.start,
      duration: ev.allDay ? 30 : Math.max(5, diffMinutes(ev.start, ev.end)),
    });
    if (!ed.isNew) s.deleteEvent(ev.id);
    close();
  };

  return (
    <div className="overlay" onMouseDown={close}>
      <div
        className="modal"
        style={{ width: 460 }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") close();
          if (e.key === "Enter" && (e.metaKey || (e.target as HTMLElement).tagName === "INPUT")) save();
        }}
      >
        <div className="detail-top">
          <span className="chip">{ed.isNew ? "New event" : "Event"}</span>
          <div className="grow" />
          {!ed.isNew && (
            <button className="icon-btn" title="Delete event" onClick={() => s.deleteEvent(ev.id)}>
              <Trash2 size={15} />
            </button>
          )}
          <button className="icon-btn" onClick={close}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            autoFocus
            className="input"
            style={{ fontSize: 17, height: 40, fontWeight: 600, border: 0, padding: 0, boxShadow: "none" }}
            placeholder="Event title"
            value={ev.title}
            onChange={(e) => setEv({ ...ev, title: e.target.value })}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <CalendarDays size={15} color="var(--text-3)" />
            <input
              type="date"
              className="input"
              style={{ width: 150 }}
              value={date}
              onChange={(e) => {
                const d = e.target.value;
                if (!d) return;
                setEv({ ...ev, start: `${d}T${startT}`, end: `${d}T${endT}` });
              }}
            />
            <label style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto", color: "var(--text-2)" }}>
              <input type="checkbox" checked={ev.allDay} onChange={(e) => setEv({ ...ev, allDay: e.target.checked, start: `${date}T${e.target.checked ? "00:00" : "09:00"}`, end: `${date}T${e.target.checked ? "23:59" : "09:30"}` })} />
              All day
            </label>
          </div>
          {!ev.allDay && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Clock size={15} color="var(--text-3)" />
              <input type="time" className="input" style={{ width: 120 }} step={300} value={startT} onChange={(e) => {
                if (!e.target.value) return;
                const start = `${date}T${e.target.value}`;
                const next = addMinutes(start, Math.max(15, diffMinutes(ev.start, ev.end)));
                setEv({ ...ev, start, end: next.slice(0, 10) === date ? next : `${date}T23:59` });
              }} />
              <span style={{ color: "var(--text-3)" }}>→</span>
              <input type="time" className="input" style={{ width: 120 }} step={300} value={endT} onChange={(e) => setEv({ ...ev, end: `${date}T${e.target.value}` })} />
              {!valid && <span style={{ color: "var(--danger)", fontSize: 12 }}>End must be after start</span>}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <MapPin size={15} color="var(--text-3)" />
            <input className="input" placeholder="Location or link" value={ev.location} onChange={(e) => setEv({ ...ev, location: e.target.value })} />
          </div>
          <textarea
            className="input"
            style={{ height: 80, padding: 8, resize: "none" }}
            placeholder="Description"
            value={ev.notes}
            onChange={(e) => setEv({ ...ev, notes: e.target.value })}
          />
          <div className="swatches">
            {PALETTE.map((c) => (
              <button key={c} className={`swatch ${ev.color === c ? "on" : ""}`} style={{ background: c }} onClick={() => setEv({ ...ev, color: c })} />
            ))}
          </div>
        </div>
        <div className="quick-foot" style={{ margin: 0, padding: "10px 16px" }}>
          <button className="btn ghost" onClick={asTask} title="Convert into a time-blocked task">
            <ListTodo size={14} /> Save as task
          </button>
          <div className="grow" />
          <button className="btn" onClick={close}>
            Cancel
          </button>
          <button className="btn primary" disabled={!valid} onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
