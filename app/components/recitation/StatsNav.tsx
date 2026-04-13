"use client";

interface StatsNavProps {
  surahName?: string;
  revealedCount: number;
  totalWords: number;
  accuracy: number;
  errorCount: number;
  progressPercent: number;
}

export default function StatsNav({
  surahName,
  revealedCount,
  totalWords,
  accuracy,
  errorCount,
  progressPercent,
}: StatsNavProps) {
  return (
    <div className="relative z-10">
      <nav className="px-4 md:px-8 py-4 md:py-5 flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-10 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
          <div className="flex flex-col items-start">
            <h2
              className="text-2xl md:text-3xl font-black text-emerald-900"
              style={{ fontFamily: "var(--font-amiri), Amiri, serif" }}
            >
              سورة {surahName}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] md:text-xs text-emerald-500">
                {revealedCount} / {totalWords} كلمة
              </span>
              <div className="w-12 h-px bg-gradient-to-r from-emerald-200 to-transparent" />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Accuracy */}
          <div className="bg-white border border-emerald-100 px-3 md:px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm ring-1 ring-emerald-50">
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#d1fae5"
                  strokeWidth="2.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="url(#accuracyGrad)"
                  strokeWidth="2.5"
                  strokeDasharray={`${accuracy * 0.88} 88`}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
                <defs>
                  <linearGradient
                    id="accuracyGrad"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-emerald-700">
                {accuracy}%
              </span>
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-[13px] font-semibold text-emerald-600">
                الدقة
              </span>
              <span className="text-[9px] text-emerald-400">
                accuracy
              </span>
            </div>
          </div>

          {/* Errors */}
          <div
            className={`border px-3 md:px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm ring-1 transition-colors ${errorCount > 0 ? "bg-rose-50 border-rose-100 ring-rose-50" : "bg-white border-emerald-100 ring-emerald-50"}`}
          >
            <span
              className={`text-lg md:text-xl font-black ${errorCount > 0 ? "text-rose-500" : "text-emerald-300"}`}
            >
              {errorCount}
            </span>
            <div
              className={`hidden md:flex flex-col ${errorCount > 0 ? "text-rose-400" : "text-emerald-400"}`}
            >
              <span className="text-[13px] font-bold">أخطاء</span>
              <span className="text-[9px]">errors</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Progress bar */}
      <div className="relative h-2 bg-emerald-50 mx-4 md:mx-8 rounded-full overflow-hidden ring-1 ring-emerald-100/50">
        <div
          className="h-full bg-gradient-to-l from-emerald-400 to-emerald-600 rounded-full transition-all duration-700 ease-out animate-progress-glow relative"
          style={{ width: `${progressPercent}%` }}
        >
          {/* Shine sweep */}
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-progress-shine" />
          </div>
        </div>
        {/* Glowing head dot */}
        {progressPercent > 0 && progressPercent < 100 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full border-2 border-emerald-500 shadow-md shadow-emerald-300/50 transition-all duration-700"
            style={{ left: `calc(${progressPercent}% - 7px)` }}
          />
        )}
      </div>
    </div>
  );
}
