import { Verse, WordIndexedVerse } from "./types";
import surahsData from "@/data/surahs.json";
import quranData from "@/data/quran.json";
import quranWordsData from "@/data/quran-words.json";

export interface Surah {
  number: number;
  name: string;
  englishName: string;
}

// Type for quran-words.json structure
type QuranWordsData = Record<string, WordIndexedVerse[]>;

// Type for the quran.json structure
type QuranData = Record<string, Array<{ chapter: number; verse: number; text: string }>>;

// ─── Pre-compiled regex patterns (created once at module load, not per call) ───
const RE_DIACRITICS = /[\u064B-\u065F]/g;
const RE_ARABIC_SIGNS = /[\u0610-\u061A]/g;
const RE_QURANIC_ANNOTATIONS = /[\u06D6-\u06ED]/g;
const RE_ADDITIONAL_MARKS = /[\u0653-\u0656]/g;
const RE_SUPERSCRIPT_ALEF = /\u0670/g;
const RE_ALEF_VARIANTS = /[\u0623\u0625\u0622\u0671]/g;
const RE_ALEF_MAQSURA = /\u0649/g;
const RE_TAA_MARBUTA = /\u0629/g;
const RE_HAMZA_WAW = /\u0624/g;
const RE_HAMZA_YA = /\u0626/g;
const RE_TATWEEL = /\u0640/g;
const RE_SMALL_SIGNS = /[\u06D6-\u06ED\u06E1\u06E5\u06E6]/g;
const RE_WHITESPACE = /\s+/g;

// Pre-compiled letter mapping regexes (longest patterns first for greedy matching)
const LETTER_MAPPINGS: [RegExp, string][] = [
  // 5-word patterns
  [/كاف هاء ياء عين صاد/g, "كهيعص"],
  [/كاف ها يا عين صاد/g, "كهيعص"],
  [/حاء ميم عين سين قاف/g, "حمعسق"],
  [/حا ميم عين سين قاف/g, "حمعسق"],
  // 4-word patterns
  [/ألف لام ميم صاد/g, "المص"],
  [/الف لام ميم صاد/g, "المص"],
  [/الف لا ميم صاد/g, "المص"],
  [/ألف لام ميم راء/g, "المر"],
  [/الف لام ميم راء/g, "المر"],
  [/الف لا ميم راء/g, "المر"],
  // 3-word patterns
  [/ألف لام ميم/g, "الم"],
  [/الف لام ميم/g, "الم"],
  [/ألف لا ميم/g, "الم"],
  [/الف لا ميم/g, "الم"],
  [/ا لام ميم/g, "الم"],
  [/ألف لام راء/g, "الر"],
  [/الف لام راء/g, "الر"],
  [/ألف لا راء/g, "الر"],
  [/الف لا راء/g, "الر"],
  [/الف لام را/g, "الر"],
  [/طا سين ميم/g, "طسم"],
  [/طاء سين ميم/g, "طسم"],
  // 2-word patterns
  [/طا ها/g, "طه"],
  [/طاء ها/g, "طه"],
  [/طاء هاء/g, "طه"],
  [/يا سين/g, "يس"],
  [/يا س/g, "يس"],
  [/ياء سين/g, "يس"],
  [/حا ميم/g, "حم"],
  [/حاء ميم/g, "حم"],
  [/طا سين/g, "طس"],
  [/طاء سين/g, "طس"],
];

const SINGLE_LETTER_MAPPINGS: [RegExp, string][] = [
  [/(^|\s)صاد($|\s)/g, "$1ص$2"],
  [/(^|\s)قاف($|\s)/g, "$1ق$2"],
  [/(^|\s)نون($|\s)/g, "$1ن$2"],
];

/**
 * Strip Arabic diacritics (tashkeel) for comparison purposes.
 */
export function stripDiacritics(text: string): string {
  return text
    .replace(RE_DIACRITICS, "")
    .replace(RE_ARABIC_SIGNS, "")
    .replace(RE_QURANIC_ANNOTATIONS, "")
    .replace(RE_ADDITIONAL_MARKS, "");
}

/**
 * Normalize Arabic text for comparison:
 * - Convert superscript alef to regular alef (preserves the sound)
 * - Strip diacritics
 * - Handle Quranic letter sequences (الم, الر, etc.)
 * - Normalize alef variants to plain alef
 * - Normalize taa marbuta to haa
 * - Normalize hamza carriers (ؤ→و, ئ→ي)
 * - Collapse whitespace
 */
