import { Verse } from "./types";

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
  // Normalize alef variants (أ إ آ ٱ) → ا
  normalized = normalized.replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627");
  // Normalize taa marbuta → haa
  normalized = normalized.replace(/\u0629/g, "\u0647");
  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}

// Verse data: starting with Al-Fatiha and Al-Ikhlas.
// In production, load from a database or the Quran API.
const verses: Verse[] = [
  // Surah Al-Fatiha (1)
  {
    surah: 1,
    ayah: 1,
    text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    textClean: "",
  },
  {
    surah: 1,
    ayah: 2,
    text: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
    textClean: "",
  },
  {
    surah: 1,
    ayah: 3,
    text: "الرَّحْمَٰنِ الرَّحِيمِ",
    textClean: "",
  },
  {
    surah: 1,
    ayah: 4,
    text: "مَالِكِ يَوْمِ الدِّينِ",
    textClean: "",
  },
  {
    surah: 1,
    ayah: 5,
    text: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
    textClean: "",
  },
  {
    surah: 1,
    ayah: 6,
    text: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",
    textClean: "",
  },
  {
    surah: 1,
    ayah: 7,
    text: "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ",
    textClean: "",
  },

  // Surah Al-Ikhlas (112)
  {
    surah: 112,
    ayah: 1,
    text: "قُلْ هُوَ اللَّهُ أَحَدٌ",
    textClean: "",
  },
  {
    surah: 112,
    ayah: 2,
    text: "اللَّهُ الصَّمَدُ",
    textClean: "",
  },
  {
    surah: 112,
    ayah: 3,
    text: "لَمْ يَلِدْ وَلَمْ يُولَدْ",
    textClean: "",
  },
  {
    surah: 112,
    ayah: 4,
    text: "وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ",
    textClean: "",
  },
];

// Pre-compute clean text for all verses
for (const verse of verses) {
  verse.textClean = normalizeArabic(verse.text);
}

export function getVerse(surah: number, ayah: number): Verse | undefined {
  return verses.find((v) => v.surah === surah && v.ayah === ayah);
}

export function getSurahVerses(surah: number): Verse[] {
  return verses.filter((v) => v.surah === surah);
}

export function getAvailableSurahs(): { number: number; name: string }[] {
  return [
    { number: 1, name: "الفاتحة" },
    { number: 112, name: "الإخلاص" },
  ];
}
