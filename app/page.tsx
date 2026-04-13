"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Surah } from "@/lib/types";
import { useRecitationState } from "@/hooks/use-recitation-state";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useProgressPersistence } from "@/hooks/use-progress-persistence";
import { MenuIcon } from "@/app/components/icons";
import SurahSidebar from "@/app/components/sidebar/SurahSidebar";
import StatsNav from "@/app/components/recitation/StatsNav";
import VerseDisplay from "@/app/components/recitation/VerseDisplay";
import ControlPanel from "@/app/components/recitation/ControlPanel";
import CompletionOverlay from "@/app/components/completion/CompletionOverlay";
import WelcomeScreen from "@/app/components/welcome/WelcomeScreen";

export default function Home() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loadingSurahs, setLoadingSurahs] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const state = useRecitationState();

  const { startRecording, toggleListening } = useSpeechRecognition({
    normalizedVersesRef: state.normalizedVersesRef,
    vIdxRef: state.vIdxRef,
    wIdxRef: state.wIdxRef,
    isListeningRef: state.isListeningRef,
    revealedSetRef: state.revealedSetRef,
    lastProcessedFinalIndexRef: state.lastProcessedFinalIndexRef,
    restartTimerRef: state.restartTimerRef,
    recognitionRef: state.recognitionRef,
    wrongWordTimerRef: state.wrongWordTimerRef,
    consecutiveMissRef: state.consecutiveMissRef,
    interimProcessedCountRef: state.interimProcessedCountRef,
    interimDisplayRef: state.interimDisplayRef,
    scrollTimerRef: state.scrollTimerRef,
    currentWordRef: state.currentWordRef,
    versesRef: state.versesRef,
    debugSpokenRef: state.debugSpokenRef,
    debugNormalizedRef: state.debugNormalizedRef,
    debugExpectedRef: state.debugExpectedRef,
    setIsListening: state.setIsListening,
    setRevealedWords: state.setRevealedWords,
    setCurrentVerseIndex: state.setCurrentVerseIndex,
    setCurrentWordIndex: state.setCurrentWordIndex,
    setWrongWordFlash: state.setWrongWordFlash,
    setHintWord: state.setHintWord,
    maxTries: state.maxTries,
    isListening: state.isListening,
    currentVerseIndex: state.currentVerseIndex,
    currentWordIndex: state.currentWordIndex,
    updateDebugPanel: state.updateDebugPanel,
    playErrorSound: state.playErrorSound,
  });

  const { getSavedProgress, loadSettings, clearProgress, saveCompletedSession } =
    useProgressPersistence({
      selectedSurah: state.selectedSurah,
      verseIndex: state.currentVerseIndex,
      wordIndex: state.currentWordIndex,
      revealedWords: state.revealedWords,
      isComplete: state.isComplete,
      accuracy: state.accuracy,
      totalWords: state.totalWords,
      errorCount: state.errorCount,
      maxTries: state.maxTries,
      showDebug: state.showDebug,
    });

  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedProgressSurah, setSavedProgressSurah] = useState<number | null>(null);

  // Fetch surahs on mount + restore settings
  useEffect(() => {
    fetch("/api/surahs")
      .then((res) => res.json())
      .then((data) => setSurahs(data))
      .catch(console.error)
      .finally(() => setLoadingSurahs(false));

    // Restore user settings
    const settings = loadSettings();
    state.setMaxTries(settings.maxTries);
    state.setShowDebug(settings.showDebug);

    // Check for saved progress
    const saved = getSavedProgress();
    if (saved) {
      setSavedProgressSurah(saved.surah);
      setShowResumePrompt(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save completed session to IndexedDB
  useEffect(() => {
    if (state.isComplete) {
      saveCompletedSession();
    }
  }, [state.isComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResume = useCallback(() => {
    const saved = getSavedProgress();
    if (!saved) return;

    state.setSelectedSurah(saved.surah);
    setShowResumePrompt(false);

    // We'll restore the progress after verses load — use a flag
    setTimeout(() => {
      // Wait for the verses to load, then restore state
      const checkAndRestore = () => {
        if (state.versesRef.current.length > 0) {
          state.setCurrentVerseIndex(saved.verseIndex);
          state.setCurrentWordIndex(saved.wordIndex);
          state.setRevealedWords(saved.revealedWords);
          state.vIdxRef.current = saved.verseIndex;
          state.wIdxRef.current = saved.wordIndex;
          for (const rw of saved.revealedWords) {
            state.revealedSetRef.current.add(`${rw.verseNumber}-${rw.wordIndex}`);
          }
        } else {
          setTimeout(checkAndRestore, 100);
        }
      };
      checkAndRestore();
    }, 200);
  }, [getSavedProgress, state]);

  const handleDismissResume = useCallback(() => {
    setShowResumePrompt(false);
    clearProgress();
  }, [clearProgress]);

  // Sync normalizedVerses to ref
  useEffect(() => {
    state.normalizedVersesRef.current = state.normalizedVerses;
  }, [state.normalizedVerses, state.normalizedVersesRef]);

  // Handle surah selection
  useEffect(() => {
    if (state.selectedSurah) {
      state.setLoadingVerses(true);
      state.setCurrentVerseIndex(0);
      state.setCurrentWordIndex(0);
      state.setRevealedWords([]);
      state.debugSpokenRef.current = "";
      state.debugNormalizedRef.current = "";
      state.debugExpectedRef.current = "";
      state.updateDebugPanel();
      setIsSidebarOpen(false);
      state.setWrongWordFlash(null);
      state.setHintWord(null);
      state.setShowMistakesReview(false);

      state.vIdxRef.current = 0;
      state.wIdxRef.current = 0;
      state.revealedSetRef.current = new Set();
      state.lastProcessedFinalIndexRef.current = 0;
      state.consecutiveMissRef.current = 0;
      state.interimProcessedCountRef.current = 0;
      if (state.restartTimerRef.current) clearTimeout(state.restartTimerRef.current);
      if (state.wrongWordTimerRef.current) clearTimeout(state.wrongWordTimerRef.current);
      if (state.interimDisplayRef.current) {
        state.interimDisplayRef.current.textContent = "";
        state.interimDisplayRef.current.style.opacity = "0";
      }

      fetch(`/api/verses?surah=${state.selectedSurah}`)
        .then((res) => res.json())
        .then((data) => {
          state.setVerses(data);
          state.versesRef.current = data;
          state.setLoadingVerses(false);

          setTimeout(() => {
            if (!state.isListeningRef.current) {
              startRecording();
            }
          }, 100);
        })
        .catch((err) => {
          console.error(err);
          state.setLoadingVerses(false);
        });
    } else {
      state.setVerses([]);
      state.versesRef.current = [];
      state.normalizedVersesRef.current = [];
    }
  }, [state.selectedSurah]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedSurahData = useMemo(
    () => surahs.find((s) => s.number === state.selectedSurah),
    [surahs, state.selectedSurah],
  );

  const handleSelectNewSurah = useCallback(() => {
    state.handleReset();
    state.setSelectedSurah(null);
  }, [state]);

  return (
    <div
      className="h-screen flex flex-col md:flex-row bg-[#FDFBF7] islamic-pattern-bg"
      dir="rtl"
    >
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-emerald-100 p-4 flex items-center justify-between z-40 sticky top-0">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 bg-emerald-50 text-emerald-600 rounded-xl active:scale-95 transition-transform"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-emerald-900">مُرَتِّل</h1>
          <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className="w-10" />
      </div>

      {/* Sidebar */}
      <SurahSidebar
        surahs={surahs}
        loadingSurahs={loadingSurahs}
        selectedSurah={state.selectedSurah}
        searchTerm={searchTerm}
        isSidebarOpen={isSidebarOpen}
        onSelectSurah={state.setSelectedSurah}
        onSearchChange={setSearchTerm}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden h-full top-band">
        {/* Background blobs */}
        <div
          className="absolute top-0 right-0 w-[16rem] h-[16rem] md:w-[28rem] md:h-[28rem] rounded-full blur-xl md:blur-3xl opacity-40 -mr-32 md:-mr-48 -mt-32 md:-mt-48 pointer-events-none will-change-transform"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.3) 0%, rgba(5,150,105,0.1) 50%, transparent 70%)",
            animation: "blobDrift1 20s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-[16rem] h-[16rem] md:w-[28rem] md:h-[28rem] rounded-full blur-xl md:blur-3xl opacity-40 -ml-32 md:-ml-48 -mb-32 md:-mb-48 pointer-events-none will-change-transform"
          style={{
            background:
              "radial-gradient(circle, rgba(251,191,36,0.25) 0%, rgba(245,158,11,0.1) 50%, transparent 70%)",
            animation: "blobDrift2 25s ease-in-out infinite",
          }}
        />
        <div
          className="hidden md:block absolute top-1/2 left-1/3 w-[20rem] h-[20rem] rounded-full blur-3xl opacity-20 pointer-events-none will-change-transform"
          style={{
            background:
              "radial-gradient(circle, rgba(244,63,94,0.15) 0%, transparent 70%)",
            animation: "blobDrift3 30s ease-in-out infinite",
          }}
        />

        {/* Nav Bar with Stats */}
        {state.selectedSurah && (
          <StatsNav
            surahName={selectedSurahData?.name}
            revealedCount={state.revealedWords.length}
            totalWords={state.totalWords}
            accuracy={state.accuracy}
            errorCount={state.errorCount}
            progressPercent={state.progressPercent}
          />
        )}

        {/* Verse Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 relative z-10 pb-44">
          <div className="max-w-4xl mx-auto py-6 md:py-8">
            {!state.selectedSurah ? (
              <>
                {/* Resume prompt */}
                {showResumePrompt && savedProgressSurah && (
                  <div className="mb-6 animate-fade-in-up">
                    <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-lg shadow-amber-100/30 max-w-sm mx-auto">
                      <p className="text-sm font-bold text-amber-800 mb-1 text-center">
                        لديك تلاوة محفوظة
                      </p>
                      <p className="text-xs text-amber-600 mb-4 text-center">
                        سورة {surahs.find((s) => s.number === savedProgressSurah)?.name ?? savedProgressSurah}
                      </p>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={handleResume}
                          className="px-4 py-2 bg-gradient-to-l from-amber-500 to-amber-600 text-white rounded-xl font-bold text-xs shadow active:scale-95 transition-transform"
                        >
                          استئناف
                        </button>
                        <button
                          onClick={handleDismissResume}
                          className="px-4 py-2 bg-white border border-amber-200 text-amber-700 rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-transform"
                        >
                          بداية جديدة
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <WelcomeScreen />
              </>
            ) : state.loadingVerses ? (
              <div className="h-full flex flex-col items-center justify-center mt-20 animate-fade-in-up">
                <div className="loader" />
                <p className="mt-4 text-emerald-600 font-medium">
                  جاري التحميل...
                </p>
              </div>
            ) : (
              <div className="space-y-8 md:space-y-12 animate-fade-in-up">
                {/* Bismillah */}
                {state.selectedSurah !== 1 && state.selectedSurah !== 9 && (
                  <div className="text-center py-6 md:py-8">
                    <div className="flex items-center gap-4 max-w-xs mx-auto mb-5">
                      <div className="flex-1 h-px bg-gradient-to-l from-emerald-300/40 to-transparent" />
                      <svg
                        viewBox="0 0 40 40"
                        className="w-5 h-5 text-emerald-400/40"
                      >
                        <polygon
                          points="20,2 33,8 38,20 33,32 20,38 7,32 2,20 7,8"
                          fill="currentColor"
                        />
                      </svg>
                      <div className="flex-1 h-px bg-gradient-to-r from-emerald-300/40 to-transparent" />
                    </div>
                    <p
                      className="text-2xl md:text-4xl text-emerald-800 tracking-wide"
                      style={{ fontFamily: "var(--font-amiri), Amiri, serif" }}
                    >
                      بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                    </p>
                    <div className="flex items-center gap-4 max-w-xs mx-auto mt-5">
                      <div className="flex-1 h-px bg-gradient-to-l from-emerald-300/40 to-transparent" />
                      <svg
                        viewBox="0 0 40 40"
                        className="w-5 h-5 text-emerald-400/40"
                      >
                        <polygon
                          points="20,2 33,8 38,20 33,32 20,38 7,32 2,20 7,8"
                          fill="currentColor"
                        />
                      </svg>
                      <div className="flex-1 h-px bg-gradient-to-r from-emerald-300/40 to-transparent" />
                    </div>
                  </div>
                )}

                {/* Verse Display */}
                <div className="relative bg-white rounded-[1.5rem] md:rounded-[2rem] border border-emerald-100/30 shadow-2xl shadow-emerald-100/20 p-6 md:p-16 verse-card-corners">
                  <div className="corner corner-tr" />
                  <div className="corner corner-tl" />
                  <div className="corner corner-br" />
                  <div className="corner corner-bl" />
                  <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-emerald-50/30 to-transparent rounded-t-[1.5rem] md:rounded-t-[2rem] pointer-events-none" />
                  <VerseDisplay
                    normalizedVerses={state.normalizedVerses}
                    revealedMap={state.revealedMap}
                    currentVerseIndex={state.currentVerseIndex}
                    currentWordIndex={state.currentWordIndex}
                    isListening={state.isListening}
                    currentWordRef={state.currentWordRef}
                    mode={state.recitationMode}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Completion Overlay */}
        {state.isComplete && (
          <CompletionOverlay
            accuracy={state.accuracy}
            totalWords={state.totalWords}
            errorCount={state.errorCount}
            revealedWords={state.revealedWords}
            mistakesByVerse={state.mistakesByVerse}
            revealedMap={state.revealedMap}
            showMistakesReview={state.showMistakesReview}
            surahName={selectedSurahData?.name}
            onReset={state.handleReset}
            onSelectNewSurah={handleSelectNewSurah}
            onShowMistakes={() => state.setShowMistakesReview(true)}
            onHideMistakes={() => state.setShowMistakesReview(false)}
          />
        )}

        {/* Wrong Word Flash */}
        {state.wrongWordFlash && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="animate-wrong-flash">
              <div
                className="bg-rose-500 text-white px-8 md:px-12 py-4 md:py-5 rounded-2xl text-2xl md:text-4xl shadow-2xl shadow-rose-300/40 border border-rose-400/50 flex items-center justify-center gap-3"
                style={{
                  fontFamily: "var(--font-amiri), Amiri, serif",
                  minWidth: "16rem",
                }}
              >
                <span className="text-rose-200 text-xl md:text-2xl">✗</span>
                <span className="font-bold">{state.wrongWordFlash}</span>
              </div>
            </div>
          </div>
        )}

        {/* Hint Word Display */}
        {state.hintWord && !state.wrongWordFlash && (
          <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
            <div className="animate-slide-up">
              <div
                className="bg-amber-500 text-white px-8 md:px-12 py-4 md:py-5 rounded-2xl text-3xl md:text-5xl shadow-2xl shadow-amber-300/40 border border-amber-400/50 flex items-center justify-center gap-3"
                style={{
                  fontFamily: "var(--font-amiri), Amiri, serif",
                  minWidth: "16rem",
                }}
              >
                <span className="text-amber-200 text-lg md:text-xl">💡</span>
                <span className="font-bold">{state.hintWord}</span>
              </div>
            </div>
          </div>
        )}

        {/* Control Panel (includes interim transcript) */}
        {state.selectedSurah && !state.loadingVerses && !state.isComplete && (
          <ControlPanel
            isListening={state.isListening}
            showDebug={state.showDebug}
            maxTries={state.maxTries}
            recitationMode={state.recitationMode}
            debugPanelRef={state.debugPanelRef}
            debugSpokenRef={state.debugSpokenRef}
            debugNormalizedRef={state.debugNormalizedRef}
            debugExpectedRef={state.debugExpectedRef}
            interimDisplayRef={state.interimDisplayRef}
            onToggleListening={toggleListening}
            onReset={state.handleReset}
            onToggleDebug={() => state.setShowDebug((v) => !v)}
            onSetMaxTries={state.setMaxTries}
            onSetMode={state.setRecitationMode}
          />
        )}
      </main>
    </div>
  );
}
