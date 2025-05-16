// This file provides browser-compatible implementations for @coral-xyz/anchor
// You can import from this file instead of directly from @coral-xyz/anchor

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
import "@coral-xyz/anchor";

// No modifications - just direct re-export
export * from "@coral-xyz/anchor";
export { default } from "@coral-xyz/anchor";

// Add any browser-specific overrides or polyfills here if needed
