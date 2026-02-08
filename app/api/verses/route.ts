import { NextRequest, NextResponse } from "next/server";
import { getSurahVerses } from "@/lib/quran-data";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const surahStr = searchParams.get("surah");

  if (!surahStr) {
    return NextResponse.json(
      { error: "Missing surah parameter" },
      { status: 400 }
    );
  }

  const surah = parseInt(surahStr, 10);

  if (isNaN(surah) || surah < 1 || surah > 114) {
    return NextResponse.json(
      { error: "Invalid surah number" },
      { status: 400 }
    );
  }

  const verses = getSurahVerses(surah);

  // Return simple format for the client
  const result = verses.map((v) => ({
    chapter: v.surah,
    verse: v.ayah,
    text: v.text,
  }));

  return NextResponse.json(result);
}
