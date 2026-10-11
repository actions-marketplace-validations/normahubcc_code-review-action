import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonFromResponse } from '../src/analyzer.js';

test('extractJsonFromResponse extracts valid JSON inside markdown block', () => {
  const modelText = `Here is my review:
\`\`\`json
{
  "summary": "Fixes race condition in checkout.",
  "risk_level": "HIGH",
  "findings": [
    {
      "file": "src/checkout.ts",
      "line": 15,
      "severity": "CRITICAL",
      "title": "Missing transaction lock",
      "description": "Double spend possible without lock.",
      "suggestion": "await lock.acquire();"
    }
  ],
  "positives": ["Good test coverage added."]
}
\`\`\`
Hope this helps!`;

  const parsed = extractJsonFromResponse(modelText);
  assert.equal(parsed.summary, 'Fixes race condition in checkout.');
  assert.equal(parsed.risk_level, 'HIGH');
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0].severity, 'CRITICAL');
  assert.equal(parsed.positives.length, 1);
});

test('extractJsonFromResponse falls back cleanly on non-JSON text', () => {
  const rawText = 'I found a bug in line 42 of index.js: unhandled null pointer.';
  const parsed = extractJsonFromResponse(rawText);
  assert.equal(parsed.risk_level, 'MEDIUM');
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0].description, rawText);
});
