import { useState } from 'react';

export default function HelpVideoPanel({ onClose }) {
  const [muted, setMuted] = useState(true);

  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:w-80 h-2/3 sm:h-auto bg-black/90 border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white/90 tracking-wide">Demo</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMuted(m => !m)}
              className="text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              {muted ? 'Sound off' : 'Sound on'}
            </button>
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center min-h-[200px]">
          {/* Replace src with the actual demo video path when available */}
          <video
            className="w-full h-full rounded-2xl object-cover"
            autoPlay
            loop
            muted={muted}
            playsInline
          >
            <source src="/demo.mp4" type="video/mp4" />
            <div className="text-white/40 text-sm text-center p-6">
              Demo video coming soon
            </div>
          </video>
        </div>

        <p className="text-xs text-white/40 text-center">
          Point your camera at a NYC landmark to detect it
        </p>
      </div>
    </div>
  );
}
