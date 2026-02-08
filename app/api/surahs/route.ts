import { NextResponse } from "next/server";
import { getAvailableSurahs } from "@/lib/quran-data";

export async function GET() {
  const surahs = getAvailableSurahs();
  return NextResponse.json(surahs);
}
