import * as anchor from "@project-serum/anchor";

// Re-export everything from anchor
export * from "@project-serum/anchor";

// Setup browser-specific configurations for Anchor
export const setupAnchorForBrowser = () => {
  // Any browser-specific setup can go here
  console.log("Anchor setup for browser environment");
};

// Export anchor as a named export to avoid default export issues
export { anchor };

// Export a singleton instance that can be used throughout the app
export const getAnchorInstance = () => {
  return anchor;
};
