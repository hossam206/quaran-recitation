import { normalizeArabic } from "./quran-data";
import { ComparisonResult, Mistake } from "./types";

/**
 * Compare recognized recitation against the expected verse text.
 * Uses Longest Common Subsequence (LCS) to align words and detect:
 * - Wrong words (substitutions)
 * - Missing words (in expected but not recited)
 * - Extra words (recited but not in expected)
 *
 * Returns a score (0-100) and structured mistake list.
 */
export function compareRecitation(
  recognized: string,
  expected: string
): ComparisonResult {
  const recWords = normalizeArabic(recognized).split(" ").filter(Boolean);
  const expWords = normalizeArabic(expected).split(" ").filter(Boolean);

  if (expWords.length === 0) {
    return { score: 100, mistakes: [] };
  }

  if (recWords.length === 0) {
    // Nothing recognized — every word is missing
    const mistakes: Mistake[] = expWords.map((word, i) => ({
      type: "missing" as const,
      position: i,
      expected: word,
    }));
    return { score: 0, mistakes };
  }

  // Build LCS table
  const m = recWords.length;
  const n = expWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (recWords[i - 1] === expWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find alignment
  const alignment: Array<{
    type: "match" | "wrong" | "missing" | "extra";
    expIdx?: number;
    recIdx?: number;
  }> = [];

  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && recWords[i - 1] === expWords[j - 1]) {
      alignment.unshift({ type: "match", expIdx: j - 1, recIdx: i - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      alignment.unshift({ type: "missing", expIdx: j - 1 });
      j--;
    } else {
      alignment.unshift({ type: "extra", recIdx: i - 1 });
      i--;
    }
  }

  // Convert adjacent missing+extra pairs at the same position into "wrong" mistakes
  const mistakes: Mistake[] = [];
  let ai = 0;

  while (ai < alignment.length) {
    const item = alignment[ai];

    if (
      item.type === "extra" &&
      ai + 1 < alignment.length &&
      alignment[ai + 1].type === "missing"
    ) {
      // Substitution: user said a wrong word in place of the expected one
      mistakes.push({
        type: "wrong",
        position: alignment[ai + 1].expIdx!,
        expected: expWords[alignment[ai + 1].expIdx!],
        actual: recWords[item.recIdx!],
      });
      ai += 2;
    } else if (
      item.type === "missing" &&
      ai + 1 < alignment.length &&
      alignment[ai + 1].type === "extra"
    ) {
      mistakes.push({
        type: "wrong",
        position: item.expIdx!,
        expected: expWords[item.expIdx!],
        actual: recWords[alignment[ai + 1].recIdx!],
      });
      ai += 2;
    } else if (item.type === "missing") {
      mistakes.push({
        type: "missing",
        position: item.expIdx!,
        expected: expWords[item.expIdx!],
      });
      ai++;
    } else if (item.type === "extra") {
      // Find the closest expected position for context
      const nearestExpIdx = findNearestExpectedPosition(alignment, ai);
      mistakes.push({
        type: "extra",
        position: nearestExpIdx,
        actual: recWords[item.recIdx!],
      });
      ai++;
    } else {
      // Match — no mistake
      ai++;
    }
  }

  // Score: percentage of expected words that were correctly recited
  const correctWords = expWords.length - mistakes.filter((m) => m.type !== "extra").length;
  const score = Math.max(0, Math.round((correctWords / expWords.length) * 100));

  return { score, mistakes };
}

function findNearestExpectedPosition(
  alignment: Array<{ type: string; expIdx?: number }>,
  currentIdx: number
): number {
  // Look backward then forward for the nearest expected position
  for (let offset = 1; offset < alignment.length; offset++) {
    if (currentIdx - offset >= 0 && alignment[currentIdx - offset].expIdx !== undefined) {
      return alignment[currentIdx - offset].expIdx! + 1;
    }
    if (currentIdx + offset < alignment.length && alignment[currentIdx + offset].expIdx !== undefined) {
      return alignment[currentIdx + offset].expIdx!;
    }
  }
  return 0;
}
