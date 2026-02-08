/**
 * Speech-to-text abstraction layer.
 * Currently uses OpenAI Whisper API.
 * Swap implementation here to change providers without affecting the rest of the app.
 */

export interface STTResult {
  text: string;
  language: string;
}

export async function transcribeAudio(audioBuffer: ArrayBuffer, filename: string): Promise<STTResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(audioBuffer)], { type: getMimeType(filename) });
  formData.append("file", blob, filename);
  formData.append("model", "whisper-1");
  formData.append("language", "ar"); // Force Arabic for better accuracy
  formData.append("response_format", "json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Whisper API error (${response.status}): ${error}`);
  }

  const data = await response.json();

  return {
    text: data.text,
    language: "ar",
  };
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    webm: "audio/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    mp4: "audio/mp4",
  };
  return mimeTypes[ext || ""] || "audio/webm";
}
