"use client";

import { useState, useEffect } from "react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { Mistake } from "@/lib/types";

interface Surah {
  number: number;
  name: string;
  englishName: string;
}

interface VerseData {
  chapter: number;
  verse: number;
  text: string;
}

interface RecitationResult {
  success: boolean;
  recognized: string;
  mistakes: Mistake[];
  score: number;
}

export default function Home() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [verses, setVerses] = useState<VerseData[]>([]);
  const [result, setResult] = useState<RecitationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loadingVerses, setLoadingVerses] = useState(false);

  const { status, audioBlob, startRecording, stopRecording, resetRecording, error: recorderError } =
    useAudioRecorder();

  // Load surahs on mount
  useEffect(() => {
    fetch("/api/surahs")
      .then((res) => res.json())
      .then((data) => setSurahs(data))
      .catch(console.error);
  }, []);

  // Load verses when surah changes
  useEffect(() => {
    if (selectedSurah) {
      setLoadingVerses(true);
      setResult(null);
      fetch(`/api/verses?surah=${selectedSurah}`)
        .then((res) => res.json())
        .then((data) => {
          setVerses(data);
          setLoadingVerses(false);
        })
        .catch((err) => {
          console.error(err);
          setLoadingVerses(false);
        });
    } else {
      setVerses([]);
    }
  }, [selectedSurah]);

  async function handleSubmit() {
    if (!audioBlob || !selectedSurah) return;

    setLoading(true);
    setApiError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("surah", String(selectedSurah));
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

      setResult(data as RecitationResult);
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

  // Check if a verse has mistakes
  function getVerseMistakes(verseNumber: number): Mistake[] {
    if (!result) return [];
    return result.mistakes.filter((m) => m.position === verseNumber - 1);
  }

  function hasVerseError(verseNumber: number): boolean {
    return getVerseMistakes(verseNumber).length > 0;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950" dir="rtl">
      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            تصحيح التلاوة
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            اختر السورة وسجّل تلاوتك - سنعلم على الآيات الخاطئة بالأحمر
          </p>
        </header>

        {/* Surah Dropdown */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            اختر السورة
          </label>
          <select
            value={selectedSurah || ""}
            onChange={(e) => {
              setSelectedSurah(e.target.value ? Number(e.target.value) : null);
              handleReset();
            }}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-lg text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">-- اختر سورة --</option>
            {surahs.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Verses Display */}
        {selectedSurah && (
          <div className="mb-8">
            {loadingVerses ? (
              <div className="text-center py-8 text-zinc-500">جاري تحميل الآيات...</div>
            ) : (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="mb-4 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                  آيات السورة
                </h2>
                <div className="space-y-3">
                  {verses.map((verse) => {
                    const hasError = hasVerseError(verse.verse);
                    const mistakes = getVerseMistakes(verse.verse);

                    return (
                      <div
                        key={verse.verse}
                        className={`rounded-lg p-4 transition-all ${hasError
                            ? "bg-red-50 border-2 border-red-400 dark:bg-red-950 dark:border-red-600"
                            : result
                              ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800"
                              : "bg-zinc-50 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700"
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${hasError
                                ? "bg-red-500 text-white"
                                : result
                                  ? "bg-emerald-500 text-white"
                                  : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                              }`}
                          >
                            {verse.verse}
                          </span>
                          <p
                            className={`text-xl leading-loose ${hasError
                                ? "text-red-800 dark:text-red-200"
                                : "text-zinc-900 dark:text-zinc-100"
                              }`}
                            style={{ fontFamily: "serif" }}
                          >
                            {verse.text}
                          </p>
                        </div>

                        {/* Show mistake details */}
                        {hasError && mistakes.length > 0 && (
                          <div className="mt-3 mr-11 space-y-2">
                            {mistakes.map((mistake, i) => (
                              <div
                                key={i}
                                className="text-sm text-red-600 dark:text-red-400"
                              >
                                {mistake.type === "wrong" && (
                                  <span>
                                    ❌ قلت: <strong>{mistake.actual}</strong> بدلاً من:{" "}
                                    <strong>{mistake.expected}</strong>
                                  </span>
                                )}
                                {mistake.type === "missing" && (
                                  <span>
                                    ⚠️ نقصت كلمة: <strong>{mistake.expected}</strong>
                                  </span>
                                )}
                                {mistake.type === "extra" && (
                                  <span>
                                    ➕ زدت كلمة: <strong>{mistake.actual}</strong>
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recording Controls */}
        {selectedSurah && (
          <div className="mb-8 flex flex-col items-center gap-4">
            {status === "idle" && (
              <>
                <button
                  onClick={startRecording}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 active:scale-95"
                  aria-label="بدء التسجيل"
                >
                  <MicIcon />
                </button>
                <p className="text-sm text-zinc-500">اضغط للتسجيل</p>
              </>
            )}

            {status === "recording" && (
              <>
                <button
                  onClick={stopRecording}
                  className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition active:scale-95"
                  aria-label="إيقاف التسجيل"
                >
                  <StopIcon />
                </button>
                <p className="text-sm text-red-500">جاري التسجيل... اقرأ السورة</p>
              </>
            )}

            {status === "stopped" && !result && (
              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loading ? "جاري التحليل..." : "تحقق من التلاوة"}
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  إعادة التسجيل
                </button>
              </div>
            )}

            {recorderError && (
              <p className="text-sm text-red-500">{recorderError}</p>
            )}
            {apiError && (
              <p className="text-sm text-red-500">{apiError}</p>
            )}
          </div>
        )}

        {/* Results Summary */}
        {result && (
          <div className="space-y-6">
            {/* Score */}
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

              {result.mistakes.length === 0 ? (
                <p className="mt-4 text-lg font-medium text-emerald-600">
                  ما شاء الله! تلاوة صحيحة ✓
                </p>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">
                  عدد الأخطاء: {result.mistakes.length}
                </p>
              )}
            </div>

            {/* Recognized Text */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-2 text-sm font-medium text-zinc-500">ما تم التعرف عليه</h3>
              <p className="text-lg leading-relaxed text-zinc-800 dark:text-zinc-200">
                {result.recognized || "(لم يتم التعرف على أي نص)"}
              </p>
            </div>

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

        {/* Empty State */}
        {!selectedSurah && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📖</div>
            <p className="text-zinc-500 dark:text-zinc-400">
              اختر سورة من القائمة للبدء
            </p>
          </div>
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
