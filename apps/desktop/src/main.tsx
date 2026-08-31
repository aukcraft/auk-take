import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// RNW global styles: reset + system font
document.documentElement.style.margin = "0";
document.body.style.margin = "0";
document.body.style.fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

createRoot(document.getElementById("root")!).render(<App />);
