"use client";

import { RefreshIcon, MicIcon, StopIcon, BugIcon } from "@/app/components/icons";
import type { RecitationMode } from "@/lib/types";

const MODE_LABELS: Record<RecitationMode, string> = {
  practice: "تدريب",
  memorize: "حفظ",
  test: "اختبار",
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
  interimDisplayRef: React.RefObject<HTMLDivElement | null>;
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
  interimDisplayRef,
  onToggleListening,
  onReset,
  onToggleDebug,
  onSetMaxTries,
  onSetMode,
}: ControlPanelProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-none flex flex-col items-center">
      {/* ── Debug panel (floating above everything) ── */}
      {showDebug && (
        <div className="mb-2 pointer-events-auto animate-slide-up">
          <div ref={debugPanelRef} className="bg-gray-900 text-gray-200 px-4 py-2 rounded-xl text-xs shadow-2xl border border-gray-700/50 space-y-1 font-mono max-w-sm">
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

      {/* ── Interim transcript (what user is saying — sits above controls) ── */}
      <div className="mb-3 pointer-events-none">
        <div
          ref={interimDisplayRef}
          className="text-sm md:text-base text-emerald-700/60 bg-white/90 rounded-full px-5 py-1.5 shadow-sm border border-emerald-100/50 transition-opacity duration-300 max-w-xs md:max-w-md truncate"
          style={{ fontFamily: "var(--font-amiri), Amiri, serif", opacity: 0 }}
        />
      </div>

      {/* ── Main dock ── */}
      <div className="pointer-events-auto pb-4 md:pb-6 flex flex-col items-center gap-2">
        {/* Settings row: mode + tries in one compact line */}
        <div className="flex items-center gap-3">
          {/* Mode selector */}
          <div className="flex items-center gap-0.5 bg-white rounded-full px-1 py-0.5 border border-emerald-100/60 shadow-sm">
            {MODE_ORDER.map((m) => (
              <button
                key={m}
                onClick={() => onSetMode(m)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  recitationMode === m
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          {/* Tries selector */}
          <div className="flex items-center gap-1.5 bg-white rounded-full px-2 py-0.5 border border-emerald-100/60 shadow-sm">
            <span className="text-[10px] font-semibold text-emerald-600/70">
              المحاولات
            </span>
            <button
              onClick={() => onSetMaxTries((v) => Math.max(1, v - 1))}
              className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold hover:bg-emerald-100 active:scale-90 transition-all"
            >
              -
            </button>
            <span className="w-4 text-center text-xs font-bold text-emerald-700">
              {maxTries}
            </span>
            <button
              onClick={() => onSetMaxTries((v) => Math.min(10, v + 1))}
              className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold hover:bg-emerald-100 active:scale-90 transition-all"
            >
              +
            </button>
          </div>
        </div>

        {/* Main control bar */}
        <div className="relative bg-white border border-emerald-100/30 rounded-full shadow-2xl shadow-emerald-100/30 px-6 md:px-12 py-2.5 md:py-3 flex items-center justify-center gap-8 md:gap-10">
          {/* Debug toggle */}
          <button
            onClick={onToggleDebug}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center active:scale-95 transition-all hover:shadow-md ${showDebug ? "bg-gray-100 text-gray-600 hover:shadow-gray-100/50" : "bg-emerald-50 text-emerald-400 hover:shadow-emerald-100/50"}`}
          >
            <BugIcon className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          {/* Mic + Status (center, prominent) */}
          <div className="flex flex-col items-center gap-0.5">
            {/* Listening indicator */}
            <div className="flex items-center gap-1.5 h-4">
              {isListening ? (
                <>
                  <div className="flex items-end gap-[2px]">
                    <div className="w-[2.5px] bg-rose-400 rounded-full sound-bar-1" />
                    <div className="w-[2.5px] bg-rose-500 rounded-full sound-bar-2" />
                    <div className="w-[2.5px] bg-rose-400 rounded-full sound-bar-3" />
                  </div>
                  <span className="text-[9px] font-bold text-rose-500">
                    جاري التعرف
                  </span>
                </>
              ) : (
                <span className="text-[9px] font-bold text-emerald-300">
                  جاهز
                </span>
              )}
            </div>

            {/* Mic button */}
            <div className="relative">
              {isListening && (
                <>
                  <div className="absolute -inset-2.5 rounded-full bg-rose-400/20 animate-sonar" />
                  <div className="absolute -inset-2.5 rounded-full bg-rose-400/15 animate-sonar-delayed" />
                </>
              )}
              <button
                onClick={onToggleListening}
                className={`relative z-10 w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg ring-2 ${
                  isListening
                    ? "bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-200/50 ring-rose-300/40"
                    : "bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-200/50 ring-emerald-400/30"
                }`}
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                {isListening ? (
                  <StopIcon className="w-5 h-5 text-white relative z-10" />
                ) : (
                  <MicIcon className="w-7 h-7 text-white relative z-10" />
                )}
              </button>
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={onReset}
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 hover:shadow-md hover:shadow-emerald-100/50 active:scale-95 transition-all"
          >
            <RefreshIcon className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
