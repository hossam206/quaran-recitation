import { memo } from "react";
import type { NormalizedVerse, WordStatus, RecitationMode } from "@/lib/types";
import VerseWord from "./VerseWord";

const VerseDisplay = memo(function VerseDisplay({
  normalizedVerses,
  revealedMap,
  currentVerseIndex,
  currentWordIndex,
  isListening,
  currentWordRef,
  mode = "practice",
}: {
  normalizedVerses: NormalizedVerse[];
  revealedMap: Map<string, WordStatus>;
  currentVerseIndex: number;
  currentWordIndex: number;
  isListening: boolean;
  currentWordRef: React.RefObject<HTMLSpanElement | null>;
  mode?: RecitationMode;
}) {
  return (
    <div
      className="relative text-2xl md:text-4xl leading-[3.5rem] md:leading-[5.5rem] text-center"
      style={{ fontFamily: "var(--font-amiri), Amiri, serif" }}
    >
      {normalizedVerses.map((nv, vIdx) => (
        <span key={nv.verse} className="inline">
          {nv.originalWords.map((word, wIdx) => {
            const revealed = revealedMap.get(`${nv.verse}-${wIdx}`);
            const isCurrent =
              vIdx === currentVerseIndex &&
              wIdx === currentWordIndex &&
              isListening;
            return (
              <VerseWord
                key={`${nv.verse}-${wIdx}`}
                ref={isCurrent ? currentWordRef : null}
                word={word}
                isRevealed={!!revealed}
                isCorrect={revealed?.isCorrect ?? false}
                isCurrent={isCurrent}
                mode={mode}
                wordIndex={wIdx}
              />
            );
          })}
          <span className="inline-flex items-center mx-1 md:mx-3 select-none align-middle">
            <svg viewBox="0 0 40 40" className="w-8 h-8 md:w-10 md:h-10">
              <polygon
                points="20,2 33,8 38,20 33,32 20,38 7,32 2,20 7,8"
                fill="none"
                stroke="rgba(245,158,11,0.25)"
                strokeWidth="1.5"
              />
              <text
                x="20"
                y="22"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(245,158,11,0.6)"
                fontSize="12"
                fontFamily="var(--font-amiri), Amiri, serif"
                fontWeight="700"
              >
                {nv.verse}
              </text>
            </svg>
          </span>
        </span>
      ))}
    </div>
  );
});

export default VerseDisplay;
