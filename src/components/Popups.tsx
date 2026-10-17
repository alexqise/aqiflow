import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../store";
import { Keys } from "./common";
import { MenuIcon } from "./icons";

export function ContextMenu() {
  const menu = useStore((s) => s.menu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(-1);
  const close = () => useStore.getState().set({ menu: null });

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: Math.min(menu.x, window.innerWidth - r.width - 6), y: Math.min(menu.y, window.innerHeight - r.height - 6) });
    setActive(-1);
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const items = menu.items;
    const selectable = items.map((it, i) => (it.separator ? -1 : i)).filter((i) => i >= 0);
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => {
          const k = selectable.indexOf(a);
          const n = e.key === "ArrowDown" ? (k + 1) % selectable.length : (k - 1 + selectable.length) % selectable.length;
          return selectable[k < 0 && e.key === "ArrowUp" ? selectable.length - 1 : n];
        });
      }
      if (e.key === "Enter") {
        setActive((a) => {
          if (a >= 0) {
            close();
            items[a].onSelect?.();
          }
          return a;
        });
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", close);
    };
  }, [menu]);

  if (!menu) return null;
  return (
    <div className="popover" ref={ref} style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      {menu.items.map((it, i) =>
        it.separator ? (
          <div key={i} className="menu-sep" />
        ) : (
          <button
            key={i}
            className={`menu-item ${it.danger ? "danger" : ""} ${i === active ? "active" : ""}`}
            onMouseEnter={() => setActive(i)}
            onClick={() => {
              close();
              it.onSelect?.();
            }}
          >
            <MenuIcon name={it.icon} />
            <span className="label">{it.label}</span>
            {it.shortcut && <kbd>{it.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="toast" key={toast.id}>
      {toast.message}
      {toast.undo && (
        <button
          onClick={() => {
            toast.undo!();
            useStore.getState().set({ toast: null });
          }}
        >
          Undo <span style={{ opacity: 0.6, fontWeight: 500 }}>⌘Z</span>
        </button>
      )}
      <button style={{ color: "#888", padding: "0 6px" }} onClick={() => useStore.getState().set({ toast: null })}>
        <X size={14} />
      </button>
    </div>
  );
}

const SHORTCUTS: [string, [string, string][]][] = [
  [
    "General",
    [
      ["Command bar", "mod K"],
      ["New task", "N"],
      ["Global quick add (anywhere)", "⇧ mod Space"],
      ["Plan your day", "⇧ mod P"],
      ["Toggle calendar panel", "mod \\"],
      ["Settings", "mod ,"],
      ["Undo", "mod Z"],
      ["Show shortcuts", "?"],
    ],
  ],
  [
    "Navigation",
    [
      ["Inbox", "G I"],
      ["Today", "G T"],
      ["Upcoming", "G U"],
      ["Calendar", "G C"],
      ["Someday", "G S"],
      ["Done", "G D"],
      ["Day ratings", "G R"],
      ["Move selection", "J K"],
      ["Views 1–7", "mod 1"],
    ],
  ],
  [
    "Selected task",
    [
      ["Open", "↵"],
      ["Complete", "E"],
      ["Do today", "T"],
      ["Do tomorrow", "M"],
      ["Schedule…", "S"],
      ["Someday", "Z"],
      ["Priority high / med / low / none", "1 2 3 0"],
      ["Goal of the day", "G G"],
      ["Start focus", "F"],
      ["Duplicate", "mod D"],
      ["Delete", "⌫"],
    ],
  ],
  [
    "Calendar",
    [
      ["Previous / next", "[ ]"],
      ["Go to today", "."],
      ["Day / 3-day / week", "D W"],
    ],
  ],
];

export function ShortcutsHelp() {
  const close = () => useStore.getState().set({ shortcutsOpen: false });
  return (
    <div className="overlay" onMouseDown={close}>
      <div className="modal wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="detail-top">
          <strong style={{ color: "var(--text)", paddingLeft: 8 }}>Keyboard shortcuts</strong>
          <div className="grow" />
          <button className="icon-btn" onClick={close}>
            <X size={16} />
          </button>
        </div>
        <div className="shortcuts-grid">
          {SHORTCUTS.map(([group, list]) => (
            <Group key={group} group={group} list={list} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Group({ group, list }: { group: string; list: [string, string][] }) {
  return (
    <>
      <h5>{group}</h5>
      {list.map(([label, keys]) => (
        <div className="sc" key={label}>
          <span>{label}</span>
          <span>
            <Keys keys={keys} />
          </span>
        </div>
      ))}
    </>
  );
}
