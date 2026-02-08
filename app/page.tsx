"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { normalizeArabic } from "@/lib/quran-data";

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

interface RevealedVerse {
  verseNumber: number;
  isCorrect: boolean;
}

export default function Home() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [verses, setVerses] = useState<VerseData[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);

  // Real-time recognition state
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [revealedVerses, setRevealedVerses] = useState<RevealedVerse[]>([]);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const errorSoundRef = useRef<HTMLAudioElement | null>(null);

  // Load error sound
  useEffect(() => {
    // Create error sound (simple beep using Web Audio API)
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    errorSoundRef.current = null; // We'll use Web Audio API directly
  }, []);

  const playErrorSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 400; // Hz
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  };

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
      setSpokenText("");
      setRevealedVerses([]);
      setCurrentVerseIndex(0);
      setErrorCount(0);

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

  // Check recitation against current verse
  const checkCurrentVerse = useCallback((text: string) => {
    if (!verses.length || currentVerseIndex >= verses.length) return;

    const currentVerse = verses[currentVerseIndex];
    const normalizedSpoken = normalizeArabic(text);
    const normalizedExpected = normalizeArabic(currentVerse.text);

    const spokenWords = normalizedSpoken.split(/\s+/).filter(Boolean);
    const expectedWords = normalizedExpected.split(/\s+/).filter(Boolean);

    // Check if user has spoken enough words to match this verse
    const wordsToMatch = Math.min(expectedWords.length, spokenWords.length);

    if (wordsToMatch >= Math.ceil(expectedWords.length * 0.6)) {
      // User has spoken at least 60% of the verse, check accuracy
      let matchCount = 0;

      for (let i = 0; i < wordsToMatch; i++) {
        if (spokenWords[i] === expectedWords[i]) {
          matchCount++;
        }
      }

      const accuracy = matchCount / expectedWords.length;
      const isCorrect = accuracy >= 0.7; // 70% threshold

      // Reveal this verse
      setRevealedVerses(prev => [
        ...prev,
        { verseNumber: currentVerse.verse, isCorrect }
      ]);

      if (!isCorrect) {
        setErrorCount(prev => prev + 1);
        playErrorSound();
      }

      // Move to next verse
      setCurrentVerseIndex(prev => prev + 1);
      setSpokenText(""); // Reset for next verse
    }
  }, [verses, currentVerseIndex]);

  // Start/stop recognition
  const toggleListening = useCallback(() => {
    if (isListening) {
      // Stop
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsListening(false);
    } else {
      // Start
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("المتصفح لا يدعم التعرف على الكلام. جرب Chrome.");
        return;
      }
      const recognition = new SpeechRecognition();

      recognition.lang = "ar";
      recognition.continuous = true;
      recognition.interimResults = true;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript + " ";
          }
        }

        if (transcript.trim()) {
          const newText = (spokenText + " " + transcript).trim();
          setSpokenText(newText);
          checkCurrentVerse(newText);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "no-speech") {
          recognition.stop();
          setTimeout(() => recognition.start(), 100);
        }
      };

      recognition.onend = () => {
        if (isListening) {
          recognition.start();
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  }, [isListening, spokenText, checkCurrentVerse]);

  // Reset
  const handleReset = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsListening(false);
    setSpokenText("");
    setRevealedVerses([]);
    setErrorCount(0);
    setRecordingTime(0);
    setCurrentVerseIndex(0);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Check if verse is revealed
  const getVerseStatus = (verseNumber: number) => {
    return revealedVerses.find(v => v.verseNumber === verseNumber);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-lg border-b border-emerald-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📖</span>
            <h1 className="text-xl font-bold text-emerald-800">تصحيح التلاوة</h1>
          </div>

          {/* Surah selector */}
          <select
            value={selectedSurah || ""}
            onChange={(e) => {
              setSelectedSurah(e.target.value ? Number(e.target.value) : null);
              handleReset();
            }}
            className="px-4 py-2 rounded-lg bg-emerald-50 border-2 border-emerald-300 text-emerald-900 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">اختر السورة</option>
            {surahs.map((s) => (
              <option key={s.number} value={s.number}>
                {s.name}
              </option>
            ))}
          </select>

          <div className="w-12" />
        </div>
      </header>

      {/* Main content */}
      <main className="pb-32 px-4 py-8">
        {!selectedSurah ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400">
            <span className="text-7xl mb-6">🕌</span>
            <p className="text-xl text-gray-500">اختر سورة للبدء</p>
          </div>
        ) : loadingVerses ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-500 border-t-transparent" />
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Bismillah */}
            {selectedSurah !== 1 && selectedSurah !== 9 && (
              <div className="text-center mb-12">
                <p className="text-3xl text-emerald-700" style={{ fontFamily: "Amiri, serif" }}>
                  بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                </p>
              </div>
            )}

            {/* Progress indicator */}
            <div className="mb-8 text-center">
              <div className="inline-flex items-center gap-3 bg-white rounded-full px-6 py-3 shadow-lg">
                <span className="text-2xl font-bold text-emerald-600">
                  {revealedVerses.length}
                </span>
                <span className="text-gray-400">/</span>
                <span className="text-lg text-gray-500">{verses.length}</span>
                <span className="text-sm text-gray-400">آية</span>
              </div>
            </div>

            {/* Verses */}
            <div className="space-y-6">
              {verses.map((verse) => {
                const status = getVerseStatus(verse.verse);
                const isRevealed = !!status;
                const isCorrect = status?.isCorrect;
                const isCurrent = verse.verse === verses[currentVerseIndex]?.verse && isListening;

                return (
                  <div
                    key={verse.verse}
                    className={`
                      rounded-2xl p-6 transition-all duration-500 transform
                      ${isCurrent ? "ring-4 ring-amber-400 scale-105 shadow-xl" : ""}
                      ${isRevealed
                        ? isCorrect
                          ? "bg-white border-2 border-emerald-300 shadow-lg"
                          : "bg-red-50 border-2 border-red-400 shadow-lg animate-pulse"
                        : "bg-gray-100 border-2 border-gray-200"
                      }
                    `}
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className={`
                          flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold
                          ${isRevealed
                            ? isCorrect
                              ? "bg-emerald-500 text-white"
                              : "bg-red-500 text-white"
                            : "bg-gray-300 text-gray-600"
                          }
                        `}
                      >
                        {verse.verse}
                      </span>

                      {isRevealed ? (
                        <p
                          className={`
                            text-2xl leading-loose flex-1
                            ${isCorrect ? "text-gray-800" : "text-red-600"}
                          `}
                          style={{ fontFamily: "Amiri, serif" }}
                        >
                          {verse.text}
                        </p>
                      ) : (
                        <div className="flex-1 space-y-2">
                          <div className="h-8 bg-gray-200 rounded-lg w-full animate-pulse" />
                          <div className="h-8 bg-gray-200 rounded-lg w-5/6 animate-pulse" />
                          <div className="h-8 bg-gray-200 rounded-lg w-4/6 animate-pulse" />
                        </div>
                      )}
                    </div>

                    {isCurrent && (
                      <div className="mt-4 text-center">
                        <span className="inline-flex items-center gap-2 text-sm text-amber-600 font-medium">
                          <span className="flex h-2 w-2">
                            <span className="animate-ping absolute h-2 w-2 rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                          استمع الآن...
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Completion message */}
            {revealedVerses.length === verses.length && verses.length > 0 && (
              <div className="mt-12 text-center">
                <div className="inline-block bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl px-8 py-6 shadow-2xl">
                  <div className="text-5xl mb-3">✨</div>
                  <h2 className="text-2xl font-bold mb-2">انتهيت من السورة!</h2>
                  <p className="text-emerald-100">
                    الدقة: {Math.round(((verses.length - errorCount) / verses.length) * 100)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom controls */}
      {selectedSurah && !loadingVerses && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-emerald-200 shadow-2xl">
          {/* Stats bar */}
          {isListening && (
            <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-rose-50 to-orange-50 border-b border-rose-200">
              <div className="flex items-center gap-3">
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-sm font-semibold text-red-600">{formatTime(recordingTime)}</span>
              </div>
              <span className="text-sm text-gray-600">
                الآية {currentVerseIndex + 1} من {verses.length}
              </span>
            </div>
          )}

          {/* Main controls */}
          <div className="flex items-center justify-between px-6 py-4">
            {/* Error count */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50">
              <span className="text-sm font-medium text-red-700">أخطاء</span>
              <span className="flex items-center justify-center min-w-[24px] h-6 px-2 text-xs text-white bg-red-500 rounded-full font-bold">
                {errorCount}
              </span>
            </div>

            {/* Mic button */}
            <button
              onClick={toggleListening}
              disabled={revealedVerses.length === verses.length}
              className={`
                flex items-center justify-center w-20 h-20 rounded-full shadow-2xl transition-all transform
                ${isListening
                  ? "bg-gradient-to-br from-red-500 to-rose-600 animate-pulse scale-110"
                  : revealedVerses.length === verses.length
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-gradient-to-br from-emerald-500 to-teal-600 hover:scale-110 active:scale-95"
                }
              `}
            >
              {isListening ? <StopIcon /> : <MicIcon />}
            </button>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
            >
              <RefreshIcon />
              <span className="text-sm font-medium">إعادة</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
