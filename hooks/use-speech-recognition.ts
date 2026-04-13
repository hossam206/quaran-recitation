"use client";

import { useCallback, useEffect, useRef } from "react";
import { normalizeArabic, fuzzyMatchArabic } from "@/lib/quran-data";
import type { VerseData, WordStatus, NormalizedVerse } from "@/lib/types";

interface UseSpeechRecognitionArgs {
  // Refs from recitation state
  normalizedVersesRef: React.MutableRefObject<NormalizedVerse[]>;
  vIdxRef: React.MutableRefObject<number>;
  wIdxRef: React.MutableRefObject<number>;
  isListeningRef: React.MutableRefObject<boolean>;
  revealedSetRef: React.MutableRefObject<Set<string>>;
  lastProcessedFinalIndexRef: React.MutableRefObject<number>;
  restartTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  recognitionRef: React.MutableRefObject<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  wrongWordTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  consecutiveMissRef: React.MutableRefObject<number>;
  interimProcessedCountRef: React.MutableRefObject<number>;
  interimDisplayRef: React.MutableRefObject<HTMLDivElement | null>;
  scrollTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  currentWordRef: React.MutableRefObject<HTMLSpanElement | null>;
  versesRef: React.MutableRefObject<VerseData[]>;
  debugSpokenRef: React.MutableRefObject<string>;
  debugNormalizedRef: React.MutableRefObject<string>;
  debugExpectedRef: React.MutableRefObject<string>;

  // State setters
  setIsListening: (v: boolean) => void;
  setRevealedWords: React.Dispatch<React.SetStateAction<WordStatus[]>>;
  setCurrentVerseIndex: (v: number) => void;
  setCurrentWordIndex: (v: number) => void;
  setWrongWordFlash: (v: string | null) => void;
  setHintWord: (v: string | null) => void;

  // Values
  maxTries: number;
  isListening: boolean;
  currentVerseIndex: number;
  currentWordIndex: number;

  // Callbacks
  updateDebugPanel: () => void;
  playErrorSound: () => void;
}

