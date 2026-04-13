"use client";

import { ArrowBackIcon } from "@/app/components/icons";
import type { WordStatus, VerseMistakeInfo } from "@/lib/types";

interface MistakesReviewProps {
  accuracy: number;
  totalWords: number;
  errorCount: number;
  revealedWords: WordStatus[];
  mistakesByVerse: VerseMistakeInfo[];
  revealedMap: Map<string, WordStatus>;
  onBack: () => void;
  onReset: () => void;
  onSelectNewSurah: () => void;
}

export default function MistakesReview({
  accuracy,
  totalWords,
  errorCount,
  revealedWords,
  mistakesByVerse,
  revealedMap,
  onBack,
  onReset,
  onSelectNewSurah,
}: MistakesReviewProps) {
  return (
    <div className="w-full h-full flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-rose-100 px-4 md:px-8 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 bg-emerald-50 text-emerald-600 rounded-xl active:scale-95 transition-transform"
          >
            <ArrowBackIcon className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-black text-emerald-900">
            مراجعة الأخطاء
          </h3>
          <div className="flex gap-2">
            <span className="bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold px-3 py-1 rounded-full">
              {errorCount} خطأ
            </span>
            <span className="bg-amber-50 border border-amber-100 text-amber-600 text-xs font-bold px-3 py-1 rounded-full">
              {mistakesByVerse.length} آية
            </span>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="px-4 md:px-8 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white/90 border border-emerald-100 rounded-2xl p-4 flex items-center justify-around">
            <div className="text-center">
              <div className="relative w-12 h-12 mx-auto">
                <svg
                  className="w-12 h-12 -rotate-90"
                  viewBox="0 0 36 36"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#d1fae5"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeDasharray={`${accuracy * 0.88} 88`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-emerald-700">
                  {accuracy}%
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-500 mt-1 block">
                الدقة
              </span>
            </div>
            <div className="text-center">
              <div className="text-xl font-black text-emerald-600">
                {totalWords}
              </div>
              <span className="text-[10px] font-bold text-emerald-500">
                كلمة
              </span>
            </div>
            <div className="text-center">
              <div className="text-xl font-black text-emerald-600">
                {revealedWords.filter((w) => w.isCorrect).length}
              </div>
              <span className="text-[10px] font-bold text-emerald-500">
                صحيحة
              </span>
            </div>
            <div className="text-center">
              <div className="text-xl font-black text-rose-500">
                {errorCount}
              </div>
              <span className="text-[10px] font-bold text-rose-400">
                أخطاء
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Verse Cards */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {mistakesByVerse.map((item, idx) => (
            <div
              key={item.verse.verse}
              className="bg-white border border-emerald-100/30 rounded-2xl shadow-lg shadow-emerald-100/10 overflow-hidden animate-fade-in-up-fast"
              style={{
                animationDelay: `${Math.min(idx * 0.03, 0.3)}s`,
              }}
            >
              {/* Verse header */}
              <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-l from-emerald-50 to-transparent border-b border-emerald-50">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center text-xs font-black">
                    {item.verse.verse}
                  </span>
                  <span className="text-xs font-bold text-emerald-600">
                    الآية {item.verse.verse}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-rose-50 text-rose-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {item.mistakeCount}{" "}
                    {item.mistakeCount === 1 ? "خطأ" : "أخطاء"}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400">
                    {item.verseAccuracy}% صحيح
                  </span>
                </div>
              </div>

              {/* Verse text with highlighted mistakes */}
              <div
                className="p-5 md:p-6 text-xl md:text-2xl leading-[3rem] md:leading-[4rem] text-center"
                style={{
                  fontFamily: "var(--font-amiri), Amiri, serif",
                }}
              >
                {item.words.map((word, wIdx) => {
                  const status = revealedMap.get(
                    `${item.verse.verse}-${wIdx}`,
                  );
                  const isWrong = status && !status.isCorrect;
                  return (
                    <span
                      key={wIdx}
                      className={`inline-block mx-0.5 md:mx-1 transition-all ${
                        isWrong
                          ? "text-rose-600 font-bold bg-rose-50 rounded-lg px-1.5 py-0.5 underline decoration-rose-300 decoration-2 underline-offset-4 animate-mistake-pulse"
                          : "text-emerald-900"
                      }`}
                    >
                      {word}
                    </span>
                  );
                })}
                <span className="inline-flex items-center text-base md:text-lg text-amber-500/40 font-serif mx-2 select-none">
                  ﴿{item.verse.verse}﴾
                </span>
              </div>
            </div>
          ))}

          {/* Bottom actions */}
          <div className="flex gap-3 justify-center pt-4 pb-8">
            <button
              onClick={onReset}
              className="px-6 py-3 bg-gradient-to-l from-emerald-500 to-emerald-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-200/50 active:scale-95 transition-transform"
            >
              إعادة التلاوة
            </button>
            <button
              onClick={onSelectNewSurah}
              className="px-6 py-3 bg-white border border-emerald-200 text-emerald-700 rounded-2xl font-bold text-sm shadow-sm active:scale-95 transition-transform"
            >
              سورة أخرى
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
