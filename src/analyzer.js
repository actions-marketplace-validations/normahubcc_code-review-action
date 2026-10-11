/**
 * NormaHub AI Code Review Analyzer.
 * Communicates with NormaHub API, instructs models with senior review guidelines,
 * and parses structured JSON findings.
 */

const NORMAHUB_ENDPOINT = 'https://api.normahub.cc/v1/chat/completions';

const SYSTEM_PROMPT = `You are a Principal Software Engineer and Application Security Auditor performing an automated code review on a GitHub Pull Request.

Your goal is to provide high-signal, actionable feedback that developers actually appreciate.

GUIDELINES:
1. DO NOT comment on code formatting, whitespace, indentations, or semicolon placement. Linters (ESLint, Prettier, Ruff) handle style.
2. FOCUS STRICTLY ON:
   - Security Vulnerabilities: injection flaws, unescaped inputs, hardcoded secrets/tokens, SSRF, IDOR, auth bypass.
   - Critical Bugs & Logic Errors: unhandled null/undefined, race conditions, unhandled async promise rejections, off-by-one errors.
   - Resource & Memory Leaks: unclosed database/HTTP connections, unclosed file descriptors, dangling event listeners.
   - Performance Regressions: N+1 query loops, unintended O(N^2) complexity on large collections.
3. If the code is well-written and contains no critical flaws, set "risk_level" to "LOW" and keep "findings" empty. DO NOT invent fake issues.
4. Always provide concrete, minimal replacement code snippets in "suggestion" when pointing out a bug.

REQUIRED JSON OUTPUT FORMAT:
Output ONLY a single valid JSON object, enclosed inside a \`\`\`json markdown fence, with this exact schema:
{
  "summary": "1-2 sentences summarizing the PR change",
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "findings": [
    {
      "file": "path/to/file.ext",
      "line": 42,
      "severity": "CRITICAL" | "WARNING" | "SUGGESTION",
      "title": "Short descriptive title",
      "description": "Precise explanation of what could go wrong and why",
      "suggestion": "Clean replacement code snippet or pattern"
    }
  ],
  "positives": ["Optional bullet points highlighting good practices or clean architecture"]
}`;

/**
 * Parses and sanitizes JSON from model response text.
 * @param {string} rawText
 * @returns {object}
 */
export function extractJsonFromResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      summary: 'Automated review completed.',
      risk_level: 'LOW',
      findings: [],
      positives: [],
    };
  }

  // 1. Try extracting content inside ```json ... ```
  const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = match ? match[1].trim() : rawText.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      summary: parsed.summary || 'Code review completed.',
      risk_level: ['LOW', 'MEDIUM', 'HIGH'].includes(parsed.risk_level) ? parsed.risk_level : 'LOW',
      findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      positives: Array.isArray(parsed.positives) ? parsed.positives : [],
    };
  } catch (err) {
    // Fallback: If not valid JSON, treat as unstructured summary
    return {
      summary: rawText.substring(0, 500),
      risk_level: 'MEDIUM',
      findings: [
        {
          file: 'General',
          line: 0,
          severity: 'SUGGESTION',
          title: 'Review Summary',
          description: rawText,
          suggestion: '',
        },
      ],
      positives: [],
    };
  }
}

/**
 * Invokes NormaHub API to analyze the given git diff.
 * @param {string} diff
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string} [options.model='deepseek-v4.1-flash']
 * @param {number} [options.temperature=0.1]
 * @returns {Promise<object>}
 */
export async function analyzeDiff(diff, options = {}) {
  const apiKey = options.apiKey;
  const model = options.model || 'deepseek-v4.1-flash';
  const temperature = options.temperature !== undefined ? options.temperature : 0.1;

  if (!apiKey) {
    throw new Error('NORMAHUB_API_KEY is required for analysis.');
  }

  const payload = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Perform a code review on the following Pull Request diff:\n\n\`\`\`diff\n${diff}\n\`\`\``,
      },
    ],
    temperature,
  };

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(NORMAHUB_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`NormaHub API HTTP ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('NormaHub API returned empty message content.');
      }

      return extractJsonFromResponse(content);
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        await new Promise((res) => setTimeout(res, 1000 * attempt));
      }
    }
  }

  throw lastError;
}
