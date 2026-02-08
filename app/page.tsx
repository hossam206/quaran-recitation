"use client";

import { useState } from "react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { CheckRecitationResponse, Mistake, DetectedVerse } from "@/lib/types";

// Surah data for display
const SURAHS = [
  { number: 1, name: "الفاتحة" },
  { number: 112, name: "الإخلاص" },
];

export default function Home() {
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [result, setResult] = useState<CheckRecitationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { status, audioBlob, startRecording, stopRecording, resetRecording, error: recorderError } =
    useAudioRecorder();

  async function handleSubmit() {
    if (!audioBlob) return;

    setLoading(true);
    setApiError(null);
    setResult(null);

    try {
      const formData = new FormData();
      // Only add surah if selected (for better accuracy)
      if (selectedSurah) {
        formData.append("surah", String(selectedSurah));
      }
      // No ayah - let the API auto-detect
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/check-recitation", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setApiError(data.error || "Something went wrong");
        return;
      }

      setResult(data as CheckRecitationResponse);
    } catch {
      setApiError("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    resetRecording();
    setResult(null);
    setApiError(null);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950" dir="rtl">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            تصحيح التلاوة
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            سجّل تلاوتك وسنتعرف على الآية تلقائياً
          </p>
        </header>

        {/* Surah Selector (Optional) */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            اختر السورة (اختياري - يساعد في الدقة)
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSurah(null)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${selectedSurah === null
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
            >
              الكل
            </button>
            {SURAHS.map((s) => (
              <button
                key={s.number}
                onClick={() => setSelectedSurah(s.number)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${selectedSurah === s.number
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Mode indicator */}
        <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-900 dark:bg-emerald-950">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            <span className="font-semibold">🎤 التعرف التلقائي:</span> ابدأ التسجيل واقرأ أي آية - سنتعرف عليها تلقائياً
          </p>
        </div>

        {/* Recording Controls */}
        <div className="mb-8 flex flex-col items-center gap-4">
          {status === "idle" && (
            <button
              onClick={startRecording}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 active:scale-95"
              aria-label="بدء التسجيل"
            >
              <MicIcon />
            </button>
          )}

          {status === "recording" && (
            <button
              onClick={stopRecording}
              className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition active:scale-95"
              aria-label="إيقاف التسجيل"
            >
              <StopIcon />
            </button>
          )}

          {status === "stopped" && !result && (
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "جاري التعرف..." : "تعرّف على الآية"}
              </button>
              <button
                onClick={handleReset}
                className="rounded-lg border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                إعادة التسجيل
              </button>
            </div>
          )}

          {status === "idle" && (
            <p className="text-sm text-zinc-500">اضغط للتسجيل</p>
          )}

          {status === "recording" && (
            <p className="text-sm text-red-500">جاري التسجيل... اقرأ الآية</p>
          )}

          {recorderError && (
            <p className="text-sm text-red-500">{recorderError}</p>
          )}
          {apiError && (
            <p className="text-sm text-red-500">{apiError}</p>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Detected Verse */}
            {result.detectedVerse && (
              <DetectedVerseCard detectedVerse={result.detectedVerse} />
            )}

            {!result.detectedVerse && !result.recognized && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900 dark:bg-amber-950">
                <p className="text-lg font-medium text-amber-700 dark:text-amber-300">
                  لم نتمكن من التعرف على أي كلام
                </p>
                <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                  حاول التسجيل مرة أخرى بصوت أوضح
                </p>
              </div>
            )}

            {!result.detectedVerse && result.recognized && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900 dark:bg-amber-950">
                <p className="text-lg font-medium text-amber-700 dark:text-amber-300">
                  لم نتمكن من تحديد الآية
                </p>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  ما سمعناه: {result.recognized}
                </p>
              </div>
            )}

            {/* Score */}
            {result.detectedVerse && (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <div
                  className={`text-5xl font-bold ${result.score >= 80
                      ? "text-emerald-500"
                      : result.score >= 50
                        ? "text-amber-500"
                        : "text-red-500"
                    }`}
                >
                  {result.score}%
                </div>
                <p className="mt-1 text-sm text-zinc-500">نسبة الدقة</p>
              </div>
            )}

            {/* Recognized Text */}
            {result.recognized && result.detectedVerse && (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-2 text-sm font-medium text-zinc-500">ما تم التعرف عليه</h3>
                <p className="text-lg leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {result.recognized}
                </p>
              </div>
            )}

            {/* Mistakes */}
            {result.detectedVerse && result.mistakes.length > 0 && (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="mb-4 text-sm font-medium text-zinc-500">
                  الأخطاء ({result.mistakes.length})
                </h3>
                <div className="space-y-3">
                  {result.mistakes.map((mistake, i) => (
                    <MistakeCard key={i} mistake={mistake} />
                  ))}
                </div>
              </div>
            )}

            {result.detectedVerse && result.mistakes.length === 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950">
                <p className="text-lg font-medium text-emerald-700 dark:text-emerald-300">
                  ما شاء الله! تلاوة صحيحة
                </p>
              </div>
            )}

            {/* Try Again */}
            <div className="text-center">
              <button
                onClick={handleReset}
                className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                حاول مرة أخرى
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetectedVerseCard({ detectedVerse }: { detectedVerse: DetectedVerse }) {
  const surahName = SURAHS.find((s) => s.number === detectedVerse.surah)?.name || `سورة ${detectedVerse.surah}`;

  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-6 dark:border-emerald-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          ✓ تم التعرف على الآية
        </span>
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
          دقة التعرف: {detectedVerse.confidence}%
        </span>
      </div>
      <p className="mb-3 text-2xl leading-loose text-zinc-900 dark:text-zinc-50" style={{ fontFamily: "serif" }}>
        {detectedVerse.matchedText}
      </p>
      <p className="text-sm text-zinc-500">
        {surahName} - آية {detectedVerse.ayah}
      </p>
    </div>
  );
}

function MistakeCard({ mistake }: { mistake: Mistake }) {
  const config = {
    wrong: {
      label: "كلمة خاطئة",
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900",
    },
    missing: {
      label: "كلمة ناقصة",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900",
    },
    extra: {
      label: "كلمة زائدة",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900",
    },
  };

  const { label, color, bg } = config[mistake.type];

  return (
    <div className={`rounded-lg border p-3 ${bg}`}>
      <span className={`text-xs font-semibold ${color}`}>{label}</span>
      <div className="mt-1 flex gap-4 text-sm">
        {mistake.expected && (
          <span>
            <span className="text-zinc-500">الصحيح: </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{mistake.expected}</span>
          </span>
        )}
        {mistake.actual && (
          <span>
            <span className="text-zinc-500">ما قلته: </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{mistake.actual}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}
