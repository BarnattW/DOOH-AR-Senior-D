import { useEffect, useState } from 'react';

export default function TutorialCard({ title, description, position = 'bottom', onSkip, children }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const positionClass = position === 'bottom'
    ? 'bottom-44 sm:bottom-48'
    : 'top-24 sm:top-28';

  return (
    <>
      {/* Darkened backdrop */}
      <div
        className={`pointer-events-none absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px]
          transition-opacity duration-500
          ${visible ? 'opacity-100' : 'opacity-0'}`}
      />

      <div
        className={`pointer-events-none absolute inset-x-4 z-30 ${positionClass}
          transition-all duration-500 ease-out
          ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
      >
      <div className="pointer-events-auto mx-auto max-w-sm rounded-2xl border border-white/15 bg-black/80 backdrop-blur-md shadow-2xl px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
              Tutorial
            </div>
            <h3 className="mt-1 text-base font-semibold text-white leading-snug">{title}</h3>
            <p className="mt-1.5 text-sm text-white/60 leading-relaxed">{description}</p>
          </div>
          <button
            onClick={onSkip}
            className="flex-shrink-0 text-white/30 hover:text-white/60 transition-colors text-xl leading-none mt-0.5"
          >
            ×
          </button>
        </div>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
    </>
  );
}
