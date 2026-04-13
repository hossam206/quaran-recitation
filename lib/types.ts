// ---- Quran Data ----

export interface Verse {
  surah: number;
  ayah: number;
  text: string; // Arabic text (with tashkeel/diacritics)
  textClean: string; // Arabic text without diacritics (for comparison)
}

export interface Surah {
  number: number;
  name: string;
  englishName: string;
}

export interface VerseData {
  chapter: number;
  verse: number;
  text: string;
}

export interface WordStatus {
  verseNumber: number;
  wordIndex: number;
  word: string;
  isCorrect: boolean;
}

export interface NormalizedVerse {
  verse: number;
  normalizedText: string;
  normalizedWords: string[];
  originalWords: string[];
}

// ---- API Request/Response ----

export interface CheckRecitationRequest {
  surah: number;
  ayah: number;
  // Audio file sent as FormData
}

export interface DetectedVerse {
  surah: number;
  ayah: number;
  confidence: number; // 0-100 match confidence
  matchedText: string;
}

export interface CheckRecitationResponse {
  success: boolean;
  recognized: string; // What the user actually said
  expected: string; // The correct verse text
  score: number; // 0-100 accuracy percentage
  mistakes: Mistake[];
  correctedVerse: string; // Full correct verse for reference
  detectedVerse?: DetectedVerse; // Auto-detected verse info (when ayah not specified)
}

// ---- Comparison Engine ----

export type MistakeType = "wrong" | "missing" | "extra";

export interface Mistake {
  type: MistakeType;
  position: number; // Word index in the expected verse
  expected?: string; // What should have been said (for "wrong" and "missing")
  actual?: string; // What was actually said (for "wrong" and "extra")
}

export interface ComparisonResult {
  score: number;
  mistakes: Mistake[];
}

// ---- Word-Indexed Qur'an Data ----

export interface QuranWord {
  index: number;
  text: string;      // Original with tashkeel
  textClean: string;  // Normalized for comparison
}

export interface WordIndexedVerse {
  chapter: number;
  verse: number;
  text: string;
  words: QuranWord[];
}

// ---- Recitation Mode ----

export type RecitationMode = "practice" | "memorize" | "test";

// ---- Audio Recording ----

export type RecordingStatus = "idle" | "recording" | "stopped";

// ---- Verse Mistakes Review ----

export interface VerseMistakeInfo {
  verse: { chapter: number; verse: number; text: string };
  words: string[];
  mistakeCount: number;
  verseAccuracy: number;
}
