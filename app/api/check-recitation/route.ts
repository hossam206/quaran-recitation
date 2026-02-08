import { NextRequest, NextResponse } from "next/server";
import { getVerse } from "@/lib/quran-data";
import { transcribeAudio } from "@/lib/speech-to-text";
import { compareRecitation } from "@/lib/compare";
import { detectVerse } from "@/lib/detect-verse";
import { CheckRecitationResponse } from "@/lib/types";

// Max audio file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Validate inputs
    const surahStr = formData.get("surah");
    const ayahStr = formData.get("ayah"); // Now optional
    const audioFile = formData.get("audio");

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: "Missing required field: audio" },
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

    // Parse optional surah/ayah
    const surah = surahStr ? parseInt(surahStr as string, 10) : undefined;
    const ayah = ayahStr ? parseInt(ayahStr as string, 10) : undefined;

    // Transcribe audio
    const audioBuffer = await audioFile.arrayBuffer();
    const filename = audioFile.name || "recording.webm";
    const sttResult = await transcribeAudio(audioBuffer, filename);

    // If no recognized text, return early
    if (!sttResult.text || sttResult.text.trim() === "") {
      return NextResponse.json({
        success: true,
        recognized: "",
        expected: "",
        score: 0,
        mistakes: [],
        correctedVerse: "",
      } as CheckRecitationResponse);
    }

    // Determine which verse to compare against
    if (ayah !== undefined && surah !== undefined) {
      // Manual mode: use specified verse
      const verse = getVerse(surah, ayah);
      if (!verse) {
        return NextResponse.json(
          { success: false, error: `Verse ${surah}:${ayah} not found` },
          { status: 404 }
        );
      }

      const comparison = compareRecitation(sttResult.text, verse.textClean);

      const response: CheckRecitationResponse = {
        success: true,
        recognized: sttResult.text,
        expected: verse.text,
        score: comparison.score,
        mistakes: comparison.mistakes,
        correctedVerse: verse.text,
      };

      return NextResponse.json(response);
    }

    // Auto-detect mode: find best matching verse
    const detected = detectVerse(sttResult.text, surah);

    if (!detected) {
      // No match found - return the recognized text without comparison
      return NextResponse.json({
        success: true,
        recognized: sttResult.text,
        expected: "",
        score: 0,
        mistakes: [],
        correctedVerse: "",
      } as CheckRecitationResponse);
    }

    // Compare with detected verse
    const comparison = compareRecitation(sttResult.text, detected.verse.textClean);

    const response: CheckRecitationResponse = {
      success: true,
      recognized: sttResult.text,
      expected: detected.verse.text,
      score: comparison.score,
      mistakes: comparison.mistakes,
      correctedVerse: detected.verse.text,
      detectedVerse: {
        surah: detected.surah,
        ayah: detected.ayah,
        confidence: detected.confidence,
        matchedText: detected.matchedText,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Check recitation error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
