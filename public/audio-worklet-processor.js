/**
 * AudioWorklet processor that captures PCM audio at the system sample rate
 * and posts Float32Array buffers to the main thread for streaming ASR.
 *
 * Registered as 'pcm-capture-processor' in the AudioWorklet.
 */
class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bufferSize = 4096; // ~256ms at 16kHz
    this._buffer = new Float32Array(this._bufferSize);
    this._writeIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0]; // mono channel

    for (let i = 0; i < channelData.length; i++) {
      this._buffer[this._writeIndex++] = channelData[i];

      if (this._writeIndex >= this._bufferSize) {
        // Send buffer to main thread
        this.port.postMessage({
          type: "audio",
          buffer: this._buffer.slice(),
        });
        this._writeIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor("pcm-capture-processor", PCMCaptureProcessor);