export function useSpeechRecognition(args: UseSpeechRecognitionArgs) {
  const {
    normalizedVersesRef,
    vIdxRef,
    wIdxRef,
    isListeningRef,
    revealedSetRef,
    lastProcessedFinalIndexRef,
    restartTimerRef,
    recognitionRef,
    wrongWordTimerRef,
    consecutiveMissRef,
    interimProcessedCountRef,
    interimDisplayRef,
    scrollTimerRef,
    currentWordRef,
    versesRef,
    debugSpokenRef,
    debugNormalizedRef,
    debugExpectedRef,
    setIsListening,
    setRevealedWords,
    setCurrentVerseIndex,
    setCurrentWordIndex,
    setWrongWordFlash,
    setHintWord,
    maxTries,
    isListening,
    currentVerseIndex,
    currentWordIndex,
    updateDebugPanel,
    playErrorSound,
  } = args;

  // Keep a ref for maxTries to avoid stale closures
  const maxTriesRef = useRef(maxTries);
  maxTriesRef.current = maxTries;

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
            debugExpectedRef.current = `"${expectedWord}" \u2190 "${spokenWord}"`;
            updateDebugPanel();
          }

          newReveals.push({
            verseNumber: nv.verse,
            wordIndex: wIdx,
            word: nv.originalWords[wIdx],
            isCorrect,
          });

          if (!isCorrect) {
            playErrorSound();
          }

          revealedSetRef.current.add(key);
          wIdx++;
          spokenIdx++;
        }

        if (newReveals.length > 0) {
          consecutiveMissRef.current = 0;
          setHintWord(null);
          vIdxRef.current = vIdx;
          wIdxRef.current = wIdx;
          setRevealedWords((prev) => [...prev, ...newReveals]);
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
              debugExpectedRef.current = `\u2713 \u0642\u0641\u0632 ${foundPosition} \u2190 "${spokenWord}"`;
              updateDebugPanel();
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
            consecutiveMissRef.current = 0;
            setHintWord(null);
            vIdxRef.current = matchV;
            wIdxRef.current = matchW;
            setRevealedWords((prev) => [...prev, ...allReveals]);
            setCurrentVerseIndex(matchV);
            setCurrentWordIndex(matchW);
          }
        } else {
          // No match found — show what the user said as a wrong word flash
          consecutiveMissRef.current++;
          setWrongWordFlash(spokenWords.join(" "));
          playErrorSound();
          if (wrongWordTimerRef.current)
            clearTimeout(wrongWordTimerRef.current);

          if (consecutiveMissRef.current >= maxTriesRef.current + 1) {
            // After maxTries+1: hint was shown, user still failed — mark wrong and advance
            consecutiveMissRef.current = 0;
            setHintWord(null);
            const key = `${currentVerse.verse}-${wIdx}`;
            if (!revealedSetRef.current.has(key)) {
              revealedSetRef.current.add(key);
              const reveal: WordStatus = {
                verseNumber: currentVerse.verse,
                wordIndex: wIdx,
                word: currentVerse.originalWords[wIdx],
                isCorrect: false,
              };
              let newVIdx = vIdx;
              let newWIdx = wIdx + 1;
              if (newWIdx >= currentVerse.normalizedWords.length) {
                newVIdx++;
                newWIdx = 0;
              }
              vIdxRef.current = newVIdx;
              wIdxRef.current = newWIdx;
              setRevealedWords((prev) => [...prev, reveal]);
              setCurrentVerseIndex(newVIdx);
              setCurrentWordIndex(newWIdx);
            }
            wrongWordTimerRef.current = setTimeout(
              () => setWrongWordFlash(null),
              2000,
            );
          } else if (consecutiveMissRef.current >= maxTriesRef.current) {
            // After maxTries: show the correct word as a hint
            setHintWord(currentVerse.originalWords[wIdx]);
            wrongWordTimerRef.current = setTimeout(
              () => setWrongWordFlash(null),
              2000,
            );
          } else {
            wrongWordTimerRef.current = setTimeout(
              () => setWrongWordFlash(null),
              2000,
            );
          }
        }
      }
    },
    [playErrorSound, updateDebugPanel, normalizedVersesRef, vIdxRef, wIdxRef, revealedSetRef, consecutiveMissRef, wrongWordTimerRef, debugExpectedRef, setRevealedWords, setCurrentVerseIndex, setCurrentWordIndex, setWrongWordFlash, setHintWord],
  );

  const startRecording = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || // eslint-disable-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!SpeechRecognition) {
      alert(
        "\u0627\u0644\u0645\u062A\u0635\u0641\u062D \u0644\u0627 \u064A\u062F\u0639\u0645 \u0627\u0644\u062A\u0639\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0643\u0644\u0627\u0645. \u0627\u0633\u062A\u062E\u062F\u0645 Chrome.",
      );
      return;
    }

    lastProcessedFinalIndexRef.current = 0;

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // Show the latest interim/final transcript in debug for real-time feedback
      const latestResult = event.results[event.results.length - 1];
      const latestTranscript = latestResult[0].transcript;

      // Update interim display directly via DOM — zero re-render cost
      if (interimDisplayRef.current) {
        if (!latestResult.isFinal && latestTranscript) {
          interimDisplayRef.current.textContent = latestTranscript;
          interimDisplayRef.current.style.opacity = "1";
        } else {
          interimDisplayRef.current.style.opacity = "0";
        }
      }

      // Process FINAL results — reconcile with words already handled via interim
      for (
        let i = lastProcessedFinalIndexRef.current;
        i < event.results.length;
        i++
      ) {
        const result = event.results[i];
        if (!result.isFinal) continue;

        const transcript = result[0].transcript;
        if (!transcript) {
          lastProcessedFinalIndexRef.current = i + 1;
          interimProcessedCountRef.current = 0;
          continue;
        }

        // Update debug refs (zero re-render cost)
        debugSpokenRef.current = transcript;

        const normalizedSpoken = normalizeArabic(transcript);
        const words = normalizedSpoken.split(/\s+/).filter(Boolean);

        // Only process words beyond what interim already handled
        const alreadyProcessed = interimProcessedCountRef.current;
        interimProcessedCountRef.current = 0;

        if (words.length > alreadyProcessed) {
          const newWords = words.slice(alreadyProcessed);
          debugNormalizedRef.current = words.join(" ");
          updateDebugPanel();
          processNewWords(newWords);
        }

        lastProcessedFinalIndexRef.current = i + 1;
      }

      // Process interim results in real-time (skip last word — still forming)
      if (!latestResult.isFinal) {
        const transcript = latestResult[0].transcript;
        if (transcript) {
          const normalizedSpoken = normalizeArabic(transcript);
          const words = normalizedSpoken.split(/\s+/).filter(Boolean);
          const stableWordCount = Math.max(0, words.length - 1);

          if (stableWordCount > interimProcessedCountRef.current) {
            const newWords = words.slice(
              interimProcessedCountRef.current,
              stableWordCount,
            );
            if (newWords.length > 0) {
              debugNormalizedRef.current = words.join(" ");
              updateDebugPanel();
              processNewWords(newWords);
              interimProcessedCountRef.current = stableWordCount;
            }
          }
        }
      }
    };

    recognition.onerror = (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      console.error("Speech Error:", event.error);
      if (event.error !== "aborted" && isListeningRef.current) {
        // Debounce restart to avoid rapid restart loops
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (isListeningRef.current) startRecording();
        }, 150);
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current && versesRef.current.length > 0) {
        // Debounce restart to avoid overlapping instances
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => {
          if (isListeningRef.current) startRecording();
        }, 150);
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
    isListeningRef.current = true;
  }, [processNewWords, lastProcessedFinalIndexRef, interimDisplayRef, interimProcessedCountRef, debugSpokenRef, debugNormalizedRef, updateDebugPanel, isListeningRef, restartTimerRef, versesRef, recognitionRef, setIsListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
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
  }, [isListening, startRecording, restartTimerRef, recognitionRef, setIsListening, isListeningRef]);

  // Sync isListening to ref
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening, isListeningRef]);

  // Cleanup SpeechRecognition + timers on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (wrongWordTimerRef.current) clearTimeout(wrongWordTimerRef.current);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      isListeningRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to current word (debounced)
  useEffect(() => {
    if (currentWordRef.current && isListening) {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        currentWordRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 80);
    }
  }, [currentVerseIndex, currentWordIndex, isListening, currentWordRef, scrollTimerRef]);

  return {
    startRecording,
    toggleListening,
    processNewWords,
  };
}
