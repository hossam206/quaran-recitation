"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { normalizeArabic, fuzzyMatchArabic } from "@/lib/quran-data";

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

interface WordStatus {
  verseNumber: number;
  wordIndex: number;
  word: string;
  isCorrect: boolean;
}

interface NormalizedVerse {
  verse: number;
  normalizedText: string;
  normalizedWords: string[];
  originalWords: string[];
}

export default function Home() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [verses, setVerses] = useState<VerseData[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [revealedWords, setRevealedWords] = useState<WordStatus[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [debugSpokenText, setDebugSpokenText] = useState("");
  const [debugNormalizedSpoken, setDebugNormalizedSpoken] = useState("");
  const [debugExpectedWord, setDebugExpectedWord] = useState("");
  const [showDebug, setShowDebug] = useState(false);

  // Refs for speech recognition processing
  const versesRef = useRef<VerseData[]>([]);
  const normalizedVersesRef = useRef<NormalizedVerse[]>([]);
  const vIdxRef = useRef(0);
  const wIdxRef = useRef(0);
  const isListeningRef = useRef(false);
  const revealedSetRef = useRef(new Set<string>());
  const currentSegmentIndexRef = useRef(-1);
  const processedWordCountRef = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audioContextRef = useRef<any>(null);
  const lastErrorSoundRef = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  // Auto-scroll ref
  const currentWordRef = useRef<HTMLSpanElement>(null);

  const playErrorSound = useCallback(() => {
    const now = Date.now();
    if (now - lastErrorSoundRef.current < 300) return;
    lastErrorSoundRef.current = now;

    if (!audioContextRef.current) {
      audioContextRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") ctx.resume();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 500;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
  }, []);

  useEffect(() => {
    fetch("/api/surahs")
      .then((res) => res.json())
      .then((data) => setSurahs(data))
      .catch(console.error);
  }, []);

  const normalizedVerses = useMemo(() => {
    return verses.map((v) => {
      const normalizedText = normalizeArabic(v.text);
      return {
        verse: v.verse,
        normalizedText,
        normalizedWords: normalizedText.split(/\s+/).filter(Boolean),
        originalWords: v.text.split(/\s+/).filter(Boolean),
      };
    });
  }, [verses]);

  useEffect(() => {
    normalizedVersesRef.current = normalizedVerses;
  }, [normalizedVerses]);

  useEffect(() => {
    if (selectedSurah) {
      setLoadingVerses(true);
      setCurrentVerseIndex(0);
      setCurrentWordIndex(0);
      setRevealedWords([]);
      setErrorCount(0);
      setDebugSpokenText("");
      setDebugNormalizedSpoken("");
      setDebugExpectedWord("");
      setIsSidebarOpen(false);

      vIdxRef.current = 0;
      wIdxRef.current = 0;
      revealedSetRef.current = new Set();
      currentSegmentIndexRef.current = -1;
      processedWordCountRef.current = 0;

      fetch(`/api/verses?surah=${selectedSurah}`)
        .then((res) => res.json())
        .then((data) => {
          setVerses(data);
          versesRef.current = data;
          setLoadingVerses(false);

          setTimeout(() => {
            if (!isListeningRef.current) {
              startRecording();
            }
          }, 100);
        })
        .catch((err) => {
          console.error(err);
          setLoadingVerses(false);
        });
    } else {
      setVerses([]);
      versesRef.current = [];
      normalizedVersesRef.current = [];
    }
  }, [selectedSurah]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Auto-scroll to current word
  useEffect(() => {
    if (currentWordRef.current && isListening) {
      currentWordRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentVerseIndex, currentWordIndex, isListening]);

  const revealedMap = useMemo(() => {
    const map = new Map<string, WordStatus>();
    for (const rw of revealedWords) {
      map.set(`${rw.verseNumber}-${rw.wordIndex}`, rw);
    }
    return map;
  }, [revealedWords]);

  const processNewWords = useCallback(
    (spokenWords: string[]) => {
      const localNormalizedVerses = normalizedVersesRef.current;
      if (!localNormalizedVerses.length || !spokenWords.length) return;

      let vIdx = vIdxRef.current;
      let wIdx = wIdxRef.current;

      if (vIdx >= localNormalizedVerses.length) return;

      let currentVerse = localNormalizedVerses[vIdx];
      if (wIdx >= currentVerse.normalizedWords.length) {
        vIdx++;
        wIdx = 0;
        if (vIdx >= localNormalizedVerses.length) return;
        currentVerse = localNormalizedVerses[vIdx];
      }

      const firstWord = spokenWords[0];
      const currentExpectedWord = currentVerse.normalizedWords[wIdx];
      const isSequential = fuzzyMatchArabic(firstWord, currentExpectedWord);

      if (isSequential) {
        let spokenIdx = 0;
        const newReveals: WordStatus[] = [];
        let newErrors = 0;

        while (
          vIdx < localNormalizedVerses.length &&
          spokenIdx < spokenWords.length
        ) {
          const nv = localNormalizedVerses[vIdx];
          if (wIdx >= nv.normalizedWords.length) {
            vIdx++;
            wIdx = 0;
            continue;
          }

          const key = `${nv.verse}-${wIdx}`;
          if (revealedSetRef.current.has(key)) {
            wIdx++;
            continue;
          }

          const spokenWord = spokenWords[spokenIdx];
          const expectedWord = nv.normalizedWords[wIdx];
          const isCorrect = fuzzyMatchArabic(spokenWord, expectedWord);

          if (spokenIdx === 0) {
            setDebugExpectedWord(`"${expectedWord}" ← "${spokenWord}"`);
          }

          newReveals.push({
            verseNumber: nv.verse,
            wordIndex: wIdx,
            word: nv.originalWords[wIdx],
            isCorrect,
          });

          if (!isCorrect) {
            newErrors++;
            playErrorSound();
          }

          revealedSetRef.current.add(key);
          wIdx++;
          spokenIdx++;
        }

        if (newReveals.length > 0) {
          vIdxRef.current = vIdx;
          wIdxRef.current = wIdx;
          setRevealedWords((prev) => [...prev, ...newReveals]);
          setErrorCount((prev) => prev + newErrors);
          setCurrentVerseIndex(vIdx);
          setCurrentWordIndex(wIdx);
        }
      } else {
        const windowSize = 10;
        let searchV = vIdx;
        let searchW = wIdx;
        let foundPosition = -1;
        let foundV = -1;
        let foundW = -1;

        for (
          let i = 0;
          i < windowSize && searchV < localNormalizedVerses.length;
          i++
        ) {
          const verse = localNormalizedVerses[searchV];
          if (searchW >= verse.normalizedWords.length) {
            searchV++;
            searchW = 0;
            continue;
          }
          if (fuzzyMatchArabic(firstWord, verse.normalizedWords[searchW])) {
            foundPosition = i;
            foundV = searchV;
            foundW = searchW;
            break;
          }
          searchW++;
        }

        if (foundPosition >= 0) {
          const skippedReveals: WordStatus[] = [];
          let skipV = vIdx;
          let skipW = wIdx;

          for (let i = 0; i < foundPosition; i++) {
            const verse = localNormalizedVerses[skipV];
            if (skipW >= verse.normalizedWords.length) {
              skipV++;
              skipW = 0;
              continue;
            }
            const key = `${verse.verse}-${skipW}`;
            if (!revealedSetRef.current.has(key)) {
              skippedReveals.push({
                verseNumber: verse.verse,
                wordIndex: skipW,
                word: verse.originalWords[skipW],
                isCorrect: false,
              });
              revealedSetRef.current.add(key);
            }
            skipW++;
          }

          if (skippedReveals.length > 0) {
            playErrorSound();
          }

          let spokenIdx = 0;
          let matchV = foundV;
          let matchW = foundW;
          const matchReveals: WordStatus[] = [];

          while (
            matchV < localNormalizedVerses.length &&
            spokenIdx < spokenWords.length
          ) {
            const verse = localNormalizedVerses[matchV];
            if (matchW >= verse.normalizedWords.length) {
              matchV++;
              matchW = 0;
              continue;
            }
            const key = `${verse.verse}-${matchW}`;
            if (revealedSetRef.current.has(key)) {
              matchW++;
              continue;
            }

            const spokenWord = spokenWords[spokenIdx];
            const expectedWord = verse.normalizedWords[matchW];
            const isCorrect = fuzzyMatchArabic(spokenWord, expectedWord);

            if (spokenIdx === 0) {
              setDebugExpectedWord(
                `\u2713 \u0642\u0641\u0632 ${foundPosition} \u2190 "${spokenWord}"`,
              );
            }

            matchReveals.push({
              verseNumber: verse.verse,
              wordIndex: matchW,
              word: verse.originalWords[matchW],
              isCorrect,
            });

            if (!isCorrect) {
              playErrorSound();
            }

            revealedSetRef.current.add(key);
            matchW++;
            spokenIdx++;
          }

          const allReveals = [...skippedReveals, ...matchReveals];
          if (allReveals.length > 0) {
            vIdxRef.current = matchV;
            wIdxRef.current = matchW;
            setRevealedWords((prev) => [...prev, ...allReveals]);
            setErrorCount(
              (prev) =>
                prev +
                skippedReveals.length +
                matchReveals.filter((r) => !r.isCorrect).length,
            );
            setCurrentVerseIndex(matchV);
            setCurrentWordIndex(matchW);
          }
        }
      }
    },
    [playErrorSound],
  );

  const startRecording = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(
        "\u0627\u0644\u0645\u062A\u0635\u0641\u062D \u0644\u0627 \u064A\u062F\u0639\u0645 \u0627\u0644\u062A\u0639\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0643\u0644\u0627\u0645. \u0627\u0633\u062A\u062E\u062F\u0645 Chrome.",
      );
      return;
    }

    currentSegmentIndexRef.current = -1;
    processedWordCountRef.current = 0;

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      const latestIndex = event.results.length - 1;
      const latestResult = event.results[latestIndex];
      const transcript = latestResult[0].transcript;

      setDebugSpokenText(transcript);

      if (!transcript) return;

      const normalizedSpoken = normalizeArabic(transcript);
      const allWords = normalizedSpoken.split(/\s+/).filter(Boolean);
      if (!allWords.length) return;

      if (latestIndex !== currentSegmentIndexRef.current) {
        currentSegmentIndexRef.current = latestIndex;
        processedWordCountRef.current = 0;
      }

      const newWords = allWords.slice(processedWordCountRef.current);

      if (newWords.length > 0) {
        setDebugNormalizedSpoken(newWords.join(" "));
        processNewWords(newWords);
        processedWordCountRef.current = allWords.length;
      }

      if (latestResult.isFinal) {
        currentSegmentIndexRef.current = -1;
        processedWordCountRef.current = 0;
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Error:", event.error);
      if (event.error !== "aborted") {
        setTimeout(() => {
          if (isListeningRef.current) startRecording();
        }, 100);
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current && versesRef.current.length > 0) {
        startRecording();
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
    isListeningRef.current = true;
  }, [processNewWords]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsListening(false);
      isListeningRef.current = false;
    } else {
      startRecording();
    }
  }, [isListening, startRecording]);

  const handleReset = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    isListeningRef.current = false;
    setCurrentVerseIndex(0);
    setCurrentWordIndex(0);
    setRevealedWords([]);
    setErrorCount(0);
    setDebugSpokenText("");
    setDebugNormalizedSpoken("");
    setDebugExpectedWord("");

    vIdxRef.current = 0;
    wIdxRef.current = 0;
    revealedSetRef.current = new Set();
    currentSegmentIndexRef.current = -1;
    processedWordCountRef.current = 0;
  };

  const filteredSurahs = useMemo(() => {
    return surahs.filter(
      (s) =>
        s.name.includes(searchTerm) ||
        s.englishName?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [surahs, searchTerm]);

  const selectedSurahData = surahs.find((s) => s.number === selectedSurah);

  const totalWords = useMemo(() => {
    return verses.reduce((acc, v) => acc + v.text.split(/\s+/).length, 0);
  }, [verses]);

  const accuracy =
    revealedWords.length > 0
      ? Math.round(
          (revealedWords.filter((w) => w.isCorrect).length /
            revealedWords.length) *
            100,
        )
      : 0;

  const progressPercent =
    totalWords > 0 ? (revealedWords.length / totalWords) * 100 : 0;
  const isComplete = totalWords > 0 && revealedWords.length >= totalWords;

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#FDFBF7]" dir="rtl">
      {/* ─── Mobile Header ─── */}
      <div className="md:hidden bg-white/80 backdrop-blur-md border-b border-emerald-100 p-4 flex items-center justify-between z-40 sticky top-0">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 bg-emerald-50 text-emerald-600 rounded-xl active:scale-95 transition-transform"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-emerald-900">مُرَتِّل</h1>
          <span className="text-2xl">📖</span>
        </div>
        <div className="w-10" />
      </div>

      {/* ─── Sidebar ─── */}
      <aside
        className={`
        fixed inset-0 z-50 md:relative md:z-20 w-full md:w-80 bg-white/70 backdrop-blur-xl border-l border-emerald-100 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
      `}
      >
        <div className="p-6 md:p-8 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <span className="text-xl text-white">📖</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-emerald-900 leading-tight">
                  مُرَتِّل
                </h1>
                <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-tighter">
                  Quran Recitation
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 text-emerald-400 active:scale-95 transition-transform"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="ابحث عن سورة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-200 transition-all"
            />
            <SearchIcon className="absolute left-3 top-3 w-4 h-4 text-emerald-300" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 scrollbar-hide">
          {filteredSurahs?.map((surah) => (
            <button
              key={surah.number}
              onClick={() => setSelectedSurah(surah.number)}
              className={`
                w-full text-right px-4 py-3 rounded-2xl flex items-center justify-between transition-all duration-200 group active:scale-[0.98] cursor-pointer
                ${
                  selectedSurah === surah.number
                    ? "bg-gradient-to-l from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-200/50"
                    : "hover:bg-emerald-50 text-emerald-900"
                }
              `}
            >
              <div className="flex flex-col">
                <span className="font-bold text-sm md:text-[1.05rem] !cursor-pointer">
                  {surah.name}
                </span>
                <span
                  className={`text-[0.6rem] !cursor-pointer ${selectedSurah === surah.number ? "text-emerald-100" : "text-emerald-500"}`}
                >
                  {surah.englishName}
                </span>
              </div>
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold transition-colors ${selectedSurah === surah.number ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100"}`}
              >
                {surah.number}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-full">
        {/* Background blobs */}
        <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-emerald-50 rounded-full blur-3xl opacity-50 -mr-32 md:-mr-48 -mt-32 md:-mt-48 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 md:w-96 h-64 md:h-96 bg-amber-50 rounded-full blur-3xl opacity-50 -ml-32 md:-ml-48 -mb-32 md:-mb-48 pointer-events-none" />

        {/* ─── Nav Bar with Stats ─── */}
        {selectedSurah && (
          <div className="relative z-10">
            <nav className="px-4 md:px-8 py-4 md:py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex flex-col items-center sm:items-start">
                <h2
                  className="text-2xl md:text-3xl font-black text-emerald-900"
                  style={{ fontFamily: "var(--font-amiri), Amiri, serif" }}
                >
                  {selectedSurahData?.name}
                </h2>
                <span className="text-[10px] md:text-xs text-emerald-500 mt-0.5">
                  {revealedWords.length} / {totalWords} كلمة
                </span>
              </div>

              <div className="flex gap-2">
                {/* Accuracy */}
                <div className="bg-white/80 backdrop-blur border border-emerald-100 px-3 md:px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm">
                  <div className="relative w-8 h-8">
                    <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
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
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-emerald-700">
                      {accuracy}%
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-600 hidden md:block">
                    الدقة
                  </span>
                </div>

                {/* Errors */}
                <div
                  className={`backdrop-blur border px-3 md:px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm transition-colors ${errorCount > 0 ? "bg-rose-50/80 border-rose-100" : "bg-white/80 border-emerald-100"}`}
                >
                  <span
                    className={`text-lg md:text-xl font-black ${errorCount > 0 ? "text-rose-500" : "text-emerald-300"}`}
                  >
                    {errorCount}
                  </span>
                  <span
                    className={`text-[9px] font-bold hidden md:block ${errorCount > 0 ? "text-rose-400" : "text-emerald-400"}`}
                  >
                    أخطاء
                  </span>
                </div>
              </div>
            </nav>

            {/* Progress bar */}
            <div className="h-1 bg-emerald-50 mx-4 md:mx-8 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-emerald-400 to-emerald-600 rounded-full transition-all duration-700 ease-out animate-progress-glow"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* ─── Verse Content ─── */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 relative z-10 pb-44">
          <div className="max-w-4xl mx-auto py-6 md:py-8">
            {!selectedSurah ? (
              /* ─── Welcome State ─── */
              <div className="h-full flex flex-col items-center justify-center text-center mt-10 px-6 animate-fade-in-up">
                <div className="w-28 h-28 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-full flex items-center justify-center mb-8 shadow-lg shadow-emerald-100/50">
                  <span className="text-5xl">🕌</span>
                </div>
                <h3 className="text-2xl font-black text-emerald-900 mb-3">
                  مرحباً بك في مُرَتِّل
                </h3>
                <p className="text-emerald-600 max-w-xs text-sm mb-10 leading-relaxed">
                  اختبر حفظك وحسّن تلاوتك بتقنية التعرف على الصوت
                </p>

                <div className="flex gap-4 md:gap-6">
                  {[
                    {
                      icon: "📋",
                      title: "اختر سورة",
                      desc: "من القائمة الجانبية",
                    },
                    {
                      icon: "🎙️",
                      title: "ابدأ التلاوة",
                      desc: "التعرف التلقائي",
                    },
                    { icon: "✅", title: "راجع أدائك", desc: "دقة وأخطاء" },
                  ].map((step, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-2 w-24 md:w-28"
                    >
                      <div className="w-14 h-14 bg-white rounded-2xl shadow-md shadow-emerald-100/50 flex items-center justify-center text-2xl border border-emerald-50">
                        {step.icon}
                      </div>
                      <span className="text-xs font-bold text-emerald-800">
                        {step.title}
                      </span>
                      <span className="text-[10px] text-emerald-500 leading-tight">
                        {step.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : loadingVerses ? (
              <div className="h-full flex flex-col items-center justify-center mt-20 animate-fade-in-up">
                <div className="loader" />
                <p className="mt-4 text-emerald-600 font-medium">
                  جاري التحميل...
                </p>
              </div>
            ) : (
              <div className="space-y-8 md:space-y-12 animate-fade-in-up">
                {/* ─── Bismillah ─── */}
                {selectedSurah !== 1 && selectedSurah !== 9 && (
                  <div className="text-center py-4">
                    <div className="ornament-line mb-4">
                      <span className="text-emerald-300 text-lg">✦</span>
                    </div>
                    <p
                      className="text-2xl md:text-4xl text-emerald-800 tracking-wide"
                      style={{ fontFamily: "var(--font-amiri), Amiri, serif" }}
                    >
                      بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                    </p>
                    <div className="ornament-line mt-4">
                      <span className="text-emerald-300 text-lg">✦</span>
                    </div>
                  </div>
                )}

                {/* ─── Verse Display ─── */}
                <div className="relative bg-white/90 backdrop-blur-sm rounded-[1.5rem] md:rounded-[2rem] border border-white shadow-2xl shadow-emerald-100/20 p-6 md:p-16">
                  <div
                    className="text-2xl md:text-4xl leading-[3.5rem] md:leading-[5.5rem] text-center"
                    style={{ fontFamily: "var(--font-amiri), Amiri, serif" }}
                  >
                    {verses.map((verse, vIdx) => {
                      const words = verse.text.split(/\s+/);
                      return (
                        <span key={verse.verse} className="inline">
                          {words.map((word, wIdx) => {
                            const revealed = revealedMap.get(
                              `${verse.verse}-${wIdx}`,
                            );
                            const isCurrent =
                              vIdx === currentVerseIndex &&
                              wIdx === currentWordIndex &&
                              isListening;

                            return (
                              <span
                                key={`${verse.verse}-${wIdx}`}
                                className="inline-block mx-0.5 md:mx-1"
                                ref={isCurrent ? currentWordRef : undefined}
                              >
                                {!revealed ? (
                                  <span
                                    className={`inline-block rounded-full transition-all duration-300 ${
                                      isCurrent
                                        ? "bg-amber-100 animate-breathe h-4 md:h-5"
                                        : "bg-emerald-50/80 animate-shimmer h-3 md:h-4"
                                    }`}
                                    style={{
                                      width: `${Math.max(1.5, word.length * 0.55)}rem`,
                                    }}
                                  />
                                ) : (
                                  <span
                                    className={`inline ${revealed.isCorrect ? "text-emerald-900 animate-correct" : "text-rose-600 font-bold underline decoration-rose-200 decoration-2 underline-offset-4 animate-wrong bg-rose-50/50 rounded px-0.5"}`}
                                  >
                                    {word}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                          <span className="inline-flex items-center text-lg md:text-2xl text-amber-500/40 font-serif mx-1 md:mx-3 select-none">
                            ﴿{verse.verse}﴾
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Completion Overlay ─── */}
        {isComplete && (
          <div className="absolute inset-0 z-40 bg-white/80 backdrop-blur-lg flex items-center justify-center animate-fade-in-up">
            {/* Decorative sparkles */}
            <div className="absolute top-[15%] right-[20%] text-amber-400 text-2xl sparkle-1">
              ✦
            </div>
            <div className="absolute top-[25%] left-[15%] text-emerald-400 text-lg sparkle-2">
              ✦
            </div>
            <div className="absolute bottom-[30%] right-[15%] text-emerald-300 text-xl sparkle-3">
              ✦
            </div>
            <div className="absolute bottom-[20%] left-[25%] text-amber-300 text-sm sparkle-4">
              ✦
            </div>

            <div className="text-center px-6 max-w-sm">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-200">
                <CheckIcon className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-black text-emerald-900 mb-2">
                أحسنت!
              </h3>
              <p className="text-emerald-600 text-sm mb-6">
                أتممت تلاوة {selectedSurahData?.name}
              </p>

              <div className="flex justify-center gap-4 mb-8">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-3 text-center">
                  <div className="text-2xl font-black text-emerald-600">
                    {accuracy}%
                  </div>
                  <div className="text-[10px] font-bold text-emerald-500 mt-0.5">
                    الدقة
                  </div>
                </div>
                <div
                  className={`border rounded-2xl px-5 py-3 text-center ${errorCount > 0 ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"}`}
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

              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-gradient-to-l from-emerald-500 to-emerald-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-200/50 active:scale-95 transition-transform"
                >
                  إعادة التلاوة
                </button>
                <button
                  onClick={() => {
                    handleReset();
                    setSelectedSurah(null);
                  }}
                  className="px-6 py-3 bg-white border border-emerald-200 text-emerald-700 rounded-2xl font-bold text-sm shadow-sm active:scale-95 transition-transform"
                >
                  سورة أخرى
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Bottom Control Panel ─── */}
        {selectedSurah && !loadingVerses && !isComplete && (
          <div className="fixed bottom-0 left-1/2 right-1/2 z-30 pb-4 md:pb-6 pt-4 pointer-events-none flex flex-col justify-center items-center">
            <div className="pointer-events-auto">
              {/* Debug panel (toggleable) */}
              {showDebug && debugSpokenText && (
                <div className="mb-2 animate-slide-up">
                  <div className="bg-gray-900/90 backdrop-blur-md text-gray-200 px-4 py-2 rounded-xl text-xs shadow-2xl border border-gray-700/50 space-y-1 font-mono">
                    <div className="flex gap-2">
                      <span className="text-gray-500">raw:</span>
                      <span className="truncate">{debugSpokenText}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-500">norm:</span>
                      <span className="truncate">{debugNormalizedSpoken}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-gray-500">cmp:</span>
                      <span className="truncate">{debugExpectedWord}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Main control bar — compact centered pill */}
              <div className="bg-white/90 backdrop-blur-2xl border border-white/80 rounded-full shadow-2xl shadow-emerald-100/30 px-4 md:px-6 py-2 md:py-3 pointer-events-auto flex items-center justify-center gap-10 md:gap-5">
                {/* Reset */}
                <button
                  onClick={handleReset}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 active:scale-95 transition-all"
                >
                  <RefreshIcon className="w-5 h-5" />
                </button>

                {/* Mic + Status */}
                <div className="flex flex-col  items-center gap-1">
                  {/* Listening indicator */}
                  <div className="flex items-center gap-2 h-5">
                    {isListening ? (
                      <>
                        <div className="flex items-end gap-[2px]">
                          <div className="w-[3px] bg-rose-400 rounded-full sound-bar-1" />
                          <div className="w-[3px] bg-rose-500 rounded-full sound-bar-2" />
                          <div className="w-[3px] bg-rose-400 rounded-full sound-bar-3" />
                        </div>
                        <span className="text-[10px] font-bold text-rose-500">
                          جاري التعرف
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-300">
                        جاهز
                      </span>
                    )}
                  </div>

                  {/* Mic button */}
                  <div className="relative">
                    {isListening && (
                      <>
                        <div className="absolute inset-0 rounded-full bg-rose-400/20 animate-sonar" />
                        <div className="absolute inset-0 rounded-full bg-rose-400/15 animate-sonar-delayed" />
                      </>
                    )}
                    <button
                      onClick={toggleListening}
                      className={`relative z-10 w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg ${
                        isListening
                          ? "bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-200/50"
                          : "bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-200/50"
                      }`}
                    >
                      {isListening ? (
                        <StopIcon className="w-5 h-5 text-white" />
                      ) : (
                        <MicIcon className="w-7 h-7 text-white" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Debug toggle */}
                <button
                  onClick={() => setShowDebug((v) => !v)}
                  className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center active:scale-95 transition-all ${showDebug ? "bg-gray-100 text-gray-600" : "bg-emerald-50 text-emerald-400"}`}
                >
                  <BugIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-emerald-950/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}

/* ─── Sub-Components ─── */

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={3}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 12.75 6 6 9-13.5"
      />
    </svg>
  );
}

function BugIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      />
    </svg>
  );
}
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
      <path d="M6 10.5a.75.75 0 0 1 .75.75 5.25 5.25 0 1 0 10.5 0 .75.75 0 0 1 1.5 0 6.75 6.75 0 0 1-6 6.709V21a.75.75 0 0 1-1.5 0v-3.041a6.75 6.75 0 0 1-6-6.709A.75.75 0 0 1 6 10.5Z" />
    </svg>
  );
}
function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}
