import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.tsx";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element for PipeFlow Warehouse UI.");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
