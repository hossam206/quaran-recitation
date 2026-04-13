"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface AudioComparisonProps {
  surah: number;
  ayah: number;
  userAudioBlob?: Blob | null;
  reciter?: string;
}

export default function AudioComparison({
  surah,
  ayah,
  userAudioBlob,
  reciter = "Alafasy_128kbps",
}: AudioComparisonProps) {
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceError, setReferenceError] = useState(false);
  const [isPlayingReference, setIsPlayingReference] = useState(false);
  const [isPlayingUser, setIsPlayingUser] = useState(false);
  const referenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [userUrl, setUserUrl] = useState<string | null>(null);

  // Load reference audio
  useEffect(() => {
    setReferenceLoading(true);
    setReferenceError(false);
    const url = `/api/reference-audio?surah=${surah}&ayah=${ayah}&reciter=${reciter}`;
    setReferenceUrl(url);

    // Prefetch to check availability
    fetch(url, { method: "HEAD" })
      .then((res) => {
        if (!res.ok) setReferenceError(true);
      })
      .catch(() => setReferenceError(true))
      .finally(() => setReferenceLoading(false));
  }, [surah, ayah, reciter]);

  // Create object URL for user audio
  useEffect(() => {
    if (userAudioBlob) {
      const url = URL.createObjectURL(userAudioBlob);
      setUserUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setUserUrl(null);
    }
  }, [userAudioBlob]);

  const toggleReference = useCallback(() => {
    if (!referenceAudioRef.current || !referenceUrl) return;
    if (isPlayingReference) {
      referenceAudioRef.current.pause();
      referenceAudioRef.current.currentTime = 0;
      setIsPlayingReference(false);
    } else {
      // Stop user audio if playing
      if (userAudioRef.current) {
        userAudioRef.current.pause();
        userAudioRef.current.currentTime = 0;
        setIsPlayingUser(false);
      }
      referenceAudioRef.current.play();
      setIsPlayingReference(true);
    }
  }, [isPlayingReference, referenceUrl]);

  const toggleUser = useCallback(() => {
    if (!userAudioRef.current || !userUrl) return;
    if (isPlayingUser) {
      userAudioRef.current.pause();
      userAudioRef.current.currentTime = 0;
      setIsPlayingUser(false);
    } else {
      // Stop reference audio if playing
      if (referenceAudioRef.current) {
        referenceAudioRef.current.pause();
        referenceAudioRef.current.currentTime = 0;
        setIsPlayingReference(false);
      }
      userAudioRef.current.play();
      setIsPlayingUser(true);
    }
  }, [isPlayingUser, userUrl]);

  return (
    <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-sm">
      <h4 className="text-xs font-bold text-emerald-700 mb-3 text-center">
        مقارنة الصوت — الآية {ayah}
      </h4>

      <div className="flex gap-3 justify-center">
        {/* Reference reciter */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={toggleReference}
            disabled={referenceLoading || referenceError}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              isPlayingReference
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-200/50"
                : referenceError
                  ? "bg-gray-100 text-gray-300"
                  : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
            }`}
          >
            {referenceLoading ? (
              <div className="w-4 h-4 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
            ) : isPlayingReference ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          <span className="text-[10px] font-bold text-emerald-500">القارئ</span>
        </div>

        {/* User recording */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={toggleUser}
            disabled={!userUrl}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${
              isPlayingUser
                ? "bg-amber-500 text-white shadow-md shadow-amber-200/50"
                : !userUrl
                  ? "bg-gray-100 text-gray-300"
                  : "bg-amber-50 text-amber-600 hover:bg-amber-100"
            }`}
          >
            {isPlayingUser ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          <span className="text-[10px] font-bold text-amber-500">
            {userUrl ? "تسجيلك" : "لا يوجد"}
          </span>
        </div>
      </div>

      {/* Hidden audio elements */}
      {referenceUrl && (
        <audio
          ref={referenceAudioRef}
          src={referenceUrl}
          onEnded={() => setIsPlayingReference(false)}
          preload="none"
        />
      )}
      {userUrl && (
        <audio
          ref={userAudioRef}
          src={userUrl}
          onEnded={() => setIsPlayingUser(false)}
          preload="none"
        />
      )}
    </div>
  );
}
