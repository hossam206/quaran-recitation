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
 * Diacritics range: U+0610–U+061A, U+064B–U+065F, U+0670, U+06D6–U+06ED
 */
export function stripDiacritics(text: string): string {
  return text.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
}

/**
 * Normalize Arabic text for comparison:
 * - Strip diacritics
 * - Normalize alef variants to plain alef
 * - Normalize taa marbuta to haa
 * - Collapse whitespace
 */
export function normalizeArabic(text: string): string {
  let normalized = stripDiacritics(text);
  
  // Handle Quranic letter sequences (Web Speech says "ألف لام ميم" instead of "الم")
  const letterMappings: Record<string, string> = {
    "ألف لام ميم": "الم",
    "الف لام ميم": "الم",
    "ألف لام ميم صاد": "المص",
    "ألف لام راء": "الر",
    "الف لام راء": "الر",
    "ألف لام ميم راء": "المر",
    "كاف ها يا عين صاد": "كهيعص",
    "طه": "طه",
    "طا ها": "طه",
    "طاء ها": "طه",
    "يا سين": "يس",
    "يا س": "يس",
    "صاد": "ص",
    "حم": "حم",
    "حا ميم": "حم",
    "حا ميم عين سين قاف": "حمعسق",
    "قاف": "ق",
    "نون": "ن",
  };
  
  // Apply letter sequence mappings
  for (const [spoken, quranic] of Object.entries(letterMappings)) {
    normalized = normalized.replace(new RegExp(spoken, 'g'), quranic);
  }
  
  // Normalize alef variants (أ إ آ ٱ) → ا
  normalized = normalized.replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627");
  // Normalize taa marbuta → haa
  normalized = normalized.replace(/\u0629/g, "\u0647");
  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
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
