/**
 * State machine for tracking the user's position within the Qur'an.
 * Handles forward progression, backward navigation, and repetition detection.
 */

export type TrackingDirection = "forward" | "backward" | "repeat";

export interface VerseTrackerState {
  currentSurah: number;
  currentAyah: number;
  currentWordIndex: number;
  direction: TrackingDirection;
  confidence: number;
  /** Recently visited ayahs for repetition detection */
  recentAyahs: number[];
}

export class VerseTracker {
  private state: VerseTrackerState;
  private maxRecentHistory = 10;

  constructor(surah: number, ayah = 1) {
    this.state = {
      currentSurah: surah,
      currentAyah: ayah,
      currentWordIndex: 0,
      direction: "forward",
      confidence: 100,
      recentAyahs: [ayah],
    };
  }

  getState(): Readonly<VerseTrackerState> {
    return this.state;
  }

  /**
   * Update position when a verse match is detected.
   * Determines if the user is moving forward, backward, or repeating.
   */
  updatePosition(matchedAyah: number, wordIndex: number, confidence: number): TrackingDirection {
    const prevAyah = this.state.currentAyah;
    let direction: TrackingDirection;

    if (matchedAyah === prevAyah && wordIndex <= this.state.currentWordIndex) {
      // Same ayah, same or earlier word position — repetition
      direction = "repeat";
    } else if (matchedAyah < prevAyah) {
      // Went to an earlier ayah — backward navigation
      direction = "backward";
    } else {
      // Same ayah (later word) or later ayah — forward progression
      direction = "forward";
    }

    this.state.currentAyah = matchedAyah;
    this.state.currentWordIndex = wordIndex;
    this.state.direction = direction;
    this.state.confidence = confidence;

    // Track recent ayahs for repetition detection
    this.state.recentAyahs.push(matchedAyah);
    if (this.state.recentAyahs.length > this.maxRecentHistory) {
      this.state.recentAyahs.shift();
    }

    return direction;
  }

  /**
   * Advance the word index within the current ayah.
   */
  advanceWord(): void {
    this.state.currentWordIndex++;
    this.state.direction = "forward";
  }

  /**
   * Move to the next ayah.
   */
  nextAyah(): void {
    this.state.currentAyah++;
    this.state.currentWordIndex = 0;
    this.state.direction = "forward";
    this.state.recentAyahs.push(this.state.currentAyah);
    if (this.state.recentAyahs.length > this.maxRecentHistory) {
      this.state.recentAyahs.shift();
    }
  }

  /**
   * Check if the user is repeating a recently recited ayah.
   * Returns true if the ayah appears more than once in recent history.
   */
  isRepeating(ayah: number): boolean {
    return this.state.recentAyahs.filter((a) => a === ayah).length > 1;
  }

  /**
   * Get the search window for verse detection based on current position.
   * Returns [startAyah, endAyah] range.
   */
  getSearchWindow(windowSize = 5): [number, number] {
    const start = Math.max(1, this.state.currentAyah - 2);
    const end = this.state.currentAyah + windowSize;
    return [start, end];
  }

  /**
   * Reset tracker to a specific position.
   */
  reset(surah: number, ayah = 1): void {
    this.state = {
      currentSurah: surah,
      currentAyah: ayah,
      currentWordIndex: 0,
      direction: "forward",
      confidence: 100,
      recentAyahs: [ayah],
    };
  }
}
