import { NextResponse } from "next/server";
import { getAvailableSurahs } from "@/lib/quran-data";

export async function GET() {
  const surahs = getAvailableSurahs();
  return NextResponse.json(surahs, {
    headers: {
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
