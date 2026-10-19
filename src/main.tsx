import React from "react";
import ReactDOM from "react-dom/client";
import { isTauri, windowLabel } from "./api";
import { App } from "./App";
import { useTheme } from "./theme";
import { QuickWindow } from "./components/QuickAdd";
import { useStore } from "./store";
import "./styles.css";

function QuickRoot() {
  useTheme();
  return <QuickWindow />;
}

async function boot() {
  if (!isTauri) document.body.classList.add("browser");
  if (import.meta.env.DEV) (window as unknown as { __aq: typeof useStore }).__aq = useStore;
  const label = await windowLabel();
  await useStore.getState().load({ seed: label === "main" });
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>{label === "quick" ? <QuickRoot /> : <App />}</React.StrictMode>,
  );
}

boot();
