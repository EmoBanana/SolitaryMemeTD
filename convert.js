// convert.js
const bs58 = require("bs58");
const fs = require("fs");

// *** REPLACE with your own string, keep it offline ***
const secret58 =
  "***REMOVED***";

const bytes = bs58.decode(secret58); // <Buffer … 64 bytes>
fs.writeFileSync("phantom-keypair.json", JSON.stringify(Array.from(bytes)));

// Prints first few numbers just to sanity‑check length, then exits.
console.log(`Wrote ${bytes.length}‑byte key to phantom-keypair.json`);
