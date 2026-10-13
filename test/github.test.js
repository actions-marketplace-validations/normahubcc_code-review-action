import test from 'node:test';
import assert from 'node:assert/strict';
import { createPullRequestReview, findExistingBotComment } from '../src/github.js';

test('createPullRequestReview formats inline comments and suggestions correctly', async () => {
  let interceptedUrl = '';
  let interceptedPayload = null;

  // Mock fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    interceptedUrl = url;
    interceptedPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 998877 }),
    };
  };

  try {
    const findings = [
      {
        file: 'src/auth.ts',
        line: 42,
        severity: 'CRITICAL',
        title: 'SQL Injection Vulnerability',
        description: 'Raw string concatenation in SQL query.',
        suggestion: 'const q = db.prepare("SELECT * FROM users WHERE id = ?").bind(userId);',
      },
      {
        file: 'src/utils.ts',
        line: 15,
        severity: 'WARNING',
        title: 'Missing null check',
        description: 'Object may be undefined.',
        suggestion: '```suggestion\nif (!obj) return null;\n```',
      },
      {
        // Ignored: missing line
        file: 'README.md',
        title: 'Typo',
        description: 'Spelling error',
      },
    ];

    const result = await createPullRequestReview(
      'https://api.github.com',
      'normahubcc/test-repo',
      123,
      'commit123sha',
      'Overall Summary Body',
      findings,
      'fake-token'
    );

    assert.equal(result.action, 'review_created');
    assert.equal(result.id, 998877);
    assert.equal(result.inlineCount, 2);

    assert.equal(interceptedUrl, 'https://api.github.com/repos/normahubcc/test-repo/pulls/123/reviews');
    assert.equal(interceptedPayload.commit_id, 'commit123sha');
    assert.equal(interceptedPayload.event, 'COMMENT');
    assert.equal(interceptedPayload.body, 'Overall Summary Body');
    assert.equal(interceptedPayload.comments.length, 2);

    // Check first inline comment
    const c1 = interceptedPayload.comments[0];
    assert.equal(c1.path, 'src/auth.ts');
    assert.equal(c1.line, 42);
    assert.equal(c1.side, 'RIGHT');
    assert.ok(c1.body.includes('🔴 SQL Injection Vulnerability'));
    assert.ok(c1.body.includes('```suggestion\nconst q = db.prepare'));

    // Check second inline comment strips redundant outer ```suggestion fence
    const c2 = interceptedPayload.comments[1];
    assert.equal(c2.path, 'src/utils.ts');
    assert.equal(c2.line, 15);
    assert.ok(c2.body.includes('🟡 Missing null check'));
    assert.ok(c2.body.includes('```suggestion\nif (!obj) return null;\n```'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('findExistingBotComment identifies bot comment by signature', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [
      { id: 1, body: 'Just a normal developer comment' },
      { id: 2, body: 'Review from user <!-- normahub-code-review-bot -->\nDetailed report' },
    ],
  });

  try {
    const id = await findExistingBotComment('https://api.github.com', 'owner/repo', 1, 'token');
    assert.equal(id, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
