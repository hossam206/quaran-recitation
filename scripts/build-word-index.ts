/**
 * Build script: generates data/quran-words.json from data/quran.json
 * Each verse gets its words pre-split and pre-normalized for efficient runtime use.
 *
 * Run: npx tsx scripts/build-word-index.ts
 */

import * as fs from "fs";
import * as path from "path";

// ── Inline normalization (matches lib/quran-data.ts exactly) ──

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

function stripDiacritics(text: string): string {
  return text
    .replace(RE_DIACRITICS, "")
    .replace(RE_ARABIC_SIGNS, "")
    .replace(RE_QURANIC_ANNOTATIONS, "")
    .replace(RE_ADDITIONAL_MARKS, "");
}

function normalizeArabic(text: string): string {
  let normalized = text.replace(RE_SUPERSCRIPT_ALEF, "\u0627");
  normalized = normalized.replace(RE_TATWEEL, "");
  normalized = normalized.replace(RE_SMALL_SIGNS, "");
  normalized = stripDiacritics(normalized);
  normalized = normalized.replace(RE_ALEF_VARIANTS, "\u0627");
  normalized = normalized.replace(RE_ALEF_MAQSURA, "\u064A");
  normalized = normalized.replace(RE_TAA_MARBUTA, "\u0647");
  normalized = normalized.replace(RE_HAMZA_WAW, "\u0648");
  normalized = normalized.replace(RE_HAMZA_YA, "\u064A");
  normalized = normalized.replace(RE_WHITESPACE, " ").trim();
  return normalized;
}

// ── Main ──

interface QuranVerse {
  chapter: number;
  verse: number;
  text: string;
}

interface WordIndexedVerse {
  chapter: number;
  verse: number;
  text: string;
  words: Array<{
    index: number;
    text: string;
    textClean: string;
  }>;
}

type QuranData = Record<string, QuranVerse[]>;
type OutputData = Record<string, WordIndexedVerse[]>;

const dataDir = path.resolve(__dirname, "..", "data");
const inputPath = path.join(dataDir, "quran.json");
const outputPath = path.join(dataDir, "quran-words.json");

const quranData: QuranData = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
const output: OutputData = {};

let totalVerses = 0;
let totalWords = 0;

for (const [surahNum, verses] of Object.entries(quranData)) {
  output[surahNum] = verses.map((v) => {
    const originalWords = v.text.split(/\s+/).filter(Boolean);
    const normalizedFull = normalizeArabic(v.text);
    const normalizedWords = normalizedFull.split(/\s+/).filter(Boolean);

    const words = originalWords.map((word, idx) => ({
      index: idx,
      text: word,
      textClean: normalizedWords[idx] ?? normalizeArabic(word),
    }));

    totalVerses++;
    totalWords += words.length;

    return {
      chapter: v.chapter,
      verse: v.verse,
      text: v.text,
      words,
    };
  });
}

fs.writeFileSync(outputPath, JSON.stringify(output), "utf-8");

const sizeMB = (fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2);
console.log(`Generated ${outputPath}`);
console.log(`  Surahs: ${Object.keys(output).length}`);
console.log(`  Verses: ${totalVerses}`);
console.log(`  Words:  ${totalWords}`);
console.log(`  Size:   ${sizeMB} MB`);
