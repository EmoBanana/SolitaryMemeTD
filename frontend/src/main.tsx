// Import initialization first
import "./libs/init";

// Then polyfills and shims
import "./shims";

// Import other modules
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Buffer is now handled by the polyfills file

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
