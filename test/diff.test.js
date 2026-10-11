import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldIgnoreFile, parseAndFilterDiff } from '../src/diff.js';

test('shouldIgnoreFile filters lockfiles and assets', () => {
  assert.equal(shouldIgnoreFile('pnpm-lock.yaml').ignored, true);
  assert.equal(shouldIgnoreFile('package-lock.json').ignored, true);
  assert.equal(shouldIgnoreFile('Cargo.lock').ignored, true);
  assert.equal(shouldIgnoreFile('dist/bundle.js').ignored, true);
  assert.equal(shouldIgnoreFile('src/assets/logo.png').ignored, true);
  assert.equal(shouldIgnoreFile('src/assets/icon.svg').ignored, true);
  assert.equal(shouldIgnoreFile('node_modules/pkg/index.js').ignored, true);

  // Normal code files must not be ignored
  assert.equal(shouldIgnoreFile('src/index.ts').ignored, false);
  assert.equal(shouldIgnoreFile('api/routes.py').ignored, false);
  assert.equal(shouldIgnoreFile('cmd/main.go').ignored, false);
  assert.equal(shouldIgnoreFile('Dockerfile').ignored, false);
});

test('shouldIgnoreFile respects custom ignore patterns', () => {
  const extra = ['\\.gen\\.ts$', '^generated/'];
  assert.equal(shouldIgnoreFile('types.gen.ts', extra).ignored, true);
  assert.equal(shouldIgnoreFile('generated/client.ts', extra).ignored, true);
  assert.equal(shouldIgnoreFile('normal.ts', extra).ignored, false);
});

test('parseAndFilterDiff correctly separates code from noise', () => {
  const sampleDiff = `diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml
index 123..456 100644
--- a/pnpm-lock.yaml
+++ b/pnpm-lock.yaml
@@ -1,3 +1,3 @@
+huge lockfile changes
diff --git a/src/auth.ts b/src/auth.ts
index abc..def 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,3 +10,4 @@
+export function login() { return true; }
`;

  const result = parseAndFilterDiff(sampleDiff);
  assert.equal(result.totalFiles, 2);
  assert.deepEqual(result.reviewedFiles, ['src/auth.ts']);
  assert.deepEqual(result.ignoredFiles, ['pnpm-lock.yaml']);
  assert.ok(result.includedDiff.includes('src/auth.ts'));
  assert.ok(!result.includedDiff.includes('pnpm-lock.yaml'));
  assert.equal(result.isTruncated, false);
});

test('parseAndFilterDiff truncates when budget exceeded', () => {
  const largeDiff = `diff --git a/src/big.ts b/src/big.ts
index 111..222 100644
--- a/src/big.ts
+++ b/src/big.ts
@@ -1,5 +1,5 @@
+${'x'.repeat(200)}
diff --git a/src/second.ts b/src/second.ts
index 333..444 100644
--- a/src/second.ts
+++ b/src/second.ts
@@ -1,5 +1,5 @@
+code
`;

  const result = parseAndFilterDiff(largeDiff, { maxDiffLength: 100 });
  assert.equal(result.isTruncated, true);
});
