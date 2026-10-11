#!/usr/bin/env node

/**
 * NormaHub AI Code Review Action - Main Entrypoint
 */

import { parseAndFilterDiff } from './diff.js';
import { analyzeDiff } from './analyzer.js';
import { formatReviewComment } from './formatter.js';
import { fetchPullRequestDiff, postOrUpdateComment } from './github.js';

const NORMAHUB_API_KEY = process.env.NORMAHUB_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const MODEL = process.env.INPUT_MODEL || 'deepseek-v4.1-flash';
const MAX_DIFF_LEN = parseInt(process.env.INPUT_MAX_DIFF_LENGTH || '50000', 10);
const IGNORE_PATTERNS = (process.env.INPUT_IGNORE_PATTERNS || '')
  .split(/[,\n]/)
  .map((s) => s.trim())
  .filter(Boolean);

const PR_NUMBER = process.env.PR_NUMBER;
const REPO = process.env.GITHUB_REPOSITORY;
const API_URL = process.env.GITHUB_API_URL || 'https://api.github.com';
const COMMIT_SHA = process.env.INPUT_COMMIT_SHA || process.env.GITHUB_SHA || '';

if (!NORMAHUB_API_KEY) {
  console.error('::error::NORMAHUB_API_KEY is missing. Please provide it in secrets.');
  process.exit(1);
}

if (!GITHUB_TOKEN) {
  console.error('::error::GITHUB_TOKEN is missing. Provide ${{ secrets.GITHUB_TOKEN }}.');
  process.exit(1);
}

if (!PR_NUMBER || !REPO) {
  console.log('No pull request detected in context. Skipping code review.');
  process.exit(0);
}

async function run() {
  const startTime = Date.now();
  console.log(`🚀 Starting NormaHub Code Review`);
  console.log(`Repository: ${REPO}#${PR_NUMBER}`);
  console.log(`Model: ${MODEL}`);

  // 1. Fetch raw diff
  console.log('📥 Fetching pull request diff from GitHub...');
  const rawDiff = await fetchPullRequestDiff(API_URL, REPO, PR_NUMBER, GITHUB_TOKEN);

  // 2. Filter noise
  const parsed = parseAndFilterDiff(rawDiff, {
    maxDiffLength: MAX_DIFF_LEN,
    extraIgnorePatterns: IGNORE_PATTERNS,
  });

  console.log(`📊 Diff Statistics:`);
  console.log(`- Reviewed files: ${parsed.reviewedFiles.length}`);
  console.log(`- Filtered files: ${parsed.ignoredFiles.length}`);
  console.log(`- Total diff size: ${parsed.includedDiff.length} characters`);

  if (!parsed.includedDiff.trim()) {
    console.log('✨ All files in this PR were filtered out (assets, lockfiles, or vendor files). Skipping AI analysis.');
    process.exit(0);
  }

  // 3. Analyze diff via NormaHub API
  console.log(`🧠 Invoking NormaHub API with model ${MODEL}...`);
  const analysis = await analyzeDiff(parsed.includedDiff, {
    apiKey: NORMAHUB_API_KEY,
    model: MODEL,
  });

  console.log(`🔍 Analysis finished. Risk Level: ${analysis.risk_level}, Findings: ${analysis.findings.length}`);

  // 4. Format comment markdown
  const commentMarkdown = formatReviewComment(analysis, {
    model: MODEL,
    commitSha: COMMIT_SHA,
    reviewedFiles: parsed.reviewedFiles,
    ignoredFiles: parsed.ignoredFiles,
    isTruncated: parsed.isTruncated,
  });

  // 5. Post or update comment on GitHub (idempotent)
  console.log('💬 Publishing review comment to PR...');
  const result = await postOrUpdateComment(API_URL, REPO, PR_NUMBER, commentMarkdown, GITHUB_TOKEN);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`✅ Review successfully ${result.action} (comment ID: ${result.id}) in ${duration}s!`);
}

run().catch((err) => {
  console.error('::error::Code review failed:', err.message);
  process.exit(1);
});
