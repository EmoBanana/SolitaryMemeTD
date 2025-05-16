// This file provides browser-compatible implementations for @coral-xyz/anchor
// You can import from this file instead of directly from @coral-xyz/anchor

// Import Anchor directly
import * as anchor from "@coral-xyz/anchor";

// Export all the components we use in our app
export const Program = anchor.Program;
export const BN = anchor.BN;
export const AnchorProvider = anchor.AnchorProvider;
export const utils = anchor.utils;
export const Wallet = anchor.Wallet;
export const web3 = anchor.web3;
export const setProvider = anchor.setProvider;
export const getProvider = anchor.getProvider;

// Export as default
export default anchor;

// Add any browser-specific overrides or polyfills here if needed
