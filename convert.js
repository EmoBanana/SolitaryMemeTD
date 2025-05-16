// convert.js
const bs58 = require("bs58");
const fs = require("fs");

// Import private key from the separate file
const {
  TREASURY_SECRET_KEY,
} = require("./frontend/backend/phantom_keypair.js");

const bytes = bs58.decode(TREASURY_SECRET_KEY); // <Buffer … 64 bytes>
fs.writeFileSync("phantom-keypair.json", JSON.stringify(Array.from(bytes)));

// Prints first few numbers just to sanity‑check length, then exits.
console.log(`Wrote ${bytes.length}‑byte key to phantom-keypair.json`);
