import React from "react";
import ReactDOM from "react-dom/client";
import { isTauri, windowLabel } from "./api";
import { App, useTheme } from "./App";
import { QuickWindow } from "./components/QuickAdd";
import { useStore } from "./store";
import "./styles.css";

function QuickRoot() {
  useTheme();
  return <QuickWindow />;
}

async function boot() {
  if (!isTauri) document.body.classList.add("browser");
  const label = await windowLabel();
  await useStore.getState().load({ seed: label === "main" });
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>{label === "quick" ? <QuickRoot /> : <App />}</React.StrictMode>,
  );
}

boot();
