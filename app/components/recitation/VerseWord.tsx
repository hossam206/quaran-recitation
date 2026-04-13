import { memo, forwardRef } from "react";
import type { RecitationMode } from "@/lib/types";

const VerseWord = memo(
  forwardRef<
    HTMLSpanElement,
    {
      word: string;
      isRevealed: boolean;
      isCorrect: boolean;
      isCurrent: boolean;
      mode?: RecitationMode;
      wordIndex?: number;
      /** Number of "hint" words to show at the start of each verse in test mode */
      testHintCount?: number;
    }
  >(function VerseWord(
    { word, isRevealed, isCorrect, isCurrent, mode = "practice", wordIndex = 0, testHintCount = 3 },
    ref,
  ) {
    // In test mode: show the first N words as hints
    const isTestHint = mode === "test" && wordIndex < testHintCount;

    // Determine what to show when NOT revealed
    const renderUnrevealed = () => {
      // In memorize mode: completely blank (no placeholder at all)
      if (mode === "memorize") {
        return (
          <span
            className={`inline-block transition-all duration-300 ${
              isCurrent ? "w-3 h-4 md:h-5 border-b-2 border-amber-300 animate-breathe" : "w-2 h-3 md:h-4"
            }`}
          />
        );
      }

      // In test mode with hint: show the word dimmed
      if (isTestHint) {
        return (
          <span className="inline text-emerald-300/60">{word}</span>
        );
      }

      // Practice mode (default): shimmer placeholder
      return (
        <span
          className={`inline-block rounded-full transition-all duration-300 ${
            isCurrent
              ? "bg-amber-100 animate-breathe h-4 md:h-5"
              : "bg-emerald-50/80 h-3 md:h-4"
          }`}
          style={{ width: `${Math.max(1.5, word.length * 0.55)}rem` }}
        />
      );
    };

    return (
      <span className="inline-block mx-0.5 md:mx-1" ref={ref}>
        {!isRevealed ? (
          renderUnrevealed()
        ) : (
          <span
            className={`inline ${
              isCorrect
                ? "text-emerald-900 animate-correct"
                : "text-rose-600 font-bold underline decoration-rose-200 decoration-2 underline-offset-4 animate-wrong bg-rose-50/50 rounded px-0.5"
            }`}
          >
            {word}
          </span>
        )}
      </span>
    );
  }),
);

export default VerseWord;
