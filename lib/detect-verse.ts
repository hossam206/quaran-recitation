import { Verse } from "./types";
import { normalizeArabic, fuzzyMatchArabic, getSurahVerses, getAvailableSurahs } from "./quran-data";

export interface DetectedVerse {
  surah: number;
  ayah: number;
  confidence: number; // 0-100 match confidence
  matchedText: string;
  verse: Verse;
}

/**
 * Finds the best matching verse from recognized speech.
 * Uses a sliding window approach: searches nearby ayahs first,
 * then expands to the full surah, and finally across all surahs.
 *
 * @param recognizedText - The transcribed speech text
 * @param surah - Optional surah number to limit search
 * @param currentAyah - Optional current ayah for sliding window
 * @param windowSize - Number of ayahs to search in each direction (default: 5)
 */
export function detectVerse(
  recognizedText: string,
  surah?: number,
  currentAyah?: number,
  windowSize = 5,
): DetectedVerse | null {
  const normalizedInput = normalizeArabic(recognizedText);
  const inputWords = normalizedInput.split(" ").filter(Boolean);

  if (inputWords.length === 0) {
    return null;
  }

  // Phase 1: Search nearby ayahs (sliding window)
  if (surah && currentAyah != null) {
    const verses = getSurahVerses(surah);
    const windowStart = Math.max(1, currentAyah - 2); // Allow going back 2
    const windowEnd = currentAyah + windowSize;

    const windowVerses = verses.filter(
      (v) => v.ayah >= windowStart && v.ayah <= windowEnd,
    );

    const match = findBestMatch(inputWords, windowVerses);
    if (match && match.confidence >= 40) {
      return match;
    }
  }

  // Phase 2: Search entire surah
  if (surah) {
    const verses = getSurahVerses(surah);
    const match = findBestMatch(inputWords, verses);
    if (match && match.confidence >= 30) {
      return match;
    }
  }

  // Phase 3: Search all surahs (expensive, used for auto-detection)
  const allVerses = getAllVerses();
  const match = findBestMatch(inputWords, allVerses);
  if (match && match.confidence >= 30) {
    return match;
  }

  return null;
}

/**
 * Find the best matching verse from a list of candidates.
 */
function findBestMatch(inputWords: string[], verses: Verse[]): DetectedVerse | null {
  if (verses.length === 0) return null;

  let bestMatch: DetectedVerse | null = null;
  let bestScore = 0;

  for (const verse of verses) {
    const verseWords = verse.textClean.split(" ").filter(Boolean);
    const score = calculateSimilarity(inputWords, verseWords);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        surah: verse.surah,
        ayah: verse.ayah,
        confidence: Math.round(score * 100),
        matchedText: verse.text,
        verse,
      };
    }
  }

  return bestMatch;
}

/**
 * Calculate similarity between two word arrays using Jaccard-like similarity
 * combined with sequential matching bonus and fuzzy matching.
 */
function calculateSimilarity(inputWords: string[], verseWords: string[]): number {
  if (inputWords.length === 0 || verseWords.length === 0) {
    return 0;
  }

  // Count matching words (with fuzzy matching for mispronunciation tolerance)
  let matchCount = 0;
  const matchedVerseIndices = new Set<number>();

  for (const inputWord of inputWords) {
    for (let j = 0; j < verseWords.length; j++) {
      if (matchedVerseIndices.has(j)) continue;
      if (fuzzyMatchArabic(inputWord, verseWords[j])) {
        matchCount++;
        matchedVerseIndices.add(j);
        break;
      }
    }
  }

  // Base similarity: fraction of verse words found in input
  const coverage = matchCount / verseWords.length;

  // Bonus for sequential matching (words in correct order)
  const sequentialBonus = calculateSequentialBonus(inputWords, verseWords);

  // Combined score: coverage + sequential bonus (weighted)
  return coverage * 0.7 + sequentialBonus * 0.3;
}

/**
 * Calculate bonus for words appearing in the correct sequential order.
 * Uses fuzzy matching for tolerance.
 */
function calculateSequentialBonus(inputWords: string[], verseWords: string[]): number {
  if (inputWords.length === 0 || verseWords.length === 0) {
    return 0;
  }

  let lastMatchPos = -1;
  let sequentialMatches = 0;

  for (const inputWord of inputWords) {
    for (let i = lastMatchPos + 1; i < verseWords.length; i++) {
      if (fuzzyMatchArabic(inputWord, verseWords[i])) {
        sequentialMatches++;
        lastMatchPos = i;
        break;
      }
    }
  }

  return sequentialMatches / verseWords.length;
}

/**
 * Get all verses from all surahs.
 */
function getAllVerses(): Verse[] {
  const surahs = getAvailableSurahs();
  const allVerses: Verse[] = [];
  for (const surah of surahs) {
    allVerses.push(...getSurahVerses(surah.number));
  }
  return allVerses;
}
