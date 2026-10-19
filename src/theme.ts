import { useEffect } from "react";
import { setClock24 } from "./dates";
import { useStore } from "./store";

/** Applies the light/dark theme and clock format from settings. */
export function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  const clock24 = useStore((s) => s.settings.clock24);
  setClock24(clock24 === "1");
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme !== "light" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}