export function normalizeArabic(text: string): string {
  // Convert superscript alef to regular alef BEFORE stripping diacritics.
  let normalized = text.replace(RE_SUPERSCRIPT_ALEF, "\u0627");

  // Strip tatweel (ـ kashida) — Quranic text has 147+ of these, speech API never outputs them
  normalized = normalized.replace(RE_TATWEEL, "");
  // Strip small Quranic annotation signs (ۡ ۥ ۦ etc.)
  normalized = normalized.replace(RE_SMALL_SIGNS, "");

  normalized = stripDiacritics(normalized);

  for (const [pattern, replacement] of LETTER_MAPPINGS) {
    normalized = normalized.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of SINGLE_LETTER_MAPPINGS) {
    normalized = normalized.replace(pattern, replacement);
  }

  // Normalize alef variants (أ إ آ ٱ) → ا
  normalized = normalized.replace(RE_ALEF_VARIANTS, "\u0627");
  // Normalize alef maqsura (ى) → ya (ي)
  normalized = normalized.replace(RE_ALEF_MAQSURA, "\u064A");
  // Normalize taa marbuta → haa
  normalized = normalized.replace(RE_TAA_MARBUTA, "\u0647");
  // Normalize hamza carriers — speech recognition often drops the hamza
  normalized = normalized.replace(RE_HAMZA_WAW, "\u0648");
  normalized = normalized.replace(RE_HAMZA_YA, "\u064A");
  // Strip isolated hamza — mobile speech API sometimes outputs standalone ء
  normalized = normalized.replace(/\u0621/g, "");
  // Normalize waw-alef sequences — mobile sometimes outputs "وا" oddly
  normalized = normalized.replace(/\u0648\u0627\u0648/g, "\u0648\u0648");
  // Collapse whitespace
  normalized = normalized.replace(RE_WHITESPACE, " ").trim();
  return normalized;
}

/**
 * Levenshtein edit distance (single-row optimized).
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }

  return dp[n];
}

/**
 * Strip the Arabic definite article "ال" prefix for comparison.
 * The Web Speech API often drops or adds it inconsistently.
 */
function stripDefiniteArticle(word: string): string {
  if (word.length >= 3 && word.startsWith("\u0627\u0644")) {
    return word.slice(2);
  }
  return word;
}

/**
 * Strip leading "و" (waw conjunction) — mobile speech API
 * often merges/splits it inconsistently.
 */
function stripWawConjunction(word: string): string {
  if (word.length >= 3 && word.startsWith("\u0648")) {
    return word.slice(1);
  }
  return word;
}

/**
 * Fuzzy match two Arabic words, tolerating speech recognition variance.
 * Tuned for mobile where the speech API is significantly less accurate.
 *
 * Strategy (checked in order):
 * 1. Exact match
 * 2. Match after stripping definite article "ال" from either side
 * 3. Match after stripping waw conjunction "و" from either side
 * 4. One word is a prefix/suffix of the other (≥50% overlap)
 * 5. Levenshtein distance scaled by word length (relaxed for mobile)
 */
export function fuzzyMatchArabic(spoken: string, expected: string): boolean {
  if (spoken === expected) return true;
  if (!spoken || !expected) return false;

  // Single-char words: exact only (ب، و، etc. are too ambiguous)
  if (expected.length <= 1 && spoken.length <= 1) return spoken === expected;

  // 2-char words: allow Levenshtein ≤ 1 (من، في، ما, هو — common in Qur'an)
  if (expected.length <= 2 || spoken.length <= 2) {
    return levenshteinDistance(spoken, expected) <= 1;
  }

  // Check after stripping definite article — speech API often drops "ال"
  const spokenBare = stripDefiniteArticle(spoken);
  const expectedBare = stripDefiniteArticle(expected);
  if (spokenBare === expectedBare) return true;

  // Check with Levenshtein on bare forms too
  if (spokenBare.length >= 2 && expectedBare.length >= 2) {
    if (levenshteinDistance(spokenBare, expectedBare) <= 1) return true;
  }

  // Check after stripping waw conjunction — mobile merges/splits "و" often
  const spokenNoWaw = stripWawConjunction(spoken);
  const expectedNoWaw = stripWawConjunction(expected);
  if (spokenNoWaw === expectedNoWaw) return true;
  if (spokenNoWaw === expectedBare || spokenBare === expectedNoWaw) return true;

  // Prefix/suffix containment — mobile speech API truncates/extends words
  const shorter = spoken.length <= expected.length ? spoken : expected;
  const longer = spoken.length > expected.length ? spoken : expected;
  if (shorter.length >= 2) {
    if (
      (longer.startsWith(shorter) || longer.endsWith(shorter)) &&
      shorter.length / longer.length >= 0.5
    ) {
      return true;
    }
  }

  // Levenshtein distance — relaxed thresholds for mobile speech API accuracy
  const maxLen = Math.max(spoken.length, expected.length);
  const distance = levenshteinDistance(spoken, expected);

  if (maxLen <= 3) return distance <= 1;
  if (maxLen <= 5) return distance <= 2;
  if (maxLen <= 8) return distance <= 3;
  return distance <= 4;
}

// Get all surahs
export function getAvailableSurahs(): Surah[] {
  return surahsData as Surah[];
}

// Get a specific surah by number
export function getSurah(surahNumber: number): Surah | undefined {
  return (surahsData as Surah[]).find((s) => s.number === surahNumber);
}

// Get all verses for a surah
export function getSurahVerses(surahNumber: number): Verse[] {
  const quran = quranData as QuranData;
  const verses = quran[String(surahNumber)];

  if (!verses) return [];

  return verses.map((v) => ({
    surah: v.chapter,
    ayah: v.verse,
    text: v.text,
    textClean: normalizeArabic(v.text),
  }));
}

// Get a specific verse
export function getVerse(surahNumber: number, ayahNumber: number): Verse | undefined {
  const verses = getSurahVerses(surahNumber);
  return verses.find((v) => v.ayah === ayahNumber);
}

// Get word-indexed verses for a surah (pre-computed words with normalized forms)
export function getSurahVersesIndexed(surahNumber: number): WordIndexedVerse[] {
  const words = quranWordsData as QuranWordsData;
  return words[String(surahNumber)] ?? [];
}
