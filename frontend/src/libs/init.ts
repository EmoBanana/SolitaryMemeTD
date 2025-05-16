// This file initializes all the libraries we need to prevent initialization order issues

// Import buffer polyfill
import { Buffer } from "buffer";
if (typeof window !== "undefined") {
  window.Buffer = Buffer;
}

// Import process
import process from "process";
if (typeof window !== "undefined") {
  window.process = process;
}

// Make sure global is defined
if (typeof window !== "undefined" && typeof window.global === "undefined") {
  window.global = window;
}
