/**
 * Smart Diff Parser & Filter for NormaHub Code Review Action.
 * Filters out lockfiles, assets, generated bundles, and vendors.
 */

const DEFAULT_IGNORED_PATTERNS = [
  // Lockfiles
  /pnpm-lock\.yaml$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /Cargo\.lock$/,
  /poetry\.lock$/,
  /Gemfile\.lock$/,
  /composer\.lock$/,
  /mix\.lock$/,
  /go\.sum$/,

  // Minified, bundled & map files
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.bundle\.js$/,

  // Assets and media
  /\.(png|jpe?g|gif|svg|ico|webp|avif|pdf|mp4|webm|wasm|woff2?|eot|ttf)$/i,

  // Compiled & vendor directories
  /(^|\/)(dist|build|out|\.next|node_modules|vendor|target|coverage|\.git)\//,
];

/**
 * Checks whether a file path should be ignored during code review.
 * @param {string} filePath
 * @param {Array<RegExp|string>} extraPatterns
 * @returns {{ ignored: boolean, reason?: string }}
 */
export function shouldIgnoreFile(filePath, extraPatterns = []) {
  if (!filePath) return { ignored: true, reason: 'Empty file path' };

  for (const pattern of DEFAULT_IGNORED_PATTERNS) {
    if (pattern.test(filePath)) {
      return { ignored: true, reason: 'Standard noise / lockfile / asset' };
    }
  }

  for (const extra of extraPatterns) {
    const rx = extra instanceof RegExp ? extra : new RegExp(extra);
    if (rx.test(filePath)) {
      return { ignored: true, reason: `Matches custom pattern: ${extra}` };
    }
  }

  return { ignored: false };
}

/**
 * Parses raw git diff string into structured file entries and filters noise.
 * @param {string} rawDiff
 * @param {object} options
 * @param {number} [options.maxDiffLength=50000]
 * @param {Array<string>} [options.extraIgnorePatterns=[]]
 * @returns {{ includedDiff: string, totalFiles: number, reviewedFiles: string[], ignoredFiles: string[], isTruncated: boolean }}
 */
export function parseAndFilterDiff(rawDiff, options = {}) {
  const maxDiffLength = options.maxDiffLength || 50000;
  const extraPatterns = (options.extraIgnorePatterns || [])
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => new RegExp(p));

  if (!rawDiff || typeof rawDiff !== 'string') {
    return {
      includedDiff: '',
      totalFiles: 0,
      reviewedFiles: [],
      ignoredFiles: [],
      isTruncated: false,
    };
  }

  // Split diff into per-file chunks by "diff --git "
  const rawChunks = rawDiff.split(/(?=diff --git )/g);

  const reviewedFiles = [];
  const ignoredFiles = [];
  const includedChunks = [];
  let currentLength = 0;
  let isTruncated = false;

  for (const chunk of rawChunks) {
    if (!chunk.trim()) continue;

    // Extract file path from header: diff --git a/path/to/file b/path/to/file
    const headerMatch = chunk.match(/diff --git a\/(.+?) b\/(.+?)(\n|\r\n)/);
    const filePath = headerMatch ? headerMatch[2] : '';

    if (!filePath) {
      continue;
    }

    const { ignored } = shouldIgnoreFile(filePath, extraPatterns);
    if (ignored) {
      ignoredFiles.push(filePath);
      continue;
    }

    if (currentLength + chunk.length > maxDiffLength) {
      isTruncated = true;
      // If we haven't included any chunk yet, include a truncated version of the first
      if (includedChunks.length === 0) {
        const remaining = maxDiffLength - currentLength;
        includedChunks.push(chunk.substring(0, remaining) + '\n... [chunk truncated]');
        reviewedFiles.push(filePath);
      }
      break;
    }

    includedChunks.push(chunk);
    reviewedFiles.push(filePath);
    currentLength += chunk.length;
  }

  return {
    includedDiff: includedChunks.join(''),
    totalFiles: reviewedFiles.length + ignoredFiles.length,
    reviewedFiles,
    ignoredFiles,
    isTruncated,
  };
}
