// This file provides browser-compatible implementations for @project-serum/anchor
// You can import from this file instead of directly from @project-serum/anchor

// Import polyfills
import "./polyfills/assert";

// Ensure browser compatibility
if (typeof window !== "undefined") {
  // Add any needed browser-specific overrides here
  window.assert =
    window.assert ||
    function (val: any, msg?: string) {
      if (!val) throw new Error(msg || "Assertion failed");
    };
}

// Simply re-export anchor from the package
import "@project-serum/anchor";

// No modifications - just direct re-export
export * from "@project-serum/anchor";
export { default } from "@project-serum/anchor";

// Add any browser-specific overrides or polyfills here if needed
