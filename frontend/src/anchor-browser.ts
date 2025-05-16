// This file provides browser-compatible implementations for @project-serum/anchor
// You can import from this file instead of directly from @project-serum/anchor

// Import from the browser dist
import * as anchor from "@project-serum/anchor/dist/browser";

// Make sure we're exporting critical classes and utilities
const {
  Program,
  BN,
  AnchorProvider,
  utils,
  Wallet,
  web3,
  workspace,
  setProvider,
  getProvider,
  Provider,
} = anchor;

// Re-export all the anchor components
export {
  Program,
  BN,
  AnchorProvider,
  utils,
  Wallet,
  web3,
  workspace,
  setProvider,
  getProvider,
  Provider,
};

// Also export as default
export default anchor;

// Add any browser-specific overrides or polyfills here if needed
