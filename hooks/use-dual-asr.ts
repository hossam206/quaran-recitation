"use client";

import { useState, useCallback, useRef } from "react";
import { normalizeArabic } from "@/lib/quran-data";
import { useWebSocketASR, type ASRResult } from "./use-websocket-asr";

interface UseDualASRArgs {
  /** Process spoken words (same interface as processNewWords from speech recognition) */
  processNewWords: (words: string[]) => void;
  /** WebSocket server URL for enhanced mode */
  wsServerUrl?: string;
}

/**
 * Dual-ASR orchestrator:
 * - Primary: Web Speech API (handled by use-speech-recognition hook)
 * - Enhanced: WebSocket + Whisper (optional, user-toggled)
 *
 * When enhanced mode is on, both engines run. Web Speech API provides
 * instant interim feedback. Whisper results verify/correct final words.
 */
export function useDualASR({
  processNewWords,
  wsServerUrl = "ws://localhost:3001",
}: UseDualASRArgs) {
  const [enhancedMode, setEnhancedMode] = useState(false);
  const lastWhisperWordsRef = useRef<string[]>([]);

  const handleWSResult = useCallback(
    (result: ASRResult) => {
      if (!result.text) return;

      const normalized = normalizeArabic(result.text);
      const words = normalized.split(/\s+/).filter(Boolean);

      if (words.length > 0) {
        // Store for potential correction/verification
        lastWhisperWordsRef.current = words;

        // In enhanced mode, Whisper results feed directly to processNewWords
        // since Web Speech API already handles real-time interim feedback
        if (result.isFinal) {
          processNewWords(words);
        }
      }
    },
    [processNewWords],
  );

  const { isConnected, isStreaming, startStreaming, stopStreaming } =
    useWebSocketASR({
      serverUrl: wsServerUrl,
      onResult: handleWSResult,
      enabled: enhancedMode,
    });

  const toggleEnhancedMode = useCallback(() => {
    if (enhancedMode) {
      stopStreaming();
      setEnhancedMode(false);
    } else {
      setEnhancedMode(true);
      // Streaming will start when the user starts recording
    }
  }, [enhancedMode, stopStreaming]);

  const startEnhanced = useCallback(() => {
    if (enhancedMode && !isStreaming) {
      startStreaming();
    }
  }, [enhancedMode, isStreaming, startStreaming]);

  const stopEnhanced = useCallback(() => {
    if (isStreaming) {
      stopStreaming();
    }
  }, [isStreaming, stopStreaming]);

  return {
    enhancedMode,
    isConnected,
    isStreaming,
    toggleEnhancedMode,
    startEnhanced,
    stopEnhanced,
    lastWhisperWords: lastWhisperWordsRef,
  };
}
