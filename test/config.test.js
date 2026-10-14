import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSimpleYaml } from '../src/config.js';
import { formatReviewComment } from '../src/formatter.js';

test('parseSimpleYaml extracts custom rules, language, and ignore patterns', () => {
  const yamlContent = `
# NormaHub Review Configuration
language: ru
model: claude-sonnet-5-5
min_severity: WARNING

custom_rules:
  - "Verify all database queries use parameterized placeholders"
  - 'Ensure zero unhandled Promise rejections'

ignore_patterns:
  - "dist/**"
  - "*.generated.ts"
`;

  const parsed = parseSimpleYaml(yamlContent);
  assert.equal(parsed.language, 'ru');
  assert.equal(parsed.model, 'claude-sonnet-5-5');
  assert.equal(parsed.min_severity, 'WARNING');
  assert.equal(parsed.custom_rules.length, 2);
  assert.equal(parsed.custom_rules[0], 'Verify all database queries use parameterized placeholders');
  assert.equal(parsed.custom_rules[1], 'Ensure zero unhandled Promise rejections');
  assert.equal(parsed.ignore_patterns.length, 2);
  assert.equal(parsed.ignore_patterns[0], 'dist/**');
});

test('formatReviewComment outputs Summary Scorecard table', () => {
  const mockAnalysis = {
    summary: 'Refactored auth token refresh loop.',
    risk_level: 'HIGH',
    findings: [
      {
        file: 'src/auth.js',
        line: 45,
        severity: 'CRITICAL',
        title: 'Token race condition',
        description: 'Multiple requests trigger concurrent refresh.',
        suggestion: 'await mutex.lock();',
      },
      {
        file: 'src/api.js',
        line: 12,
        severity: 'WARNING',
        title: 'Missing timeout',
        description: 'Fetch call has no signal timeout.',
        suggestion: 'AbortSignal.timeout(5000)',
      },
    ],
    positives: ['Clean promise error handling'],
  };

  const md = formatReviewComment(mockAnalysis, { commitSha: 'abcdef123456' });

  assert.ok(md.includes('### 🤖 NormaHub AI Code Review'));
  assert.ok(md.includes('| Category | Findings | Status |'));
  assert.ok(md.includes('| 🛡️ Security & Critical | 1 | 🔴 Action Required |'));
  assert.ok(md.includes('| ⚠️ Warnings & Reliability | 1 | 🟡 Review Advised |'));
  assert.ok(md.includes('| 💡 Optimization & Suggestions | 0 | ℹ️ 0 Notes |'));
});
