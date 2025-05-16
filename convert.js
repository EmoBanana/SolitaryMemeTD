// convert.js
const bs58 = require("bs58");
const fs = require("fs");
require("dotenv").config();

// Try to get the key from environment variables first
let treasurySecretKey = process.env.TREASURY_SECRET_KEY;

// If not found in environment, import from the separate file
if (!treasurySecretKey) {
  try {
    const {
      TREASURY_SECRET_KEY,
    } = require("./frontend/backend/phantom_keypair.js");
    treasurySecretKey = TREASURY_SECRET_KEY;
  } catch (error) {
    console.error("Error loading TREASURY_SECRET_KEY:", error.message);
    console.error(
      "Please set the TREASURY_SECRET_KEY environment variable or ensure the phantom_keypair.js file exists."
    );
    process.exit(1);
  }
}

// Verify we have a valid key
if (!treasurySecretKey || treasurySecretKey === "REPLACE_WITH_YOUR_KEY") {
  console.error(
    "No valid TREASURY_SECRET_KEY found. Please set the environment variable."
  );
  process.exit(1);
}

try {
  const bytes = bs58.decode(treasurySecretKey); // <Buffer … 64 bytes>
  fs.writeFileSync("phantom-keypair.json", JSON.stringify(Array.from(bytes)));
  console.log(`Wrote ${bytes.length}‑byte key to phantom-keypair.json`);
} catch (error) {
  console.error("Error processing key:", error.message);
  process.exit(1);
}
