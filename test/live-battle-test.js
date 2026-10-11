import { analyzeDiff } from '../src/analyzer.js';
import { parseAndFilterDiff } from '../src/diff.js';
import { formatReviewComment } from '../src/formatter.js';
const API_KEY = process.env.NORMAHUB_API_KEY;
if (!API_KEY) {
  console.log('Skipping live battle test: NORMAHUB_API_KEY environment variable is not set');
  process.exit(0);
}
// Real-world diff with 2 intentional flaws: SQL injection and unhandled async rejection / memory leak
const REAL_DIFF_BUGGY = `diff --git a/src/services/userService.ts b/src/services/userService.ts
index a123..b456 100644
--- a/src/services/userService.ts
+++ b/src/services/userService.ts
@@ -25,8 +25,18 @@ export class UserService {
   constructor(private db: Database) {}

+  async findUserByEmail(email: string): Promise<User | null> {
+    // Raw string concatenation instead of parameterized query
+    const query = "SELECT * FROM users WHERE email = '" + email + "' LIMIT 1";
+    const result = await this.db.query(query);
+    return result.rows[0] || null;
+  }
+
+  async syncUserTelemetry(userId: string, data: any): Promise<void> {
+    // Fire-and-forget without try/catch or error handling
+    fetch("https://telemetry.internal/collect", {
+      method: "POST",
+      body: JSON.stringify({ userId, data })
+    });
+  }
 }
`;

// Real-world clean diff (good patterns, no flaws)
const REAL_DIFF_CLEAN = `diff --git a/src/utils/math.ts b/src/utils/math.ts
index 111..222 100644
--- a/src/utils/math.ts
+++ b/src/utils/math.ts
@@ -5,6 +5,14 @@ export function clamp(val: number, min: number, max: number): number {
   return Math.min(Math.max(val, min), max);
 }
+
+/**
+ * Safely calculates percentage with division-by-zero protection.
+ */
+export function safePercentage(part: number, total: number): number {
+  if (total <= 0 || !Number.isFinite(total)) return 0;
+  return Math.round((part / total) * 10000) / 100;
+}
`;

async function testScenario(name, diff, model) {
  console.log(`\n========================================`);
  console.log(`Scenario: ${name} [Model: ${model}]`);
  console.log(`========================================`);

  const startTime = Date.now();
  const parsed = parseAndFilterDiff(diff);
  const analysis = await analyzeDiff(parsed.includedDiff, {
    apiKey: API_KEY,
    model,
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`Response time: ${elapsed}s`);
  console.log(`Risk Level: ${analysis.risk_level}`);
  console.log(`Findings count: ${analysis.findings.length}`);
  console.log(`Summary: ${analysis.summary}`);

  const formatted = formatReviewComment(analysis, {
    model,
    commitSha: 'test123',
    reviewedFiles: parsed.reviewedFiles,
  });

  console.log(`\n--- Rendered Markdown Output ---`);
  console.log(formatted);
}

async function main() {
  console.log("Running Live Battle Test against NormaHub API...");
  // 1. Buggy diff on deepseek-v4.1-flash
  await testScenario("Buggy Diff (SQLi + Unhandled Async)", REAL_DIFF_BUGGY, "deepseek-v4.1-flash");

  // 2. Clean diff on deepseek-v4.1-flash
  await testScenario("Clean Diff (Safe Percentage)", REAL_DIFF_CLEAN, "deepseek-v4.1-flash");
}

main().catch(console.error);
