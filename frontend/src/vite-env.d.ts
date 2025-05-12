/// <reference types="vite/client" />

// Add JSX namespace to fix React 19 type errors
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
