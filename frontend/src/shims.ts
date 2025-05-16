// Browser polyfills and shims for Node.js modules
// This file adds compatibility for Node.js modules used by Solana libraries

// Polyfill global for browsers
if (typeof global === "undefined") {
  (window as any).global = window;
}

// Browser polyfill for process
if (typeof process === "undefined") {
  (window as any).process = {
    env: {},
    browser: true,
    version: "",
    versions: {},
    nextTick: function (fn: Function) {
      setTimeout(fn, 0);
    },
  };
}

// Provide fallbacks for Node.js crypto functions
if ((window as any).crypto && !(window as any).crypto.randomBytes) {
  (window as any).crypto.randomBytes = function (size: number) {
    const arr = new Uint8Array(size);
    (window as any).crypto.getRandomValues(arr);
    return arr;
  };
}

export default {};
