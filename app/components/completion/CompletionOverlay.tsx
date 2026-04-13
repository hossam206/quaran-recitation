"use client";

import { CheckIcon, RefreshIcon, EyeIcon } from "@/app/components/icons";
import MistakesReview from "./MistakesReview";
import type { WordStatus, VerseMistakeInfo } from "@/lib/types";

interface CompletionOverlayProps {
  accuracy: number;
  totalWords: number;
  errorCount: number;
  revealedWords: WordStatus[];
  mistakesByVerse: VerseMistakeInfo[];
  revealedMap: Map<string, WordStatus>;
  showMistakesReview: boolean;
  surahName?: string;
  onReset: () => void;
  onSelectNewSurah: () => void;
  onShowMistakes: () => void;
  onHideMistakes: () => void;
}

export default function CompletionOverlay({
  accuracy,
  totalWords,
  errorCount,
  revealedWords,
  mistakesByVerse,
  revealedMap,
  showMistakesReview,
  surahName,
  onReset,
  onSelectNewSurah,
  onShowMistakes,
  onHideMistakes,
}: CompletionOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-40 animate-fade-in-up"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(255,255,255,0.95) 0%, rgba(236,253,245,0.85) 50%, rgba(255,255,255,0.9) 100%)",
      }}
    >
      {!showMistakesReview ? (
        /* Summary View */
        <div className="h-full flex items-center justify-center relative overflow-hidden">
          {/* Floating geometric shapes */}
          <div className="absolute top-[12%] right-[18%] w-6 h-6 border-2 border-amber-300/30 rounded-sm rotate-45 animate-float-slow" />
          <div className="absolute top-[22%] left-[12%] w-4 h-4 bg-emerald-300/20 rounded-full animate-float-medium" />
          <div
            className="absolute bottom-[28%] right-[12%] animate-float-slow"
            style={{ animationDelay: "1s" }}
          >
            <svg
              viewBox="0 0 40 40"
              className="w-8 h-8 text-emerald-300/20"
            >
              <polygon
                points="20,2 33,8 38,20 33,32 20,38 7,32 2,20 7,8"
                fill="currentColor"
              />
            </svg>
          </div>
          <div
            className="absolute bottom-[18%] left-[22%] w-3 h-3 bg-amber-300/20 rounded-full animate-float-medium"
            style={{ animationDelay: "0.5s" }}
          />
          <div
            className="absolute top-[40%] right-[8%] w-5 h-5 border border-emerald-200/30 rounded-full animate-float-slow"
            style={{ animationDelay: "2s" }}
          />

          <div className="text-center px-6 max-w-md">
            {/* 3-ring celebration badge */}
            <div className="relative w-28 h-28 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-200/50 animate-spin-slow" />
              <div className="absolute inset-2 rounded-full bg-emerald-100/40 shadow-lg shadow-emerald-200/30" />
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-xl shadow-emerald-300/50 flex items-center justify-center">
                <CheckIcon className="w-10 h-10 text-white" />
              </div>
            </div>

            <h3 className="text-2xl font-black text-emerald-900 mb-2">
              أحسنت!
            </h3>
            <p className="text-emerald-600 text-sm mb-8">
              أتممت تلاوة {surahName}
            </p>

            {/* Stat cards */}
            <div className="flex justify-center gap-3 mb-8">
              <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-2xl px-5 py-3 text-center shadow-sm ring-1 ring-emerald-50">
                <div className="text-2xl font-black text-emerald-600">
                  {accuracy}%
                </div>
                <div className="text-[10px] font-bold text-emerald-500 mt-0.5">
                  الدقة
                </div>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-2xl px-5 py-3 text-center shadow-sm ring-1 ring-amber-50">
                <div className="text-2xl font-black text-amber-600">
                  {totalWords}
                </div>
                <div className="text-[10px] font-bold text-amber-500 mt-0.5">
                  كلمة
                </div>
              </div>
              <div
                className={`border rounded-2xl px-5 py-3 text-center shadow-sm ring-1 ${errorCount > 0 ? "bg-gradient-to-br from-rose-50 to-white border-rose-100 ring-rose-50" : "bg-gradient-to-br from-emerald-50 to-white border-emerald-100 ring-emerald-50"}`}
              >
                <div
                  className={`text-2xl font-black ${errorCount > 0 ? "text-rose-500" : "text-emerald-600"}`}
                >
                  {errorCount}
                </div>
                <div
                  className={`text-[10px] font-bold mt-0.5 ${errorCount > 0 ? "text-rose-400" : "text-emerald-500"}`}
                >
                  أخطاء
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 items-center">
              <div className="flex gap-3 justify-center">
                <button
                  onClick={onReset}
                  className="px-6 py-3 bg-gradient-to-l from-emerald-500 to-emerald-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-200/50 active:scale-95 transition-transform flex items-center gap-2"
                >
                  <RefreshIcon className="w-4 h-4" />
                  إعادة التلاوة
                </button>
                <button
                  onClick={onSelectNewSurah}
                  className="px-6 py-3 bg-white border border-emerald-200 text-emerald-700 rounded-2xl font-bold text-sm shadow-sm active:scale-95 transition-transform"
                >
                  سورة أخرى
                </button>
              </div>
              {errorCount > 0 && (
                <button
                  onClick={onShowMistakes}
                  className="px-6 py-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl font-bold text-sm shadow-sm active:scale-95 transition-transform flex items-center gap-2"
                >
                  <EyeIcon className="w-4 h-4" />
                  مراجعة الأخطاء
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <MistakesReview
          accuracy={accuracy}
          totalWords={totalWords}
          errorCount={errorCount}
          revealedWords={revealedWords}
          mistakesByVerse={mistakesByVerse}
          revealedMap={revealedMap}
          onBack={onHideMistakes}
          onReset={onReset}
          onSelectNewSurah={onSelectNewSurah}
        />
      )}
    </div>
  );
}
