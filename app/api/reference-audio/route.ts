import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy for fetching per-ayah reference audio from EveryAyah.com.
 * Caches responses for 7 days.
 *
 * Query params:
 *   surah  - Surah number (1-114)
 *   ayah   - Ayah number
 *   reciter - Reciter folder name (default: Alafasy_128kbps)
 *
 * Available reciters (examples):
 *   Alafasy_128kbps      - Mishary Alafasy
 *   Husary_128kbps       - Mahmoud Khalil Al-Husary
 *   Minshawy_Murattal_128kbps - Mohamed Siddiq El-Minshawi
 *   AbdulSamworked_64kbps     - Abdul Basit Abdus Samad
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const surah = searchParams.get("surah");
  const ayah = searchParams.get("ayah");
  const reciter = searchParams.get("reciter") || "Alafasy_128kbps";

  if (!surah || !ayah) {
    return NextResponse.json(
      { error: "Missing surah or ayah parameter" },
      { status: 400 },
    );
  }

  const surahNum = parseInt(surah, 10);
  const ayahNum = parseInt(ayah, 10);

  if (isNaN(surahNum) || surahNum < 1 || surahNum > 114) {
    return NextResponse.json(
      { error: "Invalid surah number (1-114)" },
      { status: 400 },
    );
  }

  if (isNaN(ayahNum) || ayahNum < 1) {
    return NextResponse.json(
      { error: "Invalid ayah number" },
      { status: 400 },
    );
  }

  // EveryAyah.com URL format: /data/{reciter}/{surahXXX}{ayahXXX}.mp3
  const surahPad = String(surahNum).padStart(3, "0");
  const ayahPad = String(ayahNum).padStart(3, "0");
  const audioUrl = `https://everyayah.com/data/${reciter}/${surahPad}${ayahPad}.mp3`;

  try {
    const response = await fetch(audioUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Audio not found for surah ${surah} ayah ${ayah}` },
        { status: 404 },
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=2592000",
        "X-Reciter": reciter,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch reference audio" },
      { status: 502 },
    );
  }
}
