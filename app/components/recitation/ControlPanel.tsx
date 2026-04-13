"use client";

import { RefreshIcon, MicIcon, StopIcon, BugIcon } from "@/app/components/icons";
import type { RecitationMode } from "@/lib/types";

const MODE_LABELS: Record<RecitationMode, { ar: string; en: string }> = {
  practice: { ar: "تدريب", en: "Practice" },
  memorize: { ar: "حفظ", en: "Memorize" },
  test: { ar: "اختبار", en: "Test" },
};

const MODE_ORDER: RecitationMode[] = ["practice", "memorize", "test"];

interface ControlPanelProps {
  isListening: boolean;
  showDebug: boolean;
  maxTries: number;
  recitationMode: RecitationMode;
  debugPanelRef: React.RefObject<HTMLDivElement | null>;
  debugSpokenRef: React.MutableRefObject<string>;
  debugNormalizedRef: React.MutableRefObject<string>;
  debugExpectedRef: React.MutableRefObject<string>;
  onToggleListening: () => void;
  onReset: () => void;
  onToggleDebug: () => void;
  onSetMaxTries: (fn: (v: number) => number) => void;
  onSetMode: (mode: RecitationMode) => void;
}

export default function ControlPanel({
  isListening,
  showDebug,
  maxTries,
  recitationMode,
  debugPanelRef,
  debugSpokenRef,
  debugNormalizedRef,
  debugExpectedRef,
  onToggleListening,
  onReset,
  onToggleDebug,
  onSetMaxTries,
  onSetMode,
}: ControlPanelProps) {
  return (
    <div className="fixed bottom-0 left-1/2 right-1/2 z-30 pb-4 md:pb-6 pt-4 pointer-events-none flex flex-col justify-center items-center">
      <div className="pointer-events-auto">
        {/* Debug panel (toggleable) */}
        {showDebug && (
          <div className="mb-2 animate-slide-up">
            <div ref={debugPanelRef} className="bg-gray-900 text-gray-200 px-4 py-2 rounded-xl text-xs shadow-2xl border border-gray-700/50 space-y-1 font-mono">
              <div className="flex gap-2">
                <span className="text-gray-500">raw:</span>
                <span data-debug="raw" className="truncate">{debugSpokenRef.current}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">norm:</span>
                <span data-debug="norm" className="truncate">{debugNormalizedRef.current}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500">cmp:</span>
                <span data-debug="cmp" className="truncate">{debugExpectedRef.current}</span>
              </div>
            </div>
          </div>
        )}

        {/* Mode selector */}
        <div className="mb-2 flex items-center justify-center gap-1 bg-white rounded-full px-1 py-1 border border-emerald-100/60 shadow-sm">
          {MODE_ORDER.map((m) => (
            <button
              key={m}
              onClick={() => onSetMode(m)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                recitationMode === m
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-emerald-600 hover:bg-emerald-50"
              }`}
            >
              {MODE_LABELS[m].ar}
            </button>
          ))}
        </div>

        {/* Tries selector */}
        <div className="mb-2 flex items-center justify-center gap-2">
          <span className="text-[11px] font-semibold text-emerald-700/70">
            المحاولات
          </span>
          <div className="flex items-center gap-1 bg-white rounded-full px-2 py-1 border border-emerald-100/60 shadow-sm">
            <button
              onClick={() => onSetMaxTries((v) => Math.max(1, v - 1))}
              className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold hover:bg-emerald-100 active:scale-90 transition-all"
            >
              -
            </button>
            <span className="w-6 text-center text-sm font-bold text-emerald-700">
              {maxTries}
            </span>
            <button
              onClick={() => onSetMaxTries((v) => Math.min(10, v + 1))}
              className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold hover:bg-emerald-100 active:scale-90 transition-all"
            >
              +
            </button>
          </div>
        </div>

        {/* Main control bar */}
        <div className="relative bg-white border border-emerald-100/30 rounded-full shadow-2xl shadow-emerald-100/30 px-8 md:px-14 py-3 md:py-4 flex items-center justify-center gap-12 md:gap-10 ring-1 ring-emerald-50">
          {/* Top edge highlight */}
          <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
          {/* Bottom edge highlight */}
          <div className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-200/30 to-transparent" />

          {/* Reset */}
          <button
            onClick={onReset}
            className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 hover:shadow-md hover:shadow-emerald-100/50 active:scale-95 transition-all"
          >
            <RefreshIcon className="w-6 h-6" />
          </button>

          {/* Mic + Status */}
          <div className="flex flex-col items-center gap-1">
            {/* Listening indicator */}
            <div className="flex items-center gap-2 h-5">
              {isListening ? (
                <>
                  <div className="flex items-end gap-[2px]">
                    <div className="w-[3px] bg-rose-400 rounded-full sound-bar-1" />
                    <div className="w-[3px] bg-rose-500 rounded-full sound-bar-2" />
                    <div className="w-[3px] bg-rose-400 rounded-full sound-bar-3" />
                  </div>
                  <span className="text-[10px] font-bold text-rose-500">
                    جاري التعرف
                  </span>
                </>
              ) : (
                <span className="text-[10px] font-bold text-emerald-300">
                  جاهز
                </span>
              )}
            </div>

            {/* Mic button */}
            <div className="relative">
              {isListening && (
                <>
                  <div className="absolute -inset-3 rounded-full bg-rose-400/20 animate-sonar" />
                  <div className="absolute -inset-3 rounded-full bg-rose-400/15 animate-sonar-delayed" />
                </>
              )}
              <button
                onClick={onToggleListening}
                className={`relative z-10 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg ring-2 ${
                  isListening
                    ? "bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-200/50 ring-rose-300/40"
                    : "bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-200/50 ring-emerald-400/30"
                }`}
              >
                {/* Inner highlight */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                {isListening ? (
                  <StopIcon className="w-6 h-6 text-white relative z-10" />
                ) : (
                  <MicIcon className="w-8 h-8 text-white relative z-10" />
                )}
              </button>
            </div>
          </div>

          {/* Debug toggle */}
          <button
            onClick={onToggleDebug}
            className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center active:scale-95 transition-all hover:shadow-md ${showDebug ? "bg-gray-100 text-gray-600 hover:shadow-gray-100/50" : "bg-emerald-50 text-emerald-400 hover:shadow-emerald-100/50"}`}
          >
            <BugIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
