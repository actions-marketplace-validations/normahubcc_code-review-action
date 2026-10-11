/**
 * NormaHub AI Code Review Markdown Formatter.
 * Renders structured review findings into a compact, collapsible GitHub PR dashboard.
 */

export const BOT_SIGNATURE = '<!-- normahub-code-review-bot -->';

const SEVERITY_CONFIG = {
  CRITICAL: {
    emoji: '🔴',
    label: 'Critical / Security',
  },
  WARNING: {
    emoji: '🟡',
    label: 'Warning / Edge Case',
  },
  SUGGESTION: {
    emoji: '💡',
    label: 'Suggestion',
  },
};

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

  const parts = [
    BOT_SIGNATURE,
    `### 🤖 NormaHub AI Code Review &nbsp; ${riskBadge}`,
    '',
    `> **Commit:** \`${commitSha}\` &nbsp;|&nbsp; **Files Reviewed:** ${reviewedFiles.length} &nbsp;|&nbsp; **Noise Filtered:** ${ignoredFiles.length}${isTruncated ? ' &nbsp;|&nbsp; ⚠️ *Diff partially truncated*' : ''}`,
    '',
    `**Summary:** ${analysis.summary}`,
    '',
  ];

  if (findings.length === 0) {
    parts.push(
      '---',
      '#### ✅ No critical bugs or security vulnerabilities found',
      'The changes appear safe, logically sound, and ready for maintainer review.',
      ''
    );
  } else {
    // Group findings by severity
    const criticals = findings.filter((f) => f.severity === 'CRITICAL');
    const warnings = findings.filter((f) => f.severity === 'WARNING');
    const suggestions = findings.filter((f) => f.severity === 'SUGGESTION' || !f.severity);

    const renderGroup = (title, items, icon) => {
      if (items.length === 0) return;
      parts.push(`---`, `#### ${icon} ${title} (${items.length})`, '');

      for (const item of items) {
        const location = item.line ? `\`${item.file}:${item.line}\`` : `\`${item.file}\``;
        parts.push(`- **${item.title || 'Observation'}** in ${location}`);
        parts.push(`  ${item.description}`);

        if (item.suggestion && item.suggestion.trim()) {
          parts.push(
            '  <details><summary>💡 Suggested fix</summary>',
            '',
            item.suggestion.startsWith('```') ? `  ${item.suggestion}` : `  \`\`\`suggestion\n  ${item.suggestion}\n  \`\`\``,
            '  </details>',
            ''
          );
        } else {
          parts.push('');
        }
      }
    };

    renderGroup('Critical & Security Issues', criticals, '🔴');
    renderGroup('Warnings & Edge Cases', warnings, '🟡');
    renderGroup('Suggestions & Improvements', suggestions, '💡');
  }

  // Highlighted positives (collapsible)
  if (positives.length > 0) {
    parts.push(
      '<details><summary><b>🌟 Highlighted Strengths (' + positives.length + ')</b></summary>',
      '',
      ...positives.map((p) => `- ${p}`),
      '</details>',
      ''
    );
  }

  // Ignored / filtered files list (collapsible)
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
