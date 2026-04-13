export default function WelcomeScreen() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center mt-10 px-6 animate-fade-in-up">
      {/* Mosque dome icon */}
      <div className="relative w-32 h-32 mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-200/40 to-amber-100/40 rounded-full animate-breathe" />
        <div className="absolute inset-2 bg-gradient-to-br from-emerald-50 to-white rounded-full shadow-xl shadow-emerald-100/60 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            className="w-14 h-14 text-emerald-600/80"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <path
              d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <h3 className="text-2xl font-black text-emerald-900 mb-3">
        مرحباً بك في مُرَتِّل
      </h3>
      <p className="text-emerald-600 max-w-xs text-sm mb-4 leading-relaxed">
        اختبر حفظك وحسّن تلاوتك بمساعدة الذكاءالإصطناعي
      </p>

      {/* Decorative divider */}
      <div className="flex items-center gap-3 mb-10 max-w-xs">
        <div className="flex-1 h-px bg-gradient-to-l from-emerald-200/50 to-transparent" />
        <svg
          viewBox="0 0 40 40"
          className="w-4 h-4 text-emerald-300/40"
        >
          <polygon
            points="20,2 33,8 38,20 33,32 20,38 7,32 2,20 7,8"
            fill="currentColor"
          />
        </svg>
        <div className="flex-1 h-px bg-gradient-to-r from-emerald-200/50 to-transparent" />
      </div>

      {/* Steps with SVG icons */}
      <div className="relative flex gap-4 md:gap-8">
        <div className="absolute top-7 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent z-0" />
        {[
          {
            icon: (
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ),
            title: "اختر سورة",
            desc: "من القائمة الجانبية",
          },
          {
            icon: (
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6"
                fill="currentColor"
              >
                <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                <path d="M6 10.5a.75.75 0 01.75.75 5.25 5.25 0 1010.5 0 .75.75 0 011.5 0 6.75 6.75 0 01-6 6.709V21a.75.75 0 01-1.5 0v-3.041a6.75 6.75 0 01-6-6.709.75.75 0 01.75-.75z" />
              </svg>
            ),
            title: "ابدأ التلاوة",
            desc: "التعرف التلقائي",
          },
          {
            icon: (
              <svg
                viewBox="0 0 24 24"
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ),
            title: "راجع أدائك",
            desc: "دقة وأخطاء",
          },
        ].map((step, i) => (
          <div
            key={i}
            className="relative z-10 flex flex-col items-center gap-2.5 w-24 md:w-32"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-white to-emerald-50 rounded-2xl shadow-lg shadow-emerald-100/40 flex items-center justify-center text-emerald-600 border border-emerald-100/50 ring-1 ring-white">
              {step.icon}
            </div>
            <span className="text-xs font-bold text-emerald-800">
              {step.title}
            </span>
            <span className="text-[10px] text-emerald-500 leading-tight">
              {step.desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
