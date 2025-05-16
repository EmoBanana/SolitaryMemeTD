// Import shims and polyfills first
import "./shims";

// Import other modules
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Required for Solana
import { Buffer } from "buffer";
window.Buffer = Buffer;

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
