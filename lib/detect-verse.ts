import { Verse } from "./types";
import { normalizeArabic, getSurahVerses, getAvailableSurahs } from "./quran-data";

export interface DetectedVerse {
  surah: number;
  ayah: number;
  confidence: number; // 0-100 match confidence
  matchedText: string;
  verse: Verse;
}

/**
 * Finds the best matching verse from recognized speech.
 * Uses word overlap similarity to find the closest match.
 * 
 * @param recognizedText - The transcribed speech text
 * @param surah - Optional surah number to limit search
 * @returns The best matching verse or null if no good match
 */
export function detectVerse(
  recognizedText: string,
  surah?: number
): DetectedVerse | null {
  const normalizedInput = normalizeArabic(recognizedText);
  const inputWords = normalizedInput.split(" ").filter(Boolean);

  if (inputWords.length === 0) {
    return null;
  }

  // Get verses to search
  const versesToSearch = surah ? getSurahVerses(surah) : getAllVerses();

  if (versesToSearch.length === 0) {
    return null;
  }

  let bestMatch: DetectedVerse | null = null;
  let bestScore = 0;

  for (const verse of versesToSearch) {
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

  // Minimum threshold - at least 30% similarity to be considered a match
  if (bestMatch && bestMatch.confidence < 30) {
    return null;
  }

  return bestMatch;
}

/**
 * Calculate similarity between two word arrays using Jaccard-like similarity
 * combined with sequential matching bonus for Quran recitation.
 */
function calculateSimilarity(inputWords: string[], verseWords: string[]): number {
  if (inputWords.length === 0 || verseWords.length === 0) {
    return 0;
  }

  // Count matching words
  const inputSet = new Set(inputWords);
  const verseSet = new Set(verseWords);
  
  let matchCount = 0;
  for (const word of inputSet) {
    if (verseSet.has(word)) {
      matchCount++;
    }
  }

  // Base similarity: what fraction of verse words were found in input
  const coverage = matchCount / verseSet.size;

  // Bonus for sequential matching (words appear in correct order)
  const sequentialBonus = calculateSequentialBonus(inputWords, verseWords);

  // Combined score: coverage + sequential bonus (weighted)
  return coverage * 0.7 + sequentialBonus * 0.3;
}

/**
 * Calculate bonus for words appearing in the correct sequential order.
 * This helps distinguish between verses with similar words.
 */
function calculateSequentialBonus(inputWords: string[], verseWords: string[]): number {
  if (inputWords.length === 0 || verseWords.length === 0) {
    return 0;
  }

  // Find longest increasing subsequence of matching positions
  let lastMatchPos = -1;
  let sequentialMatches = 0;

  for (const inputWord of inputWords) {
    for (let i = lastMatchPos + 1; i < verseWords.length; i++) {
      if (inputWord === verseWords[i]) {
        sequentialMatches++;
        lastMatchPos = i;
        break;
      }
    }
  }

  return sequentialMatches / verseWords.length;
}

/**
 * Get all verses from the database.
 * In production, this would query a database.
 */
function getAllVerses(): Verse[] {
  const surahs = getAvailableSurahs();
  const allVerses: Verse[] = [];

  for (const surah of surahs) {
    allVerses.push(...getSurahVerses(surah.number));
  }

  return allVerses;
}
