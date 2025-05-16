// Import polyfills and initializations first
import "./libs/init";
import "./shims";
import "./polyfills/assert"; // Import the assert polyfill directly

// Then other modules
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Create a global assert if not already available
if (typeof window !== "undefined" && typeof window.assert === "undefined") {
  window.assert = function (condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed");
    }
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
