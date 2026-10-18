// Word-level comparison of a speech-recognition transcript against a target
// sentence. This measures how well the TRANSCRIPT matches — it is not an
// acoustic pronunciation score (no phonemes, stress or intonation).

export type WordMatch =
  | { kind: 'match'; expected: string; heard: string }
  | { kind: 'substitution'; expected: string; heard: string }
  | { kind: 'missing'; expected: string }
  | { kind: 'extra'; heard: string };

const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "it's": 'it is',
  "that's": 'that is',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'cannot',
  "won't": 'will not',
  "i've": 'i have',
  "we're": 'we are',
  "they're": 'they are',
  "isn't": 'is not',
  "aren't": 'are not',
  "what's": 'what is',
  "let's": 'let us',
};

export function normalizeWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words.flatMap((w) => (CONTRACTIONS[w] ?? w).split(' ')).map((w) => w.replace(/'/g, ''));
}

/** Levenshtein alignment over words. */
export function alignWords(expectedText: string, heardText: string): WordMatch[] {
  const expected = normalizeWords(expectedText);
  const heard = normalizeWords(heardText);
  const n = expected.length;
  const m = heard.length;
  const dp: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = expected[i - 1] === heard[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const out: WordMatch[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (expected[i - 1] === heard[j - 1] ? 0 : 1)) {
      out.push(
        expected[i - 1] === heard[j - 1]
          ? { kind: 'match', expected: expected[i - 1], heard: heard[j - 1] }
          : { kind: 'substitution', expected: expected[i - 1], heard: heard[j - 1] },
      );
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      out.push({ kind: 'missing', expected: expected[i - 1] });
      i--;
    } else {
      out.push({ kind: 'extra', heard: heard[j - 1] });
      j--;
    }
  }
  return out.reverse();
}

export function matchScore(alignment: WordMatch[]): number {
  const expectedCount = alignment.filter((a) => a.kind !== 'extra').length;
  if (expectedCount === 0) return 0;
  const matched = alignment.filter((a) => a.kind === 'match').length;
  const extras = alignment.filter((a) => a.kind === 'extra').length;
  return Math.max(0, Math.round(((matched - extras * 0.5) / expectedCount) * 100));
}
