// ---- Quran Data ----

export interface Verse {
  surah: number;
  ayah: number;
  text: string; // Arabic text (with tashkeel/diacritics)
  textClean: string; // Arabic text without diacritics (for comparison)
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

// ---- Audio Recording ----

export type RecordingStatus = "idle" | "recording" | "stopped";
