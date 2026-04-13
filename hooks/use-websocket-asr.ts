"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface ASRWord {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

export interface ASRResult {
  text: string;
  words: ASRWord[];
  isFinal: boolean;
}

interface UseWebSocketASRArgs {
  serverUrl: string;
  onResult: (result: ASRResult) => void;
  enabled: boolean;
}

export function useWebSocketASR({ serverUrl, onResult, enabled }: UseWebSocketASRArgs) {
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const connect = useCallback(() => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(serverUrl);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        setIsConnected(true);
        // Send config on connect
        ws.send(JSON.stringify({
          type: "config",
          sampleRate: audioContextRef.current?.sampleRate ?? 16000,
          language: "ar",
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "transcription") {
            onResultRef.current({
              text: data.text,
              words: data.words || [],
              isFinal: data.isFinal ?? true,
            });
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
      };

      wsRef.current = ws;
    } catch {
      setIsConnected(false);
    }
  }, [enabled, serverUrl]);

  const startStreaming = useCallback(async () => {
    if (!enabled || isStreaming) return;

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Set up AudioWorklet
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule("/audio-worklet-processor.js");

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, "pcm-capture-processor");
      workletNodeRef.current = workletNode;

      // Handle audio buffers from worklet
      workletNode.port.onmessage = (event) => {
        if (event.data.type === "audio" && wsRef.current?.readyState === WebSocket.OPEN) {
          // Convert Float32 to Int16 PCM for smaller payload
          const float32 = event.data.buffer as Float32Array;
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          wsRef.current.send(int16.buffer);
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      // Connect WebSocket
      connect();

      setIsStreaming(true);
    } catch (err) {
      console.error("Failed to start audio streaming:", err);
    }
  }, [enabled, isStreaming, connect]);

  const stopStreaming = useCallback(() => {
    // Stop audio worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsStreaming(false);
    setIsConnected(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isConnected,
    isStreaming,
    startStreaming,
    stopStreaming,
  };
}
