/**
 * GitHub API Client for NormaHub Code Review Action.
 * Handles fetching PR diffs and idempotent comment updates (anti-spam).
 */

import { BOT_SIGNATURE } from './formatter.js';

/**
 * Fetches the unified diff of a pull request.
 * @param {string} apiUrl
 * @param {string} repo
 * @param {number|string} prNumber
 * @param {string} token
 * @returns {Promise<string>}
 */
export async function fetchPullRequestDiff(apiUrl, repo, prNumber, token) {
  const url = `${apiUrl}/repos/${repo}/pulls/${prNumber}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3.diff',
      'User-Agent': 'NormaHub-Code-Review-Action',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch PR diff (${res.status}): ${errText}`);
  }

  return await res.text();
}

/**
 * Searches for an existing comment on the PR posted by this action.
 * @param {string} apiUrl
 * @param {string} repo
 * @param {number|string} prNumber
 * @param {string} token
 * @returns {Promise<number|null>} commentId if found, null otherwise
 */
export async function findExistingBotComment(apiUrl, repo, prNumber, token) {
  const url = `${apiUrl}/repos/${repo}/issues/${prNumber}/comments?per_page=100`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'NormaHub-Code-Review-Action',
    },
  });

  if (!res.ok) {
    return null;
  }

  const comments = await res.json();
  if (!Array.isArray(comments)) return null;

  for (const comment of comments) {
    if (comment.body && comment.body.includes(BOT_SIGNATURE)) {
      return comment.id;
    }
  }

  return null;
}

/**
 * Posts a new review comment or updates an existing one (anti-spam).
 * @param {string} apiUrl
 * @param {string} repo
 * @param {number|string} prNumber
 * @param {string} body
 * @param {string} token
 * @returns {Promise<{ action: 'created'|'updated', id: number }>}
 */
export async function postOrUpdateComment(apiUrl, repo, prNumber, body, token) {
  const existingId = await findExistingBotComment(apiUrl, repo, prNumber, token);

  if (existingId) {
    // Update existing comment
    const patchUrl = `${apiUrl}/repos/${repo}/issues/comments/${existingId}`;
    const res = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'NormaHub-Code-Review-Action',
      },
      body: JSON.stringify({ body }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to update comment #${existingId} (${res.status}): ${errText}`);
    }

    return { action: 'updated', id: existingId };
  } else {
    // Create new comment
    const postUrl = `${apiUrl}/repos/${repo}/issues/${prNumber}/comments`;
    const res = await fetch(postUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'NormaHub-Code-Review-Action',
      },
      body: JSON.stringify({ body }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to post new comment (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return { action: 'created', id: data.id };
  }
}

/**
 * Creates a formal GitHub Pull Request Review with inline comments.
 * Enables interactive 1-click 'Commit suggestion' buttons in GitHub UI.
 * @param {string} apiUrl
 * @param {string} repo
 * @param {number|string} prNumber
 * @param {string} commitSha
 * @param {string} body
 * @param {Array<{file: string, line: number, severity?: string, title?: string, description?: string, suggestion?: string}>} findings
 * @param {string} token
 * @returns {Promise<{ action: 'review_created', id: number, inlineCount: number }>}
 */
export async function createPullRequestReview(apiUrl, repo, prNumber, commitSha, body, findings = [], token) {
  const postUrl = `${apiUrl}/repos/${repo}/pulls/${prNumber}/reviews`;

  const inlineComments = findings
    .filter((f) => f && f.file && f.line && !isNaN(Number(f.line)))
    .map((f) => {
      const emoji = f.severity === 'CRITICAL' ? '🔴' : f.severity === 'WARNING' ? '🟡' : '💡';
      let commentBody = `### ${emoji} ${f.title || 'Code Finding'}\n\n${f.description || ''}`;
      if (f.suggestion && f.suggestion.trim()) {
        const cleanSugg = f.suggestion.replace(/^```(?:suggestion)?\s*/i, '').replace(/\s*```$/i, '');
        commentBody += `\n\n\`\`\`suggestion\n${cleanSugg}\n\`\`\``;
      }
      return {
        path: f.file,
        line: Number(f.line),
        side: 'RIGHT',
        body: commentBody,
      };
    });

  const payload = {
    body,
    event: 'COMMENT',
  };

  if (commitSha) {
    payload.commit_id = commitSha;
  }

  if (inlineComments.length > 0) {
    payload.comments = inlineComments;
  }

  const res = await fetch(postUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'NormaHub-Code-Review-Action',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create PR review (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return { action: 'review_created', id: data.id, inlineCount: inlineComments.length };
}

