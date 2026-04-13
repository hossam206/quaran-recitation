"use client";

import { useMemo } from "react";
import { CloseIcon, SearchIcon } from "@/app/components/icons";
import type { Surah } from "@/lib/types";

interface SurahSidebarProps {
  surahs: Surah[];
  loadingSurahs: boolean;
  selectedSurah: number | null;
  searchTerm: string;
  isSidebarOpen: boolean;
  onSelectSurah: (n: number) => void;
  onSearchChange: (v: string) => void;
  onClose: () => void;
}

export default function SurahSidebar({
  surahs,
  loadingSurahs,
  selectedSurah,
  searchTerm,
  isSidebarOpen,
  onSelectSurah,
  onSearchChange,
  onClose,
}: SurahSidebarProps) {
  const filteredSurahs = useMemo(() => {
    return surahs.filter(
      (s) =>
        s.name.includes(searchTerm) ||
        s.englishName?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [surahs, searchTerm]);

  return (
    <>
      <aside
        className={`
        fixed inset-0 z-50 md:relative md:z-20 w-full md:w-80 bg-gradient-to-b from-white via-white to-emerald-50/80 border-l border-emerald-100/50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out sidebar-glass
        ${isSidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"}
      `}
      >
        <div className="p-6 md:p-8 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200/60 ring-2 ring-emerald-400/20">
                <svg
                  viewBox="0 0 24 24"
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path
                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-emerald-900 leading-tight">
                  مُرَتِّل
                </h1>
                <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-tighter">
                  Quran Recitation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="md:hidden p-2 text-emerald-400 active:scale-95 transition-transform cursor-pointer"
            >
              <CloseIcon className="w-6 h-6 cursor-pointer" />
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="ابحث عن سورة..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-200 transition-all"
            />
            <SearchIcon className="absolute left-3 top-3 w-4 h-4 text-emerald-300" />
          </div>

          {/* Decorative arch divider */}
          <div className="flex items-center gap-3 mt-4 px-2">
            <div className="flex-1 h-px bg-gradient-to-l from-emerald-200/60 to-transparent" />
            <svg viewBox="0 0 40 40" className="w-4 h-4 text-emerald-300/50">
              <polygon
                points="20,2 33,8 38,20 33,32 20,38 7,32 2,20 7,8"
                fill="currentColor"
              />
            </svg>
            <div className="flex-1 h-px bg-gradient-to-r from-emerald-200/60 to-transparent" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 scrollbar-hide">
          {loadingSurahs
            ? Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="w-full px-4 py-3 rounded-2xl flex items-center justify-between animate-pulse"
                >
                  <div className="flex flex-col gap-2">
                    <div
                      className="h-4 bg-emerald-100/80 rounded-full"
                      style={{ width: `${5 + (i % 3) * 1.5}rem` }}
                    />
                    <div
                      className="h-2.5 bg-emerald-50 rounded-full"
                      style={{ width: `${3 + (i % 4) * 0.8}rem` }}
                    />
                  </div>
                  <div className="w-9 h-9 bg-emerald-50 rounded-md rotate-45" />
                </div>
              ))
            : filteredSurahs?.map((surah) => (
                <button
                  key={surah.number}
                  onClick={() => onSelectSurah(surah.number)}
                  className={`
                    w-full text-right px-4 py-3 rounded-2xl flex items-center justify-between transition-all duration-200 group active:scale-[0.98] cursor-pointer
                    ${
                      selectedSurah === surah.number
                        ? "bg-gradient-to-l from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-200/50"
                        : "hover:bg-emerald-50 text-emerald-900"
                    }
                  `}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-sm md:text-[1.05rem] !cursor-pointer">
                      {surah.name}
                    </span>
                    <span
                      className={`text-[0.6rem] !cursor-pointer ${selectedSurah === surah.number ? "text-emerald-100" : "text-emerald-500"}`}
                    >
                      {surah.englishName}
                    </span>
                  </div>
                  <span className="relative w-9 h-9 flex items-center justify-center">
                    <span
                      className={`absolute inset-0 rounded-md rotate-45 transition-colors ${selectedSurah === surah.number ? "bg-white/20" : "bg-emerald-50 group-hover:bg-emerald-100"}`}
                    />
                    <span
                      className={`relative text-[10px] font-black ${selectedSurah === surah.number ? "text-white" : "text-emerald-600"}`}
                    >
                      {surah.number}
                    </span>
                  </span>
                </button>
              ))}
        </div>

        {/* Copyright */}
        <div className="px-6 py-4 border-t border-emerald-100 text-center">
          <p className="text-[10px] text-emerald-400">
            &copy; {new Date().getFullYear()} Hossam Mohamed
          </p>
        </div>
      </aside>

      {/* Sidebar overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-emerald-950/20 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}
