// convert.js
const bs58 = require("bs58");
const fs = require("fs");

// *** REPLACE with your own string, keep it offline ***
const secret58 =
  "5Tk3LG8dWKL4Xpj8DaAi68muebuh5iAgC7u2puQfzcBpe1kM4xDrV8TMvji2e3qPEaV4bcyRsQWGo7JnaGZjEXD";

const bytes = bs58.decode(secret58); // <Buffer … 64 bytes>
fs.writeFileSync("phantom-keypair.json", JSON.stringify(Array.from(bytes)));

// Prints first few numbers just to sanity‑check length, then exits.
console.log(`Wrote ${bytes.length}‑byte key to phantom-keypair.json`);
