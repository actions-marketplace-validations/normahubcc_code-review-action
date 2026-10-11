#!/usr/bin/env node

/**
 * NormaHub AI Code Review Action
 * Zero-dependency Node.js script for automated PR code reviews via NormaHub API.
 */

const NORMAHUB_API_KEY = process.env.NORMAHUB_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const MODEL = process.env.INPUT_MODEL || "deepseek-v4.1-flash";
const MAX_DIFF_LEN = parseInt(process.env.INPUT_MAX_DIFF_LENGTH || "45000", 10);
const PR_NUMBER = process.env.PR_NUMBER;
const REPO = process.env.GITHUB_REPOSITORY;
const API_URL = process.env.GITHUB_API_URL || "https://api.github.com";

if (!NORMAHUB_API_KEY) {
  console.error("::error::NORMAHUB_API_KEY is required.");
  process.exit(1);
}

if (!GITHUB_TOKEN) {
  console.error("::error::GITHUB_TOKEN is required.");
  process.exit(1);
}

if (!PR_NUMBER || !REPO) {
  console.log("No pull request detected in context. Skipping review.");
  process.exit(0);
}

async function main() {
  console.log(`Starting NormaHub Code Review for ${REPO}#${PR_NUMBER} using model ${MODEL}...`);

  // 1. Fetch PR Diff
  const diffRes = await fetch(`${API_URL}/repos/${REPO}/pulls/${PR_NUMBER}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3.diff",
      "User-Agent": "NormaHub-Code-Review-Action",
    },
  });

  if (!diffRes.ok) {
    const errText = await diffRes.text();
    console.error(`::error::Failed to fetch PR diff: ${diffRes.status} ${errText}`);
    process.exit(1);
  }

  let diff = await diffRes.text();

  if (!diff || diff.trim().length === 0) {
    console.log("Empty diff. Nothing to review.");
    process.exit(0);
  }

  if (diff.length > MAX_DIFF_LEN) {
    console.log(`Diff is large (${diff.length} chars). Truncating to ${MAX_DIFF_LEN} chars.`);
    diff = diff.substring(0, MAX_DIFF_LEN) + "\n\n... [diff truncated for length]";
  }

  // 2. Call NormaHub API
  console.log(`Sending diff (${diff.length} chars) to NormaHub API...`);

  const systemPrompt = `You are a software engineer performing a constructive, high-signal Pull Request review.
Review the provided git diff carefully.
Structure your review into:
1. **Summary:** 1-2 sentences summarizing the change.
2. **Key Findings:** Security issues, edge-case bugs, race conditions, or logic errors (if any).
3. **Suggestions:** Concrete, minimal code improvements or refactoring advice.
If the code looks good with no issues, state that clearly and concisely.
Keep your response professional, concise, and actionable without filler words.`;

  const nhRes = await fetch("https://api.normahub.cc/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NORMAHUB_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Review this Pull Request diff:\n\n\`\`\`diff\n${diff}\n\`\`\`` },
      ],
      temperature: 0.3,
    }),
  });

  if (!nhRes.ok) {
    const nhErr = await nhRes.text();
    console.error(`::error::NormaHub API request failed (${nhRes.status}): ${nhErr}`);
    process.exit(1);
  }

  const nhData = await nhRes.json();
  const reviewContent = nhData.choices?.[0]?.message?.content;

  if (!reviewContent) {
    console.error("::error::NormaHub API returned empty completion.");
    process.exit(1);
  }

  // 3. Post Comment to PR
  const commentBody = `### 🤖 NormaHub AI Code Review

${reviewContent}

---
<sub>Reviewed with [NormaHub API](https://normahub.cc) · Model: \`${MODEL}\`</sub>`;

  console.log("Posting review comment to PR...");
  const commentRes = await fetch(`${API_URL}/repos/${REPO}/issues/${PR_NUMBER}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "NormaHub-Code-Review-Action",
    },
    body: JSON.stringify({ body: commentBody }),
  });

  if (!commentRes.ok) {
    const commentErr = await commentRes.text();
    console.error(`::error::Failed to post comment to PR: ${commentRes.status} ${commentErr}`);
    process.exit(1);
  }

  console.log("Successfully posted NormaHub code review!");
}

main().catch((err) => {
  console.error("::error::Unexpected error during review:", err);
  process.exit(1);
});
