/**
 * NormaHub AI Code Review Configuration Loader.
 * Reads optional .normahub-review.yml or .github/normahub-review.yml from workspace.
 */

import fs from 'fs';
import path from 'path';

/**
 * Lightweight zero-dependency YAML parser for key-value, lists, and string properties.
 * @param {string} yamlStr
 * @returns {object}
 */
export function parseSimpleYaml(yamlStr) {
  const result = {
    custom_rules: [],
    ignore_patterns: [],
    language: 'en',
    min_severity: 'SUGGESTION',
  };

  if (!yamlStr || typeof yamlStr !== 'string') {
    return result;
  }

  const lines = yamlStr.split('\n');
  let currentArrayKey = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // Check list item: - "some rule"
    if (line.startsWith('-') && currentArrayKey) {
      let val = line.substring(1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      result[currentArrayKey].push(val);
      continue;
    }

    // Check key: value or key:
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.substring(0, colonIdx).trim();
      const val = line.substring(colonIdx + 1).trim();

      if (['custom_rules', 'ignore_patterns', 'exclude'].includes(key)) {
        currentArrayKey = key === 'exclude' ? 'ignore_patterns' : key;
        if (!result[currentArrayKey]) result[currentArrayKey] = [];
        if (val) {
          result[currentArrayKey].push(val.replace(/^['"]|['"]$/g, ''));
        }
      } else {
        currentArrayKey = null;
        const cleanVal = val.replace(/^['"]|['"]$/g, '');
        if (key === 'language') result.language = cleanVal.toLowerCase();
        if (key === 'min_severity') result.min_severity = cleanVal.toUpperCase();
        if (key === 'model') result.model = cleanVal;
      }
    }
  }

  return result;
}

/**
 * Loads configuration from workspace filesystem.
 * @param {string} [workspaceDir=process.cwd()]
 * @returns {object}
 */
export function loadReviewConfig(workspaceDir = process.cwd()) {
  const possiblePaths = [
    path.join(workspaceDir, '.normahub-review.yml'),
    path.join(workspaceDir, '.normahub-review.yaml'),
    path.join(workspaceDir, '.github', 'normahub-review.yml'),
    path.join(workspaceDir, '.github', 'normahub-review.yaml'),
  ];

  for (const cfgPath of possiblePaths) {
    if (fs.existsSync(cfgPath)) {
      try {
        const content = fs.readFileSync(cfgPath, 'utf8');
        const parsed = parseSimpleYaml(content);
        console.log(`⚙️ Loaded custom review configuration from: ${path.relative(workspaceDir, cfgPath)}`);
        return parsed;
      } catch (e) {
        console.warn(`[NormaHub Config] Failed reading ${cfgPath}: ${e.message}`);
      }
    }
  }

  return {
    custom_rules: [],
    ignore_patterns: [],
    language: 'en',
    min_severity: 'SUGGESTION',
  };
}
