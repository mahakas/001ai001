import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./themes/tokens.css";
import "./themes/shell.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("MAHAK shell root element #root is missing");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
