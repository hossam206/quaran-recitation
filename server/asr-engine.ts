/**
 * ASR Engine: processes audio chunks and returns transcription with word-level timestamps.
 *
 * Supports two backends:
 * 1. OpenAI Whisper API (cloud, requires OPENAI_API_KEY)
 * 2. faster-whisper via HTTP (local, requires running faster-whisper server)
 *
 * Audio arrives as 16-bit PCM at 16kHz. We accumulate chunks into segments
 * of ~2 seconds before sending for transcription.
 */

export interface ASRWord {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

export interface ASRTranscription {
  text: string;
  words: ASRWord[];
  language: string;
}

export type ASRBackend = "openai" | "faster-whisper";

interface ASREngineConfig {
  backend: ASRBackend;
  openaiApiKey?: string;
  fasterWhisperUrl?: string; // e.g., http://localhost:8000
  language?: string;
}

export class ASREngine {
  private config: ASREngineConfig;

  constructor(config: ASREngineConfig) {
    this.config = {
      language: "ar",
      ...config,
    };
  }

  /**
   * Transcribe a PCM audio buffer (Int16, 16kHz mono).
   */
  async transcribe(pcmBuffer: Int16Array): Promise<ASRTranscription> {
    if (this.config.backend === "openai") {
      return this.transcribeOpenAI(pcmBuffer);
    }
    return this.transcribeFasterWhisper(pcmBuffer);
  }

  /**
   * Convert Int16 PCM to WAV file buffer.
   */
  private pcmToWav(pcm: Int16Array, sampleRate = 16000): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcm.length * (bitsPerSample / 8);

    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF header
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write("WAVE", 8);

    // fmt chunk
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);

    // data chunk
    buffer.write("data", 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Write PCM samples
    for (let i = 0; i < pcm.length; i++) {
      buffer.writeInt16LE(pcm[i], 44 + i * 2);
    }

    return buffer;
  }

  private async transcribeOpenAI(pcmBuffer: Int16Array): Promise<ASRTranscription> {
    const apiKey = this.config.openaiApiKey;
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const wavBuffer = this.pcmToWav(pcmBuffer);

    // Use FormData with Blob for the file — convert Buffer to Uint8Array for TS compat
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(wavBuffer.buffer, wavBuffer.byteOffset, wavBuffer.byteLength)], { type: "audio/wav" });
    formData.append("file", blob, "audio.wav");
    formData.append("model", "whisper-1");
    formData.append("language", this.config.language || "ar");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "word");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errText}`);
    }

    const data = await response.json();

    return {
      text: data.text || "",
      words: (data.words || []).map((w: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        word: w.word,
        start: w.start,
        end: w.end,
        probability: w.probability,
      })),
      language: data.language || this.config.language || "ar",
    };
  }

  private async transcribeFasterWhisper(pcmBuffer: Int16Array): Promise<ASRTranscription> {
    const baseUrl = this.config.fasterWhisperUrl || "http://localhost:8000";
    const wavBuffer = this.pcmToWav(pcmBuffer);

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(wavBuffer.buffer, wavBuffer.byteOffset, wavBuffer.byteLength)], { type: "audio/wav" });
    formData.append("file", blob, "audio.wav");
    formData.append("language", this.config.language || "ar");
    formData.append("word_timestamps", "true");

    const response = await fetch(`${baseUrl}/transcribe`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`faster-whisper error: ${response.status}`);
    }

    const data = await response.json();

    return {
      text: data.text || "",
      words: (data.words || []).map((w: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        word: w.word,
        start: w.start,
        end: w.end,
        probability: w.probability,
      })),
      language: this.config.language || "ar",
    };
  }
}
