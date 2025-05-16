import React, { useEffect, useState } from "react";
// Import directly from our polyfill
import assert from "../polyfills/assert";

const AssertTest: React.FC = () => {
  const [testResults, setTestResults] = useState<
    { name: string; passed: boolean; error?: string }[]
  >([]);

  useEffect(() => {
    const runTests = () => {
      const results: { name: string; passed: boolean; error?: string }[] = [];

      // Test 1: Basic assert
      try {
        assert(true, "This should pass");
        results.push({ name: "Basic assert (true)", passed: true });
      } catch (err: any) {
        results.push({
          name: "Basic assert (true)",
          passed: false,
          error: err.message,
        });
      }

      // Test 2: Basic assert with failure
      try {
        let didThrow = false;
        try {
          assert(false, "This should fail");
        } catch (e) {
          didThrow = true;
        }
        results.push({ name: "Basic assert (false)", passed: didThrow });
      } catch (err: any) {
        results.push({
          name: "Basic assert (false)",
          passed: false,
          error: err.message,
        });
      }

      // Test 3: strictEqual
      try {
        assert.strictEqual(1, 1, "These should be equal");
        results.push({ name: "strictEqual", passed: true });
      } catch (err: any) {
        results.push({
          name: "strictEqual",
          passed: false,
          error: err.message,
        });
      }

      // Test 4: Global assert
      try {
        window.assert && window.assert(true, "Testing global assert");
        results.push({ name: "Global window.assert", passed: !!window.assert });
      } catch (err: any) {
        results.push({
          name: "Global window.assert",
          passed: false,
          error: err.message,
        });
      }

      // Test 5: assert module direct import
      try {
        const assertImport = require("assert");
        if (assertImport) {
          results.push({ name: "Direct assert module import", passed: true });
        } else {
          results.push({
            name: "Direct assert module import",
            passed: false,
            error: "Module not found",
          });
        }
      } catch (err: any) {
        results.push({
          name: "Direct assert module import",
          passed: false,
          error: err.message,
        });
      }

      setTestResults(results);
    };

    runTests();
  }, []);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Assert Module Tests</h1>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Test</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Error</th>
            </tr>
          </thead>
          <tbody>
            {testResults.map((result, index) => (
              <tr key={index} className="border-t">
                <td className="px-4 py-2">{result.name}</td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block px-2 py-1 rounded ${
                      result.passed
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {result.passed ? "PASS" : "FAIL"}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-red-600">
                  {result.error || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssertTest;
