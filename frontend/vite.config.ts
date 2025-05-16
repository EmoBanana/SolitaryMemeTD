import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      include: [
        "buffer",
        "process",
        "util",
        "stream",
        "events",
        "crypto",
        "assert",
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    alias: {
      "@": resolve(__dirname, "src"),
      assert: resolve(__dirname, "src/assert.ts"),
      crypto: resolve(__dirname, "node_modules/crypto-browserify"),
      stream: resolve(__dirname, "node_modules/stream-browserify"),
      util: resolve(__dirname, "node_modules/util"),
    },
    dedupe: [
      "react",
      "react-dom",
      "@project-serum/anchor",
      "@coral-xyz/anchor",
    ],
  },
  define: {
    "process.env": {},
    global: "window",
    assert: "window.assert",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
      define: {
        global: "globalThis",
        assert: "window.assert",
      },
    },
    include: [
      "@project-serum/anchor",
      "@coral-xyz/anchor",
      "@solana/web3.js",
      "buffer",
      "react",
      "react-dom",
    ],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          anchor: ["@project-serum/anchor", "@coral-xyz/anchor"],
          solana: ["@solana/web3.js"],
        },
      },
    },
  },
});
