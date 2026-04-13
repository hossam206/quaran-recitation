/**
 * localStorage abstraction for session progress and user settings.
 * Falls back to in-memory storage if localStorage is unavailable.
 */

import type { WordStatus } from "./types";

const KEYS = {
  SESSION: "murattil_session",
  SETTINGS: "murattil_settings",
} as const;

export interface SessionProgress {
  surah: number;
  verseIndex: number;
  wordIndex: number;
  revealedWords: WordStatus[];
  timestamp: number;
}

export interface UserSettings {
  maxTries: number;
  lastSurah: number | null;
  showDebug: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  maxTries: 3,
  lastSurah: null,
  showDebug: false,
};

// ── Helpers ──

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable (incognito, storage full, etc.)
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ── Session Progress ──

export function saveSessionProgress(progress: SessionProgress): void {
  safeSet(KEYS.SESSION, JSON.stringify(progress));
}

export function getSessionProgress(): SessionProgress | null {
  const raw = safeGet(KEYS.SESSION);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionProgress;
    // Expire after 24 hours
    if (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
      clearSessionProgress();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSessionProgress(): void {
  safeRemove(KEYS.SESSION);
}

// ── User Settings ──

export function saveUserSettings(settings: Partial<UserSettings>): void {
  const current = getUserSettings();
  safeSet(KEYS.SETTINGS, JSON.stringify({ ...current, ...settings }));
}

export function getUserSettings(): UserSettings {
  const raw = safeGet(KEYS.SETTINGS);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
