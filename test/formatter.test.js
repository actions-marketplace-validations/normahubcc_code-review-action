import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReviewComment, BOT_SIGNATURE } from '../src/formatter.js';

test('formatReviewComment produces valid markdown with signature', () => {
  const analysis = {
    summary: 'Refactored user authentication service.',
    risk_level: 'LOW',
    findings: [],
    positives: ['Clean architecture', 'Added unit tests'],
  };

  const md = formatReviewComment(analysis, {
    model: 'deepseek-v4.1-flash',
    commitSha: 'a1b2c3d4e5',
    reviewedFiles: ['src/auth.ts', 'src/user.ts'],
    ignoredFiles: ['pnpm-lock.yaml'],
  });

  assert.ok(md.includes(BOT_SIGNATURE));
  assert.ok(md.includes('🟢 **Risk Level: LOW**'));
  assert.ok(md.includes('No critical bugs or security vulnerabilities found'));
  assert.ok(md.includes('Filtered Non-Code Files'));
  assert.ok(md.includes('deepseek-v4.1-flash'));
});

test('formatReviewComment groups critical findings and suggestions', () => {
  const analysis = {
    summary: 'Added payment webhook handler.',
    risk_level: 'HIGH',
    findings: [
      {
        file: 'src/webhook.ts',
        line: 88,
        severity: 'CRITICAL',
        title: 'Unverified Webhook Signature',
        description: 'Requests are processed without verifying cryptographic HMAC.',
        suggestion: 'verifySignature(req.headers["x-signature"]);',
      },
      {
        file: 'src/webhook.ts',
        line: 120,
        severity: 'WARNING',
        title: 'Unhandled error on db failure',
        description: 'Missing catch block around db call.',
        suggestion: 'try { ... } catch (e) { ... }',
      },
    ],
    positives: [],
  };

  const md = formatReviewComment(analysis, {
    model: 'claude-sonnet-5-5',
    commitSha: '1234567890',
    reviewedFiles: ['src/webhook.ts'],
    ignoredFiles: [],
  });

  assert.ok(md.includes('🔴 **Risk Level: HIGH**'));
  assert.ok(md.includes('Critical & Security Issues (1)'));
  assert.ok(md.includes('Warnings & Edge Cases (1)'));
  assert.ok(md.includes('Unverified Webhook Signature'));
  assert.ok(md.includes('Suggested fix'));
  assert.ok(md.includes('claude-sonnet-5-5'));
});
