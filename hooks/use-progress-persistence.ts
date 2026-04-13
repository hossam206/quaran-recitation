"use client";

import { useEffect, useRef, useCallback } from "react";
import type { WordStatus } from "@/lib/types";
import {
  saveSessionProgress,
  getSessionProgress,
  clearSessionProgress,
  saveUserSettings,
  getUserSettings,
  type SessionProgress,
  type UserSettings,
} from "@/lib/storage";
import {
  saveMistakes,
  saveSession,
  type MistakeRecord,
} from "@/lib/indexed-db";

interface UseProgressPersistenceArgs {
  selectedSurah: number | null;
  verseIndex: number;
  wordIndex: number;
  revealedWords: WordStatus[];
  isComplete: boolean;
  accuracy: number;
  totalWords: number;
  errorCount: number;
  maxTries: number;
  showDebug: boolean;
}

interface UseProgressPersistenceReturn {
  getSavedProgress: () => SessionProgress | null;
  loadSettings: () => UserSettings;
  clearProgress: () => void;
  saveCompletedSession: () => void;
}

export function useProgressPersistence(
  args: UseProgressPersistenceArgs,
): UseProgressPersistenceReturn {
  const {
    selectedSurah,
    verseIndex,
    wordIndex,
    revealedWords,
    isComplete,
    accuracy,
    totalWords,
    errorCount,
    maxTries,
    showDebug,
  } = args;

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef(Date.now().toString(36));

  // Debounced auto-save on every word reveal
  useEffect(() => {
    if (!selectedSurah || revealedWords.length === 0 || isComplete) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSessionProgress({
        surah: selectedSurah,
        verseIndex,
        wordIndex,
        revealedWords,
        timestamp: Date.now(),
      });
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [selectedSurah, verseIndex, wordIndex, revealedWords, isComplete]);

  // Save settings when they change
  useEffect(() => {
    saveUserSettings({ maxTries, showDebug, lastSurah: selectedSurah });
  }, [maxTries, showDebug, selectedSurah]);

  // Clear saved progress when complete
  useEffect(() => {
    if (isComplete) {
      clearSessionProgress();
    }
  }, [isComplete]);

  const getSavedProgress = useCallback((): SessionProgress | null => {
    return getSessionProgress();
  }, []);

  const loadSettings = useCallback((): UserSettings => {
    return getUserSettings();
  }, []);

  const clearProgress = useCallback(() => {
    clearSessionProgress();
  }, []);

  const saveCompletedSession = useCallback(() => {
    if (!selectedSurah) return;

    // Save session summary to IndexedDB
    saveSession({
      surah: selectedSurah,
      startedAt: parseInt(sessionIdRef.current, 36),
      completedAt: Date.now(),
      accuracy,
      totalWords,
      errorCount,
    });

    // Save individual mistakes to IndexedDB
    const mistakes: MistakeRecord[] = revealedWords
      .filter((w) => !w.isCorrect)
      .map((w) => ({
        surah: selectedSurah,
        ayah: w.verseNumber,
        wordIndex: w.wordIndex,
        expectedWord: w.word,
        timestamp: Date.now(),
        sessionId: sessionIdRef.current,
      }));

    if (mistakes.length > 0) {
      saveMistakes(mistakes);
    }

    // Generate new session ID for next recitation
    sessionIdRef.current = Date.now().toString(36);
  }, [selectedSurah, accuracy, totalWords, errorCount, revealedWords]);

  return {
    getSavedProgress,
    loadSettings,
    clearProgress,
    saveCompletedSession,
  };
}
