// This file provides a browser-compatible implementation of the Node.js 'assert' module

function assert(condition: boolean, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

// Common assert methods
assert.ok = assert;
assert.strictEqual = (actual: any, expected: any, message?: string): void => {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
};

assert.deepStrictEqual = (
  actual: any,
  expected: any,
  message?: string
): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Deep equality check failed`);
  }
};

assert.notStrictEqual = (
  actual: any,
  expected: any,
  message?: string
): void => {
  if (actual === expected) {
    throw new Error(
      message || `Expected values to be different, but both are ${actual}`
    );
  }
};

export default assert;
export { assert };
