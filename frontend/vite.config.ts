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
    }),
  ],
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  define: {
    "process.env": {},
    global: {},
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
      define: {
        global: "globalThis",
      },
    },
    include: ["@project-serum/anchor", "@coral-xyz/anchor", "@solana/web3.js"],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: [
        "@project-serum/anchor",
        "@coral-xyz/anchor",
        "buffer",
        "crypto",
        "stream",
        "assert",
        "util",
      ],
    },
  },
});
