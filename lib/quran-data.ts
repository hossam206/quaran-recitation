import { Verse } from "./types";
import surahsData from "@/data/surahs.json";
import quranData from "@/data/quran.json";

export interface Surah {
  number: number;
  name: string;
  englishName: string;
}

// Type for the quran.json structure
type QuranData = Record<string, Array<{ chapter: number; verse: number; text: string }>>;

/**
 * Strip Arabic diacritics (tashkeel) for comparison purposes.
 * Note: Superscript alef (U+0670) is handled separately in normalizeArabic
 * because it represents an actual alef sound.
 */
export function stripDiacritics(text: string): string {
  return text
    .replace(/[\u064B-\u065F]/g, "") // Tanween, Sukun, Shadda, etc.
    .replace(/[\u0610-\u061A]/g, "") // Arabic signs
    .replace(/[\u06D6-\u06ED]/g, "") // Quranic annotation signs
    .replace(/[\u0653-\u0656]/g, ""); // Additional marks
}

/**
 * Normalize Arabic text for comparison:
 * - Convert superscript alef to regular alef (preserves the sound)
 * - Strip diacritics
 * - Handle Quranic letter sequences (الم, الر, etc.)
 * - Normalize alef variants to plain alef
 * - Normalize taa marbuta to haa
 * - Collapse whitespace
 */
export function normalizeArabic(text: string): string {
  // Convert superscript alef to regular alef BEFORE stripping diacritics.
  // Quranic text uses superscript alef (ٰ) in words like الرَّحْمَٰنِ and الظَّٰلِمِينَ.
  // Web Speech API outputs the full alef sound, so we must preserve it.
  let normalized = text.replace(/\u0670/g, "\u0627");

  normalized = stripDiacritics(normalized);

  // Comprehensive Quranic letter sequence mappings.
  // Sorted by pattern length (longest first) to match greedily.
  const letterMappings: [string, string][] = [
    // 5-word patterns
    ["كاف هاء ياء عين صاد", "كهيعص"],
    ["كاف ها يا عين صاد", "كهيعص"],
    ["حاء ميم عين سين قاف", "حمعسق"],
    ["حا ميم عين سين قاف", "حمعسق"],
    // 4-word patterns
    ["ألف لام ميم صاد", "المص"],
    ["الف لام ميم صاد", "المص"],
    ["الف لا ميم صاد", "المص"],
    ["ألف لام ميم راء", "المر"],
    ["الف لام ميم راء", "المر"],
    ["الف لا ميم راء", "المر"],
    // 3-word patterns
    ["ألف لام ميم", "الم"],
    ["الف لام ميم", "الم"],
    ["ألف لا ميم", "الم"],
    ["الف لا ميم", "الم"],
    ["ا لام ميم", "الم"],
    ["ألف لام راء", "الر"],
    ["الف لام راء", "الر"],
    ["ألف لا راء", "الر"],
    ["الف لا راء", "الر"],
    ["الف لام را", "الر"],
    ["طا سين ميم", "طسم"],
    ["طاء سين ميم", "طسم"],
    // 2-word patterns
    ["طا ها", "طه"],
    ["طاء ها", "طه"],
    ["طاء هاء", "طه"],
    ["يا سين", "يس"],
    ["يا س", "يس"],
    ["ياء سين", "يس"],
    ["حا ميم", "حم"],
    ["حاء ميم", "حم"],
    ["طا سين", "طس"],
    ["طاء سين", "طس"],
  ];

  for (const [spoken, quranic] of letterMappings) {
    normalized = normalized.replace(new RegExp(spoken, "g"), quranic);
  }

  // Single-word letter names (with word boundaries to avoid matching inside words)
  const singleLetterMappings: [string, string][] = [
    ["صاد", "ص"],
    ["قاف", "ق"],
    ["نون", "ن"],
  ];

  for (const [spoken, quranic] of singleLetterMappings) {
    normalized = normalized.replace(
      new RegExp(`(^|\\s)${spoken}($|\\s)`, "g"),
      `$1${quranic}$2`
    );
  }

  // Normalize alef variants (أ إ آ ٱ) → ا
  normalized = normalized.replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627");

  // Normalize alef maqsura (ى) → ya (ي)
  normalized = normalized.replace(/\u0649/g, "\u064A");

  // Normalize taa marbuta → haa
  normalized = normalized.replace(/\u0629/g, "\u0647");

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();
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
 * Fuzzy match two Arabic words, tolerating minor speech recognition differences.
 * Allows edit distance of 1 for words with 3+ characters.
 */
export function fuzzyMatchArabic(spoken: string, expected: string): boolean {
  if (spoken === expected) return true;
  if (!spoken || !expected) return false;

  // Very short words: exact match only
  if (expected.length <= 2 && spoken.length <= 2) return false;

  return levenshteinDistance(spoken, expected) <= 1;
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
