// IMPORTANT: This file is in .gitignore to prevent exposing private keys
// NEVER commit this file to Git with real keys
// For production, use environment variables instead

// The treasury secret key - loaded from environment variable
// You must set this environment variable before running the server
// For local development: set TREASURY_SECRET_KEY=your_key_here
// For production: use secure environment variable storage

const TREASURY_SECRET_KEY =
  process.env.TREASURY_SECRET_KEY || "REPLACE_WITH_YOUR_KEY";

// If no key is provided, warn the developer
if (TREASURY_SECRET_KEY === "REPLACE_WITH_YOUR_KEY") {
  console.warn(
    "WARNING: No TREASURY_SECRET_KEY environment variable set. Using placeholder value."
  );
}

module.exports = { TREASURY_SECRET_KEY };
