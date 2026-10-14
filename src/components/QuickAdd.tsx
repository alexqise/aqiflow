import { CornerDownLeft, Zap } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, isTauri } from "../api";
import { useStore } from "../store";
import type { Task } from "../types";
import { Keys } from "./common";
import { commitParsed, Tokens, useParsed } from "./Composer";

function QuickForm({ defaults, onClose, autoFocusKey }: { defaults?: Partial<Task>; onClose: (created: Task | null) => void; autoFocusKey?: number }) {
  const [text, setText] = useState(defaults?.title ?? "");
  const parsed = useParsed(text);
  const ref = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, [autoFocusKey]);

  const submit = (keepOpen: boolean) => {
    const t = commitParsed(parsed, { ...defaults, title: undefined });
    if (!t) return;
    setText("");
    setCount((c) => c + 1);
    if (!keepOpen) onClose(t);
  };

  return (
    <div className="quick">
      <div className="quick-input">
        <Zap size={18} color="var(--accent)" />
        <input
          ref={ref}
          value={text}
          placeholder="What do you need to do?"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit(e.metaKey || e.shiftKey);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose(null);
            }
          }}
        />
      </div>
      <div className="token-row" style={{ paddingLeft: 28 }}>
        <Tokens parsed={parsed} defaults={defaults} />
        {!parsed.tokens.length && <span className="hint">Try “Email Alex tomorrow 9am for 15m #work !1”</span>}
      </div>
      <div className="quick-foot">
        <span className="hint">{count > 0 ? `${count} added · ` : ""}⇧↵ add another</span>
        <div className="grow" />
        <span className="hint" style={{ display: "flex", gap: 3, alignItems: "center" }}>
          <Keys keys="esc" /> close
        </span>
        <button className="btn primary" style={{ height: 28 }} disabled={!parsed.title} onClick={() => submit(false)}>
          Add task <CornerDownLeft size={13} />
        </button>
      </div>
    </div>
  );
}

/** In-app quick add modal (⌘N). */
export function QuickAddModal() {
  const defaults = useStore((s) => s.quickAdd.defaults);
  const close = (t: Task | null) => {
    const s = useStore.getState();
    s.set({ quickAdd: { open: false } });
    if (t) s.showToast(`Added “${t.title.slice(0, 40)}”`);
  };
  return (
    <div className="overlay" onMouseDown={() => close(null)}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <QuickForm defaults={defaults} onClose={close} />
      </div>
    </div>
  );
}

/** The global quick-capture window summoned by the system-wide shortcut. */
export function QuickWindow() {
  const [openCount, setOpenCount] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.background = "transparent";
    if (!isTauri) return;
    let un: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) =>
      listen("quick-open", () => {
        useStore.getState().load();
        setOpenCount((c) => c + 1);
      }).then((u) => (un = u)),
    );
    return () => un?.();
  }, []);

  // Size the native window to the card.
  useLayoutEffect(() => {
    if (!isTauri || !cardRef.current) return;
    const el = cardRef.current;
    const ro = new ResizeObserver(async () => {
      const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
      getCurrentWindow().setSize(new LogicalSize(680, Math.ceil(el.getBoundingClientRect().height) + 16));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="quick-window">
      <div className="card" ref={cardRef}>
        <QuickForm
          key={openCount}
          autoFocusKey={openCount}
          defaults={{}}
          onClose={() => {
            api.hideQuick();
          }}
        />
      </div>
    </div>
  );
}
