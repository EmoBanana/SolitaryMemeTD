// This is a simple polyfill for the Node.js assert module for browser environments

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

// Add common assert methods
assert.ok = assert;

assert.equal = (actual, expected, message) => {
  if (actual != expected) {
    // loose equality check
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
};

assert.strictEqual = (actual, expected, message) => {
  if (actual !== expected) {
    // strict equality check
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
};

assert.deepEqual = (actual, expected, message) => {
  // Simple deep equality check
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(message || `Deep equality check failed`);
  }
};

assert.deepStrictEqual = assert.deepEqual; // Simplified version

assert.notEqual = (actual, expected, message) => {
  if (actual == expected) {
    throw new Error(
      message || `Expected ${actual} to be different from ${expected}`
    );
  }
};

assert.notStrictEqual = (actual, expected, message) => {
  if (actual === expected) {
    throw new Error(
      message || `Expected ${actual} to be different from ${expected}`
    );
  }
};

assert.throws = (block, error, message) => {
  let threw = false;

  try {
    block();
  } catch (e) {
    threw = true;

    if (error) {
      if (error instanceof RegExp) {
        if (!error.test(e.message)) {
          throw new Error(
            message ||
              `Expected error message to match ${error}, got ${e.message}`
          );
        }
      } else if (typeof error === "function") {
        if (!(e instanceof error)) {
          throw new Error(
            message || `Expected error to be instance of ${error.name}`
          );
        }
      }
    }
  }

  if (!threw) {
    throw new Error(message || "Expected function to throw");
  }
};

// Make available globally if in a browser environment
if (typeof window !== "undefined") {
  window.assert = assert;
}

export default assert;

// Also provide named export
export { assert };
