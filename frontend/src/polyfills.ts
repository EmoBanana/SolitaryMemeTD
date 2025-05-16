// Polyfill Node.js core modules in Webpack/Vite
import { Buffer } from "buffer";

// Make Buffer globally available
window.Buffer = Buffer;

// This ensures the global Buffer is available
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

// Polyfill process
import process from "process";
window.process = process;

// Ensure global is defined
if (typeof window.global === "undefined") {
  window.global = window;
}

// Initialize anchor in the browser
import { setupAnchorForBrowser } from "./utils/anchor-helpers";
try {
  setupAnchorForBrowser();
} catch (error) {
  console.warn("Failed to initialize Anchor:", error);
}
