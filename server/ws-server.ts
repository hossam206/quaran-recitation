/**
 * Standalone WebSocket server for streaming ASR.
 *
 * Runs alongside Next.js on a separate port (default: 3001).
 * Receives PCM audio chunks from the client, buffers them,
 * and sends transcription results back.
 *
 * Usage: npx tsx server/ws-server.ts
 *
 * Environment variables:
 *   WS_PORT=3001                    WebSocket server port
 *   ASR_BACKEND=openai              "openai" or "faster-whisper"
 *   OPENAI_API_KEY=sk-...           For OpenAI Whisper
 *   FASTER_WHISPER_URL=http://...   For local faster-whisper
 */

import { WebSocketServer, WebSocket } from "ws";
import { ASREngine, type ASRBackend } from "./asr-engine";

const PORT = parseInt(process.env.WS_PORT || "3001", 10);
const BACKEND = (process.env.ASR_BACKEND || "openai") as ASRBackend;
const SEGMENT_DURATION_MS = 2000; // Accumulate 2 seconds before transcribing
const SAMPLE_RATE = 16000;
const SAMPLES_PER_SEGMENT = (SEGMENT_DURATION_MS / 1000) * SAMPLE_RATE;

const engine = new ASREngine({
  backend: BACKEND,
  openaiApiKey: process.env.OPENAI_API_KEY,
  fasterWhisperUrl: process.env.FASTER_WHISPER_URL,
  language: "ar",
});

const wss = new WebSocketServer({ port: PORT });

console.log(`ASR WebSocket server running on ws://localhost:${PORT}`);
console.log(`Backend: ${BACKEND}`);

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected");

  let clientSampleRate = SAMPLE_RATE;
  let audioBuffer: Int16Array[] = [];
  let totalSamples = 0;
  let processing = false;

  ws.on("message", async (data: Buffer | string) => {
    // Handle JSON config messages
    if (typeof data === "string") {
      try {
        const msg = JSON.parse(data);
        if (msg.type === "config") {
          clientSampleRate = msg.sampleRate || SAMPLE_RATE;
          console.log(`Client config: sampleRate=${clientSampleRate}`);
        }
      } catch {
        // Ignore malformed JSON
      }
      return;
    }

    // Handle binary audio data (Int16 PCM)
    const pcm = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
    audioBuffer.push(pcm);
    totalSamples += pcm.length;

    // Once we have enough samples, transcribe
    if (totalSamples >= SAMPLES_PER_SEGMENT && !processing) {
      processing = true;
      const currentBuffer = audioBuffer;
      const currentLength = totalSamples;
      audioBuffer = [];
      totalSamples = 0;

      try {
        // Merge chunks into single buffer
        const merged = new Int16Array(currentLength);
        let offset = 0;
        for (const chunk of currentBuffer) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }

        // Resample if client rate differs from 16kHz
        const finalBuffer = clientSampleRate !== SAMPLE_RATE
          ? resample(merged, clientSampleRate, SAMPLE_RATE)
          : merged;

        const result = await engine.transcribe(finalBuffer);

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "transcription",
            text: result.text,
            words: result.words,
            language: result.language,
            isFinal: true,
          }));
        }
      } catch (err) {
        console.error("Transcription error:", err);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "error",
            message: err instanceof Error ? err.message : "Transcription failed",
          }));
        }
      } finally {
        processing = false;
      }
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    audioBuffer = [];
    totalSamples = 0;
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});

/**
 * Simple linear resampling from one sample rate to another.
 */
function resample(input: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) return input;

  const ratio = fromRate / toRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i * ratio;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(idx0 + 1, input.length - 1);
    const frac = srcIdx - idx0;
    output[i] = Math.round(input[idx0] * (1 - frac) + input[idx1] * frac);
  }

  return output;
}
