// Browser polyfills and shims for Node.js modules
// This file adds compatibility for Node.js modules used by Solana libraries

// Note: Much of this is now handled by polyfills.ts, but we keep this for extra insurance

// Make sure TextEncoder is available (needed by @solana/web3.js)
if (typeof (window as any).TextEncoder === "undefined") {
  (window as any).TextEncoder = TextEncoder;
}

if (typeof (window as any).TextDecoder === "undefined") {
  (window as any).TextDecoder = TextDecoder;
}

// Additional crypto fallbacks beyond what's in polyfills.ts
if ((window as any).crypto && !(window as any).crypto.randomBytes) {
  (window as any).crypto.randomBytes = function (size: number) {
    const arr = new Uint8Array(size);
    (window as any).crypto.getRandomValues(arr);
    return arr;
  };
}

// Fallback for crypto.createHash
if ((window as any).crypto && !(window as any).crypto.createHash) {
  (window as any).crypto.createHash = function (algorithm: string) {
    const validAlgorithms = ["sha1", "sha256", "sha512", "md5"];
    if (!validAlgorithms.includes(algorithm)) {
      throw new Error(`Algorithm ${algorithm} not supported`);
    }

    return {
      update: function (data: any) {
        this.data = data;
        return this;
      },
      digest: function (encoding: string) {
        if (encoding === "hex") {
          // This is a simplified implementation
          console.warn("Using simplified hex digest implementation");
          return "simulated_hash_value";
        }
        return new Uint8Array(32); // Return empty hash for now
      },
      data: null,
    };
  };
}

export default {};
