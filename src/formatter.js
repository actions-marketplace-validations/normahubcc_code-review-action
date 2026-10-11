/**
 * NormaHub AI Code Review Markdown Formatter.
 * Renders structured review findings into a compact, collapsible GitHub PR dashboard.
 */

export const BOT_SIGNATURE = '<!-- normahub-code-review-bot -->';

const RISK_BADGES = {
  HIGH: '🔴 **Risk Level: HIGH**',
  MEDIUM: '🟡 **Risk Level: MEDIUM**',
  LOW: '🟢 **Risk Level: LOW**',
};

/**
 * Formats review data into production-grade GitHub PR markdown.
 * @param {object} analysis
 * @param {object} metadata
 * @param {string} [metadata.model='deepseek-v4.1-flash']
 * @param {string} [metadata.commitSha='']
 * @param {string[]} [metadata.reviewedFiles=[]]
 * @param {string[]} [metadata.ignoredFiles=[]]
 * @param {boolean} [metadata.isTruncated=false]
 * @returns {string}
 */
export function formatReviewComment(analysis, metadata = {}) {
  const model = metadata.model || 'deepseek-v4.1-flash';
  const commitSha = metadata.commitSha ? metadata.commitSha.substring(0, 7) : 'HEAD';
  const reviewedFiles = metadata.reviewedFiles || [];
  const ignoredFiles = metadata.ignoredFiles || [];
  const isTruncated = metadata.isTruncated || false;

  const riskBadge = RISK_BADGES[analysis.risk_level] || RISK_BADGES.LOW;
  const findings = analysis.findings || [];
  const positives = analysis.positives || [];

  const criticals = findings.filter((f) => f.severity === 'CRITICAL');
  const warnings = findings.filter((f) => f.severity === 'WARNING');
  const suggestions = findings.filter((f) => f.severity === 'SUGGESTION' || !f.severity);

  // Clear 1-second executive verdict
  let verdict = '✅ **Verdict: Clean to merge** (no blocking issues)';
  if (criticals.length > 0) {
    verdict = `🚨 **Verdict: Blocked** (${criticals.length} critical issue${criticals.length > 1 ? 's' : ''} require attention)`;
  } else if (warnings.length > 0) {
    verdict = `⚠️ **Verdict: Caution** (${warnings.length} warning${warnings.length > 1 ? 's' : ''} detected)`;
  }

  const parts = [
    BOT_SIGNATURE,
    `### 🤖 NormaHub AI Code Review &nbsp; ${riskBadge}`,
    '',
    `> ${verdict}  `,
    `> **Commit:** \`${commitSha}\` &nbsp;|&nbsp; **Files:** ${reviewedFiles.length} &nbsp;|&nbsp; **Noise Filtered:** ${ignoredFiles.length}${isTruncated ? ' &nbsp;|&nbsp; ⚠️ *Diff partially truncated*' : ''}`,
    '',
    `**Summary:** ${analysis.summary}`,
    '',
  ];

  if (findings.length === 0) {
    parts.push(
      '---',
      '#### ✅ No critical bugs or security vulnerabilities found',
      'The changes appear safe, logically sound, and ready for review.',
      ''
    );
  } else {
    // 1. Critical issues (Always expanded, prominent)
    if (criticals.length > 0) {
      parts.push(`---`, `#### 🔴 Critical & Security Issues (${criticals.length})`, '');
      for (const item of criticals) {
        const location = item.line ? `\`${item.file}:${item.line}\`` : `\`${item.file}\``;
        parts.push(`- **${item.title || 'Security/Critical Flaw'}** in ${location}`);
        parts.push(`  ${item.description}`);
        if (item.suggestion && item.suggestion.trim()) {
          const suggCode = item.suggestion.startsWith('```') ? item.suggestion : `\`\`\`suggestion\n${item.suggestion}\n\`\`\``;
          parts.push('  <details><summary>💡 Suggested fix</summary>', '', `  ${suggCode}`, '  </details>', '');
        } else {
          parts.push('');
        }
      }
    }

    // 2. Warnings & Edge cases (Always expanded, actionable)
    if (warnings.length > 0) {
      parts.push(`---`, `#### 🟡 Warnings & Edge Cases (${warnings.length})`, '');
      for (const item of warnings) {
        const location = item.line ? `\`${item.file}:${item.line}\`` : `\`${item.file}\``;
        parts.push(`- **${item.title || 'Warning'}** in ${location}`);
        parts.push(`  ${item.description}`);
        if (item.suggestion && item.suggestion.trim()) {
          const suggCode = item.suggestion.startsWith('```') ? item.suggestion : `\`\`\`suggestion\n${item.suggestion}\n\`\`\``;
          parts.push('  <details><summary>💡 Suggested fix</summary>', '', `  ${suggCode}`, '  </details>', '');
        } else {
          parts.push('');
        }
      }
    }

    // 3. Minor suggestions (Collapsed under details to avoid developer overthinking and visual fatigue)
    if (suggestions.length > 0) {
      parts.push(
        `---`,
        `<details><summary><b>💡 Minor Suggestions & Code Improvements (${suggestions.length})</b></summary>`,
        ''
      );
      for (const item of suggestions) {
        const location = item.line ? `\`${item.file}:${item.line}\`` : `\`${item.file}\``;
        parts.push(`- **${item.title || 'Suggestion'}** in ${location}`);
        parts.push(`  ${item.description}`);
        if (item.suggestion && item.suggestion.trim()) {
          const suggCode = item.suggestion.startsWith('```') ? item.suggestion : `\`\`\`suggestion\n${item.suggestion}\n\`\`\``;
          parts.push('  <details><summary>Suggested fix</summary>', '', `  ${suggCode}`, '  </details>', '');
        } else {
          parts.push('');
        }
      }
      parts.push('</details>', '');
    }
  }

  // Highlighted strengths (Collapsed)
  if (positives.length > 0) {
    parts.push(
      '<details><summary><b>🌟 Highlighted Strengths (' + positives.length + ')</b></summary>',
      '',
      ...positives.map((p) => `- ${p}`),
      '</details>',
      ''
    );
  }

  // Ignored / filtered files list (Collapsed)
  if (ignoredFiles.length > 0) {
    parts.push(
      '<details><summary><b>Filtered Non-Code Files (' + ignoredFiles.length + ')</b></summary>',
      '',
      ...ignoredFiles.map((f) => `- \`${f}\``),
      '</details>',
      ''
    );
  }

  // Footer
  parts.push(
    '---',
    `<sub>Automated review powered by [NormaHub API](https://normahub.cc) · Model: \`${model}\`</sub>`
  );

  return parts.join('\n');
}
