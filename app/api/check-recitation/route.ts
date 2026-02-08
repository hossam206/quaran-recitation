import { NextRequest, NextResponse } from "next/server";
import { getSurahVerses, normalizeArabic } from "@/lib/quran-data";
import { transcribeAudio } from "@/lib/speech-to-text";
import { Mistake } from "@/lib/types";

// Max audio file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface VerseResult {
  ayah: number;
  expected: string;
  recognized: string;
  mistakes: Mistake[];
  isCorrect: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Validate inputs
    const surahStr = formData.get("surah");
    const audioFile = formData.get("audio");

    if (!surahStr) {
      return NextResponse.json(
        { success: false, error: "Missing surah number" },
        { status: 400 }
      );
    }

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: "Missing audio file" },
        { status: 400 }
      );
    }

    if (!(audioFile instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Audio must be a file" },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "Audio file too large (max 10MB)" },
        { status: 400 }
      );
    }

    const surah = parseInt(surahStr as string, 10);
    if (isNaN(surah) || surah < 1 || surah > 114) {
      return NextResponse.json(
        { success: false, error: "Invalid surah number" },
        { status: 400 }
      );
    }

    // Get surah verses
    const verses = getSurahVerses(surah);
    if (verses.length === 0) {
      return NextResponse.json(
        { success: false, error: "Surah not found" },
        { status: 404 }
      );
    }

    // Transcribe audio
    const audioBuffer = await audioFile.arrayBuffer();
    const filename = audioFile.name || "recording.webm";
    const sttResult = await transcribeAudio(audioBuffer, filename);

    if (!sttResult.text || sttResult.text.trim() === "") {
      return NextResponse.json({
        success: true,
        recognized: "",
        mistakes: [],
        score: 0,
        verseResults: [],
      });
    }

    // Normalize recognized text
    const recognizedNormalized = normalizeArabic(sttResult.text);
    const recognizedWords = recognizedNormalized.split(" ").filter(Boolean);

    // Compare against each verse
    const mistakes: Mistake[] = [];
    let totalExpectedWords = 0;
    let correctWords = 0;
    let currentWordIndex = 0;

    for (const verse of verses) {
      const verseWords = verse.textClean.split(" ").filter(Boolean);
      totalExpectedWords += verseWords.length;

      // Check if recognized text contains this verse's words
      for (let i = 0; i < verseWords.length; i++) {
        const expectedWord = verseWords[i];
        const recognizedWord = recognizedWords[currentWordIndex + i];

        if (!recognizedWord) {
          // Word is missing
          mistakes.push({
            type: "missing",
            position: verse.ayah - 1, // 0-indexed for the verse
            expected: expectedWord,
          });
        } else if (normalizeArabic(recognizedWord) !== normalizeArabic(expectedWord)) {
          // Word is wrong
          mistakes.push({
            type: "wrong",
            position: verse.ayah - 1,
            expected: expectedWord,
            actual: recognizedWord,
          });
        } else {
          correctWords++;
        }
      }

      currentWordIndex += verseWords.length;
    }

    // Check for extra words
    if (currentWordIndex < recognizedWords.length) {
      for (let i = currentWordIndex; i < recognizedWords.length; i++) {
        mistakes.push({
          type: "extra",
          position: verses.length - 1, // Last verse
          actual: recognizedWords[i],
        });
      }
    }

    // Calculate score
    const score = totalExpectedWords > 0
      ? Math.max(0, Math.round((correctWords / totalExpectedWords) * 100))
      : 0;

    return NextResponse.json({
      success: true,
      recognized: sttResult.text,
      mistakes,
      score,
    });
  } catch (error) {
    console.error("Check recitation error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
