import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.tsx";
import { installPreviewBridge } from "./mock-bridge.ts";

installPreviewBridge();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element for PipeFlow POS UI.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
