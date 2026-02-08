"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

  // Refs to allow the speech recognition closure to ALWAYS see the latest state
  const versesRef = useRef<VerseData[]>([]);
  const normalizedVersesRef = useRef<NormalizedVerse[]>([]);
  const vIdxRef = useRef(0);
  const wIdxRef = useRef(0);
  const revealedWordsRef = useRef<WordStatus[]>([]);
  const isListeningRef = useRef(false);
  const lastProcessedTimeRef = useRef(0);

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

  // Memoize normalized verses to avoid repeated normalization
  const normalizedVerses = useMemo(() => {
    return verses.map(v => ({
      verse: v.verse,
      normalizedText: normalizeArabic(v.text),
      normalizedWords: normalizeArabic(v.text).split(/\s+/).filter(Boolean),
      originalWords: v.text.split(/\s+/).filter(Boolean)
    }));
  }, [verses]);

  useEffect(() => {
    normalizedVersesRef.current = normalizedVerses;
  }, [normalizedVerses]);

  useEffect(() => {
    if (selectedSurah) {
      setLoadingVerses(true);
      // Reset state and refs
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
      revealedWordsRef.current = [];

      fetch(`/api/verses?surah=${selectedSurah}`)
        .then((res) => res.json())
        .then((data) => {
          setVerses(data);
          versesRef.current = data;
          setLoadingVerses(false);

          // Auto-start recording
          setTimeout(() => {
            if (!isListeningRef.current) {
              startRecording();
            }
          }, 500);
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

  // Sync state with refs for the UI components
  useEffect(() => {
    vIdxRef.current = currentVerseIndex;
    wIdxRef.current = currentWordIndex;
    revealedWordsRef.current = revealedWords;
    isListeningRef.current = isListening;
  }, [currentVerseIndex, currentWordIndex, revealedWords, isListening]);

  const processSpokenText = useCallback((spokenText: string) => {
    // Throttle: Only process every 200ms to avoid excessive re-renders
    const now = Date.now();
    if (now - lastProcessedTimeRef.current < 200) return;
    lastProcessedTimeRef.current = now;

    const localNormalizedVerses = normalizedVersesRef.current;
    if (!localNormalizedVerses.length) return;

    const normalizedSpoken = normalizeArabic(spokenText);
    const spokenWords = normalizedSpoken.split(/\s+/).filter(Boolean);
    if (!spokenWords.length) return;

    setDebugNormalizedSpoken(spokenWords.join(" "));

    // HYBRID LOGIC: Try sequential match first, fall back to sliding window
    let vIdx = vIdxRef.current;
    let wIdx = wIdxRef.current;
    const firstSpokenWord = spokenWords[0];

    // Get current expected word
    if (vIdx >= localNormalizedVerses.length) return;
    let currentVerse = localNormalizedVerses[vIdx];
    if (wIdx >= currentVerse.normalizedWords.length) {
      vIdx++;
      wIdx = 0;
      if (vIdx >= localNormalizedVerses.length) return;
      currentVerse = localNormalizedVerses[vIdx];
    }

    const currentExpectedWord = currentVerse.normalizedWords[wIdx];

    // Check if first spoken word matches current position
    const isSequential = firstSpokenWord === currentExpectedWord;

    if (isSequential) {
      // SEQUENTIAL MATCH: User is reciting in order
      let spokenIdx = 0;
      const newReveals: WordStatus[] = [];
      let newErrors = 0;

      while (vIdx < localNormalizedVerses.length && spokenIdx < spokenWords.length) {
        const normalizedVerse = localNormalizedVerses[vIdx];

        if (wIdx >= normalizedVerse.normalizedWords.length) {
          vIdx++;
          wIdx = 0;
          continue;
        }

        const alreadyRevealed = revealedWordsRef.current.some(rw =>
          rw.verseNumber === normalizedVerse.verse && rw.wordIndex === wIdx
        );

        if (alreadyRevealed) {
          wIdx++;
          continue;
        }

        const spokenWord = spokenWords[spokenIdx];
        const expectedWord = normalizedVerse.normalizedWords[wIdx];
        const isCorrect = spokenWord === expectedWord;

        if (spokenIdx === 0) {
          setDebugExpectedWord(`"${expectedWord}" ← "${spokenWord}"`);
        }

        newReveals.push({
          verseNumber: normalizedVerse.verse,
          wordIndex: wIdx,
          word: normalizedVerse.originalWords[wIdx],
          isCorrect
        });

        if (!isCorrect) {
          newErrors++;
          playErrorSound();
        }

        wIdx++;
        spokenIdx++;
      }

      if (newReveals.length > 0) {
        setRevealedWords(prev => [...prev, ...newReveals]);
        setErrorCount(prev => prev + newErrors);
        setCurrentVerseIndex(vIdx);
        setCurrentWordIndex(wIdx);
      }
    } else {
      // SLIDING WINDOW: User might have skipped words - find first match
      const windowSize = 10;
      let searchV = vIdx;
      let searchW = wIdx;
      let foundPosition = -1;
      let foundV = -1;
      let foundW = -1;

      for (let i = 0; i < windowSize && searchV < localNormalizedVerses.length; i++) {
        const verse = localNormalizedVerses[searchV];

        if (searchW >= verse.normalizedWords.length) {
          searchV++;
          searchW = 0;
          continue;
        }

        if (firstSpokenWord === verse.normalizedWords[searchW]) {
          foundPosition = i;
          foundV = searchV;
          foundW = searchW;
          break;
        }

        searchW++;
      }

      if (foundPosition >= 0) {
        // Found the word! Mark skipped words as errors and continue from there
        const skippedReveals: WordStatus[] = [];
        let skipV = vIdx;
        let skipW = wIdx;

        // Mark all skipped words
        for (let i = 0; i < foundPosition; i++) {
          const verse = localNormalizedVerses[skipV];
          if (skipW >= verse.normalizedWords.length) {
            skipV++;
            skipW = 0;
            continue;
          }

          const alreadyRevealed = revealedWordsRef.current.some(rw =>
            rw.verseNumber === verse.verse && rw.wordIndex === skipW
          );

          if (!alreadyRevealed) {
            skippedReveals.push({
              verseNumber: verse.verse,
              wordIndex: skipW,
              word: verse.originalWords[skipW],
              isCorrect: false
            });
          }

          skipW++;
        }

        if (skippedReveals.length > 0) {
          playErrorSound();
        }

        // Now match from found position
        let spokenIdx = 0;
        let matchV = foundV;
        let matchW = foundW;
        const matchReveals: WordStatus[] = [];

        while (matchV < localNormalizedVerses.length && spokenIdx < spokenWords.length) {
          const verse = localNormalizedVerses[matchV];

          if (matchW >= verse.normalizedWords.length) {
            matchV++;
            matchW = 0;
            continue;
          }

          const alreadyRevealed = revealedWordsRef.current.some(rw =>
            rw.verseNumber === verse.verse && rw.wordIndex === matchW
          );

          if (alreadyRevealed) {
            matchW++;
            continue;
          }

          const spokenWord = spokenWords[spokenIdx];
          const expectedWord = verse.normalizedWords[matchW];
          const isCorrect = spokenWord === expectedWord;

          if (spokenIdx === 0) {
            setDebugExpectedWord(`✓ قفز ${foundPosition} ← "${spokenWord}"`);
          }

          matchReveals.push({
            verseNumber: verse.verse,
            wordIndex: matchW,
            word: verse.originalWords[matchW],
            isCorrect
          });

          if (!isCorrect) {
            playErrorSound();
          }

          matchW++;
          spokenIdx++;
        }

        const allReveals = [...skippedReveals, ...matchReveals];
        setRevealedWords(prev => [...prev, ...allReveals]);
        setErrorCount(prev => prev + skippedReveals.length + matchReveals.filter(r => !r.isCorrect).length);
        setCurrentVerseIndex(matchV);
        setCurrentWordIndex(matchW);
      }
    }
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("المتصفح لا يدعم التعرف على الكلام. استخدم Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // If we matched something, we might want to "consume" the transcript
          // But Web Speech keeps adding to the same buffer in continuous mode.
          // So we process the whole thing and let the engine decide.
        } else {
          interimTranscript += transcript;
        }
      }

      // In this refined version, we use the raw result from the event
      const latestTranscript = event.results[event.results.length - 1][0].transcript;
      setDebugSpokenText(latestTranscript);

      if (latestTranscript) {
        processSpokenText(latestTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Error:", event.error);
      if (event.error !== 'aborted') {
        setTimeout(() => {
          if (isListeningRef.current) startRecording();
        }, 1000);
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current && versesRef.current.length > 0) {
        setTimeout(() => startRecording(), 500);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
    isListeningRef.current = true;
  }, [processSpokenText]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; // Prevent auto-restart
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
    revealedWordsRef.current = [];
  };

  const filteredSurahs = useMemo(() => {
    return surahs.filter(s =>
      s.name.includes(searchTerm) ||
      s.englishName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [surahs, searchTerm]);

  const selectedSurahData = surahs.find(s => s.number === selectedSurah);

  const totalWords = useMemo(() => {
    return verses.reduce((acc, v) => acc + v.text.split(/\s+/).length, 0);
  }, [verses]);

  return (
    <div className="h-screen flex flex-col md:flex-row bg-[#FDFBF7]" dir="rtl">
      {/* Mobile Header */}
      <div className="md:hidden bg-white/80 backdrop-blur-md border-b border-emerald-100 p-4 flex items-center justify-between z-40 sticky top-0">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-emerald-900">مُرَتِّل</h1>
          <span className="text-2xl">📖</span>
        </div>
        <div className="w-10" />
      </div>

      {/* Premium Sidebar */}
      <aside className={`
        fixed inset-0 z-50 md:relative md:z-20 w-full md:w-80 bg-white/70 backdrop-blur-xl border-l border-emerald-100 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
      `}>
        <div className="p-6 md:p-8 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <span className="text-xl text-white">📖</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-emerald-900 leading-tight">مُرَتِّل</h1>
                <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-tighter">Quran Recitation</p>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-emerald-400">
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="ابحث عن سورة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
            <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-emerald-300" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 scrollbar-hide">
          {filteredSurahs.map((surah) => (
            <button
              key={surah.number}
              onClick={() => setSelectedSurah(surah.number)}
              className={`
                w-full text-right px-4 py-3 rounded-2xl flex items-center justify-between transition-all duration-300 group
                ${selectedSurah === surah.number
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100"
                  : "hover:bg-emerald-50 text-emerald-900"
                }
              `}
            >
              <div className="flex flex-col">
                <span className="font-bold text-sm md:text-[1.05rem]">{surah.name}</span>
                <span className={`text-[0.6rem] ${selectedSurah === surah.number ? "text-emerald-100" : "text-emerald-500"}`}>
                  {surah.englishName}
                </span>
              </div>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${selectedSurah === surah.number ? "bg-white/20" : "bg-emerald-50 text-emerald-600"}`}>
                {surah.number}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Experience */}
      <aside className="flex-1 flex flex-col relative overflow-hidden h-full">
        <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-emerald-50 rounded-full blur-3xl opacity-50 -mr-32 md:-mr-48 -mt-32 md:-mt-48" />
        <div className="absolute bottom-0 left-0 w-64 md:w-96 h-64 md:h-96 bg-amber-50 rounded-full blur-3xl opacity-50 -ml-32 md:-ml-48 -mb-32 md:-mb-48" />

        {selectedSurah && (
          <nav className="relative z-10 px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-col items-center sm:items-start">
              <h2 className="text-2xl md:text-3xl font-black text-emerald-900" style={{ fontFamily: "Amiri, serif" }}>
                {selectedSurahData?.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] md:text-xs font-bold text-emerald-600 uppercase tracking-widest">
                  كلمة {revealedWords.length} من {totalWords}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <StatusCard label="الدقة" value={`${revealedWords.length > 0 ? Math.round(((revealedWords.filter(w => w.isCorrect).length) / revealedWords.length) * 100) : 0}%`} color="emerald" />
              <StatusCard label="أخطاء" value={errorCount} color="rose" />
            </div>
          </nav>
        )}

        <div className="flex-1 overflow-y-auto px-4 md:px-8 relative z-10 pb-40">
          <div className="max-w-4xl mx-auto py-6 md:py-8">
            {!selectedSurah ? (
              <div className="h-full flex flex-col items-center justify-center text-center mt-10 px-6">
                <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                  <span className="text-4xl text-emerald-600">🕌</span>
                </div>
                <h3 className="text-xl font-bold text-emerald-900 mb-2">مرحباً بك في مُرَتِّل</h3>
                <p className="text-emerald-600 max-w-xs text-sm">قم باختيار سورة للبدء في مراجعة تلاوتك</p>
              </div>
            ) : loadingVerses ? (
              <div className="h-full flex flex-col items-center justify-center mt-20">
                <div className="loader ring-emerald-500" />
                <p className="mt-4 text-emerald-600 font-medium">جاري التحميل...</p>
              </div>
            ) : (
              <div className="space-y-8 md:space-y-12">
                {selectedSurah !== 1 && selectedSurah !== 9 && (
                  <div className="text-center">
                    <p className="text-2xl md:text-4xl text-emerald-800" style={{ fontFamily: "Amiri, serif" }}>
                      بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                    </p>
                  </div>
                )}

                <div className="relative bg-white/90 backdrop-blur-sm rounded-[1.5rem] md:rounded-[2rem] border border-white shadow-2xl p-6 md:p-16">
                  <div
                    className="text-2xl md:text-4xl leading-[3.5rem] md:leading-[5.5rem] text-center"
                    style={{ fontFamily: "Amiri, serif" }}
                  >
                    {verses.map((verse, vIdx) => {
                      const words = verse.text.split(/\s+/);
                      return (
                        <span key={verse.verse} className="inline">
                          {words.map((word, wIdx) => {
                            const revealed = revealedWords.find(rw =>
                              rw.verseNumber === verse.verse && rw.wordIndex === wIdx
                            );
                            const isCurrent = vIdx === currentVerseIndex && wIdx === currentWordIndex && isListening;

                            return (
                              <span key={`${verse.verse}-${wIdx}`} className="inline-block mx-0.5 md:mx-1">
                                {!revealed ? (
                                  <span className={`inline-block h-3 md:h-4 rounded-full transition-all duration-500 ${isCurrent ? "bg-amber-200 ring-4 ring-amber-100 animate-pulse" : "bg-emerald-50"}`}
                                    style={{ width: `${Math.max(1.5, word.length * 0.55)}rem` }}
                                  />
                                ) : (
                                  <span className={`inline animate-reveal ${revealed.isCorrect ? "text-emerald-950" : "text-rose-600 font-bold underline decoration-rose-200 underline-offset-4"}`}>
                                    {word}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                          <span className="inline-flex items-center text-lg md:text-2xl text-amber-600/50 font-serif mx-1 md:mx-3 select-none">
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

        {selectedSurah && !loadingVerses && (
          <div className="fixed bottom-0 left-0 right-0 z-30 px-4 md:px-8 pb-4 md:pb-8 pt-4 pointer-events-none">
            <div className="max-w-4xl mx-auto pointer-events-auto">
              {debugSpokenText && (
                <div className="mb-2 animate-slide-up">
                  <div className="bg-emerald-900/90 backdrop-blur-md text-emerald-50 px-4 py-2 rounded-xl text-xs md:text-sm shadow-2xl border border-emerald-700/50 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="opacity-60 text-[10px]">مسموع:</span>
                    <span className="font-medium flex-1 truncate">{debugSpokenText}</span>
                  </div>
                </div>
              )}

              <div className="bg-white/80 backdrop-blur-2xl border border-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl p-3 md:p-5 flex items-center justify-between">
                <button onClick={handleReset} className="w-10 h-10 md:w-14 md:h-14 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <RefreshIcon className="w-5 h-5 md:w-6 md:h-6" />
                </button>

                <div className="flex items-center justify-center gap-4">
                  <div className={`text-[8px] md:text-xs font-bold uppercase tracking-widest ${isListening ? "text-rose-500 animate-pulse" : "text-emerald-300"}`}>
                    {isListening ? "جاري التعرف" : "جاهز"}
                  </div>
                  <button onClick={toggleListening} className={`relative w-14 h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all ${isListening ? "bg-rose-500" : "bg-emerald-600"}`}>
                    {isListening ? <StopIcon className="w-4 h-4 md:w-6 md:h-6 text-white" /> : <MicIcon className="w-7 h-7 md:w-9 md:h-9 text-white" />}
                  </button>
                  <div className="w-8 md:w-[100px]" />
                </div>
                <div className="w-10 md:w-14" />
              </div>
            </div>
          </div>
        )}
      </aside>

      {isSidebarOpen && <div className="fixed inset-0 bg-emerald-950/20 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <style jsx global>{`
        @keyframes reveal { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-reveal { animation: reveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideUp { from { transform: translateY(15px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .loader { width: 32px; height: 32px; border-radius: 50%; border: 3px solid #059669; border-top-color: transparent; animation: rotate 1s linear infinite; }
        @keyframes rotate { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function StatusCard({ label, value, color }: { label: string; value: string | number; color: 'emerald' | 'rose' }) {
  const styles = color === 'emerald' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600";
  return (
    <div className={`px-3 md:px-5 py-2 rounded-xl border flex items-center gap-2 md:gap-4 shadow-sm ${styles}`}>
      <span className="text-[8px] md:text-[0.6rem] font-bold uppercase opacity-50">{label}</span>
      <span className="text-sm md:text-xl font-black">{value}</span>
    </div>
  );
}

function MenuIcon({ className }: { className?: string }) { return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>; }
function CloseIcon({ className }: { className?: string }) { return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>; }
function MicIcon({ className }: { className?: string }) { return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" /><path d="M6 10.5a.75.75 0 0 1 .75.75 5.25 5.25 0 1 0 10.5 0 .75.75 0 0 1 1.5 0 6.75 6.75 0 0 1-6 6.709V21a.75.75 0 0 1-1.5 0v-3.041a6.75 6.75 0 0 1-6-6.709A.75.75 0 0 1 6 10.5Z" /></svg>; }
function StopIcon({ className }: { className?: string }) { return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}><path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" /></svg>; }
function RefreshIcon({ className }: { className?: string }) { return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>; }
function SearchIcon({ className }: { className?: string }) { return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>; }
