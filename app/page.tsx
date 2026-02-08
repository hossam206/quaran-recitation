"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { normalizeArabic } from "@/lib/quran-data";

interface Surah {
  number: number;
  name: string;
}

interface VerseData {
  chapter: number;
  verse: number;
  text: string;
}

export default function Home() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [verses, setVerses] = useState<VerseData[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [revealedVerses, setRevealedVerses] = useState<Set<number>>(new Set());
  const [verseColors, setVerseColors] = useState<Map<number, string>>(new Map());
  const [errorCount, setErrorCount] = useState(0);
  const [interimText, setInterimText] = useState("");
  const [debugSpokenText, setDebugSpokenText] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const playErrorSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 500;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  useEffect(() => {
    fetch("/api/surahs")
      .then((res) => res.json())
      .then((data) => setSurahs(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedSurah) {
      setLoadingVerses(true);
      setCurrentVerseIndex(0);
      setRevealedVerses(new Set());
      setVerseColors(new Map());
      setErrorCount(0);
      setInterimText("");
      setDebugSpokenText("");

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

  const checkVerse = useCallback((spokenText: string) => {
    if (!verses.length || currentVerseIndex >= verses.length) return;

    const currentVerse = verses[currentVerseIndex];
    const normalizedSpoken = normalizeArabic(spokenText);
    const normalizedExpected = normalizeArabic(currentVerse.text);

    const spokenWords = normalizedSpoken.split(/\s+/).filter(Boolean);
    const expectedWords = normalizedExpected.split(/\s+/).filter(Boolean);

    // سرعة أعلى: فقط نتحقق من أول 3-5 كلمات
    const wordsToCheck = Math.min(5, expectedWords.length);

    if (spokenWords.length >= wordsToCheck) {
      let matches = 0;
      for (let i = 0; i < wordsToCheck; i++) {
        if (spokenWords[i] === expectedWords[i]) {
          matches++;
        }
      }

      // لو 60% من أول الكلمات صح = ننتقل (أقل صرامة)
      const accuracy = matches / wordsToCheck;
      const isCorrect = accuracy >= 0.6;

      // اظهر الآية
      setRevealedVerses(prev => new Set(prev).add(currentVerse.verse));
      setVerseColors(prev => {
        const newMap = new Map(prev);
        newMap.set(currentVerse.verse, isCorrect ? "correct" : "wrong");
        return newMap;
      });

      if (!isCorrect) {
        setErrorCount(prev => prev + 1);
        playErrorSound();
      }

      // انتقل فوراً!
      setCurrentVerseIndex(prev => prev + 1);
      setInterimText("");
    }
  }, [verses, currentVerseIndex]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("المتصفح لا يدعم التعرف على الكلام. استخدم Chrome.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = "ar-SA";
      recognition.continuous = true;
      recognition.interimResults = true; // أسرع!

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = interimText;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += " " + transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const fullText = (finalTranscript + " " + interimTranscript).trim();
        setInterimText(finalTranscript);
        setDebugSpokenText(fullText); // عرض النص المسموع

        // Check in real-time
        if (fullText) {
          checkVerse(fullText);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        console.error("Error:", event.error);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    }
  }, [isListening, interimText, checkVerse]);

  const handleReset = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setCurrentVerseIndex(0);
    setRevealedVerses(new Set());
    setVerseColors(new Map());
    setDebugSpokenText("");
    setErrorCount(0);
    setInterimText("");
  };

  const getVerseDisplay = (verse: VerseData) => {
    const isRevealed = revealedVerses.has(verse.verse);
    const color = verseColors.get(verse.verse);
    const isCurrent = verse.verse === verses[currentVerseIndex]?.verse && isListening;

    if (!isRevealed) {
      // Hidden - show placeholder
      return (
        <span key={verse.verse} className="inline-block">
          <span className={`inline-block bg-gray-300 rounded h-8 animate-pulse ${isCurrent ? 'bg-amber-300' : ''}`} style={{ width: `${verse.text.length * 0.5}rem` }}>
            {" "}
          </span>
          <span className="inline-flex items-center text-xl opacity-30 mx-1">
            ﴿{verse.verse}﴾
          </span>
          {" "}
        </span>
      );
    }

    // Revealed - show with color
    return (
      <span
        key={verse.verse}
        className={`transition-all duration-300 ${color === "correct" ? "text-gray-800" : "text-red-500 font-bold"
          }`}
      >
        {verse.text}
        {" "}
        <span className="inline-flex items-center text-xl opacity-50">
          ﴿{verse.verse}﴾
        </span>
        {" "}
      </span>
    );
  };

  const selectedSurahData = surahs.find(s => s.number === selectedSurah);

  return (
    <div className="h-screen flex bg-[#f5f3f0]" dir="rtl">
      {/* Right Sidebar - Surah List */}
      <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-b from-emerald-600 to-emerald-700 text-white p-6">
          <h1 className="text-2xl font-bold mb-1">القرآن الكريم</h1>
          <p className="text-emerald-100 text-sm">اختر سورة للبدء</p>
        </div>

        <div className="p-2">
          {surahs.map((surah) => (
            <button
              key={surah.number}
              onClick={() => {
                setSelectedSurah(surah.number);
                handleReset();
              }}
              className={`
                w-full text-right px-4 py-3 rounded-lg mb-1 transition-all
                ${selectedSurah === surah.number
                  ? "bg-emerald-500 text-white shadow-md"
                  : "hover:bg-gray-100 text-gray-700"
                }
              `}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-lg">{surah.name}</span>
                <span className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm
                  ${selectedSurah === surah.number
                    ? "bg-white/20"
                    : "bg-gray-200 text-gray-600"
                  }
                `}>
                  {surah.number}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        {selectedSurah && (
          <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between max-w-5xl mx-auto">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {selectedSurahData?.name}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  الآية {currentVerseIndex + 1} من {verses.length}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">
                    {verseColors.size > 0
                      ? Math.round(((verseColors.size - errorCount) / verseColors.size) * 100)
                      : 0}%
                  </div>
                  <div className="text-xs text-gray-500">الدقة</div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">{errorCount}</div>
                  <div className="text-xs text-gray-500">أخطاء</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quran Text Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8">
            {!selectedSurah ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <div className="text-8xl mb-6">📖</div>
                <p className="text-2xl text-gray-500">اختر سورة من القائمة</p>
              </div>
            ) : loadingVerses ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-500 border-t-transparent" />
              </div>
            ) : (
              <div>
                {/* Bismillah */}
                {selectedSurah !== 1 && selectedSurah !== 9 && (
                  <div className="text-center mb-12">
                    <p className="text-3xl text-emerald-700" style={{ fontFamily: "Amiri, serif" }}>
                      بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                    </p>
                  </div>
                )}

                {/* Verses */}
                <div
                  className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-3xl leading-[4rem]"
                  style={{ fontFamily: "Amiri, serif" }}
                >
                  {verses.map((verse) => getVerseDisplay(verse))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Controls */}
        {selectedSurah && !loadingVerses && (
          <div className="bg-white/95 backdrop-blur border-t border-gray-200 shadow-lg">
            {/* Debug Text */}
            {debugSpokenText && (
              <div className="max-w-5xl mx-auto px-6 py-2 border-b border-gray-200">
                <div className="text-xs text-gray-500 mb-1">النص المسموع:</div>
                <div className="text-sm bg-gray-50 rounded px-3 py-2 font-mono text-gray-800">
                  {debugSpokenText}
                </div>
              </div>
            )}

            <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-center gap-6">
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition"
              >
                إعادة
              </button>

              <button
                onClick={toggleListening}
                className={`
                  w-20 h-20 rounded-full shadow-2xl transition-all transform hover:scale-105
                  ${isListening
                    ? "bg-gradient-to-br from-red-500 to-rose-600 animate-pulse"
                    : "bg-gradient-to-br from-emerald-500 to-teal-600"
                  }
                `}
              >
                {isListening ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white" className="mx-auto">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="mx-auto">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                )}
              </button>

              <div className="px-6 py-3 rounded-xl bg-emerald-50 text-emerald-700 font-medium">
                {isListening ? "جاري الاستماع..." : "اضغط للبدء"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
