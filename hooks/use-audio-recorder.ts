"use client";

import { useState, useRef, useCallback } from "react";
import { RecordingStatus } from "@/lib/types";

export interface UseAudioRecorderReturn {
  status: RecordingStatus;
  audioBlob: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;
  error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Use webm if supported, fall back to whatever is available
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudioBlob(blob);
        setStatus("stopped");

        // Stop all tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.onerror = () => {
        setError("Recording failed. Please try again.");
        setStatus("idle");
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow microphone access and try again.");
      } else {
        setError("Could not start recording. Please check your microphone.");
      }
      setStatus("idle");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const resetRecording = useCallback(() => {
    setStatus("idle");
    setAudioBlob(null);
    setError(null);
    chunksRef.current = [];
  }, []);

  return { status, audioBlob, startRecording, stopRecording, resetRecording, error };
}
