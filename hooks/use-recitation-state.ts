"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import type { VerseData, WordStatus, NormalizedVerse, VerseMistakeInfo, RecitationMode } from "@/lib/types";
import { normalizeArabic } from "@/lib/quran-data";

export function useRecitationState() {
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [verses, setVerses] = useState<VerseData[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [revealedWords, setRevealedWords] = useState<WordStatus[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [wrongWordFlash, setWrongWordFlash] = useState<string | null>(null);
  const [hintWord, setHintWord] = useState<string | null>(null);
  const [maxTries, setMaxTries] = useState(3);
  const [showMistakesReview, setShowMistakesReview] = useState(false);
  const [recitationMode, setRecitationMode] = useState<RecitationMode>("practice");

  // Debug text stored in refs — only read when debug panel is visible, avoids re-renders
  const debugSpokenRef = useRef("");
  const debugNormalizedRef = useRef("");
  const debugExpectedRef = useRef("");
  const debugPanelRef = useRef<HTMLDivElement>(null);

  // Refs for speech recognition processing
  const versesRef = useRef<VerseData[]>([]);
  const normalizedVersesRef = useRef<NormalizedVerse[]>([]);
  const vIdxRef = useRef(0);
  const wIdxRef = useRef(0);
  const isListeningRef = useRef(false);
  const revealedSetRef = useRef(new Set<string>());
  const lastProcessedFinalIndexRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audioContextRef = useRef<any>(null);
  const lastErrorSoundRef = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const currentWordRef = useRef<HTMLSpanElement>(null);
  const wrongWordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveMissRef = useRef(0);
  const interimProcessedCountRef = useRef(0);
  const interimDisplayRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const revealedMap = useMemo(() => {
    const map = new Map<string, WordStatus>();
    for (const rw of revealedWords) {
      map.set(`${rw.verseNumber}-${rw.wordIndex}`, rw);
    }
    return map;
  }, [revealedWords]);

  const totalWords = useMemo(() => {
    return normalizedVerses.reduce((acc, nv) => acc + nv.originalWords.length, 0);
  }, [normalizedVerses]);

  const errorCount = useMemo(
    () => revealedWords.filter((w) => !w.isCorrect).length,
    [revealedWords],
  );

  const accuracy = useMemo(
    () =>
      revealedWords.length > 0
        ? Math.round(
            ((revealedWords.length - errorCount) / revealedWords.length) * 100,
          )
        : 0,
    [revealedWords, errorCount],
  );

  const progressPercent = useMemo(
    () => (totalWords > 0 ? (revealedWords.length / totalWords) * 100 : 0),
    [revealedWords.length, totalWords],
  );

  const isComplete = useMemo(
    () => totalWords > 0 && revealedWords.length >= totalWords,
    [revealedWords.length, totalWords],
  );

  const mistakesByVerse = useMemo<VerseMistakeInfo[]>(() => {
    const tw = normalizedVerses.reduce((acc, nv) => acc + nv.originalWords.length, 0);
    if (tw === 0 || revealedWords.length < tw) return [];
    const verseErrorMap = new Map<number, WordStatus[]>();
    for (const rw of revealedWords) {
      if (!rw.isCorrect) {
        const existing = verseErrorMap.get(rw.verseNumber) || [];
        existing.push(rw);
        verseErrorMap.set(rw.verseNumber, existing);
      }
    }
    return normalizedVerses
      .filter((nv) => verseErrorMap.has(nv.verse))
      .map((nv) => {
        const mistakes = verseErrorMap.get(nv.verse) || [];
        return {
          verse: { chapter: 0, verse: nv.verse, text: nv.originalWords.join(" ") },
          words: nv.originalWords,
          mistakeCount: mistakes.length,
          verseAccuracy: Math.round(
            ((nv.originalWords.length - mistakes.length) / nv.originalWords.length) * 100,
          ),
        };
      });
  }, [revealedWords, normalizedVerses]);

  // Update debug refs and sync to DOM (avoids setState re-renders entirely)
  const updateDebugPanel = useCallback(() => {
    if (debugPanelRef.current) {
      const spans = debugPanelRef.current.querySelectorAll("[data-debug]");
      spans.forEach((el) => {
        const key = el.getAttribute("data-debug");
        if (key === "raw") el.textContent = debugSpokenRef.current;
        if (key === "norm") el.textContent = debugNormalizedRef.current;
        if (key === "cmp") el.textContent = debugExpectedRef.current;
      });
    }
  }, []);

  const playErrorSound = useCallback(() => {
    const now = Date.now();
    if (now - lastErrorSoundRef.current < 300) return;
    lastErrorSoundRef.current = now;

    if (!audioContextRef.current) {
      audioContextRef.current = new (
        window.AudioContext || (window as any).webkitAudioContext // eslint-disable-line @typescript-eslint/no-explicit-any
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

  const handleReset = useCallback(() => {
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
    debugSpokenRef.current = "";
    debugNormalizedRef.current = "";
    debugExpectedRef.current = "";
    updateDebugPanel();
    setWrongWordFlash(null);
    setHintWord(null);
    setShowMistakesReview(false);

    vIdxRef.current = 0;
    wIdxRef.current = 0;
    revealedSetRef.current = new Set();
    lastProcessedFinalIndexRef.current = 0;
    consecutiveMissRef.current = 0;
    interimProcessedCountRef.current = 0;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    if (wrongWordTimerRef.current) clearTimeout(wrongWordTimerRef.current);
    if (interimDisplayRef.current) {
      interimDisplayRef.current.textContent = "";
      interimDisplayRef.current.style.opacity = "0";
    }
  }, [updateDebugPanel]);

  return {
    // State
    selectedSurah,
    setSelectedSurah,
    verses,
    setVerses,
    loadingVerses,
    setLoadingVerses,
    isListening,
    setIsListening,
    currentVerseIndex,
    setCurrentVerseIndex,
    currentWordIndex,
    setCurrentWordIndex,
    revealedWords,
    setRevealedWords,
    showDebug,
    setShowDebug,
    wrongWordFlash,
    setWrongWordFlash,
    hintWord,
    setHintWord,
    maxTries,
    setMaxTries,
    showMistakesReview,
    setShowMistakesReview,
    recitationMode,
    setRecitationMode,

    // Refs
    debugSpokenRef,
    debugNormalizedRef,
    debugExpectedRef,
    debugPanelRef,
    versesRef,
    normalizedVersesRef,
    vIdxRef,
    wIdxRef,
    isListeningRef,
    revealedSetRef,
    lastProcessedFinalIndexRef,
    restartTimerRef,
    recognitionRef,
    currentWordRef,
    wrongWordTimerRef,
    consecutiveMissRef,
    interimProcessedCountRef,
    interimDisplayRef,
    scrollTimerRef,

    // Derived
    normalizedVerses,
    revealedMap,
    totalWords,
    errorCount,
    accuracy,
    progressPercent,
    isComplete,
    mistakesByVerse,

    // Actions
    updateDebugPanel,
    playErrorSound,
    handleReset,
  };
}
