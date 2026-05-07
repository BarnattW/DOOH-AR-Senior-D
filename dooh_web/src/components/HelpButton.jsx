import { useEffect, useRef, useState } from "react";

const TIPS = [
  ["Aim the camera", "Point at a NYC landmark — keep it framed and steady."],
  ["Wait for lock-on", "A green box and \"Detected.\" mean tracking is live."],
  ["Pick a filter", "Swipe the strip above the shutter to change effects."],
  ["Capture & postcard", "Tap the shutter, then open the library to make a postcard."],
];

export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="pointer-events-auto absolute z-20"
      style={{
        left: "calc(env(safe-area-inset-left) + 1rem)",
        bottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
      }}
    >
      {open && (
        <div
          role="dialog"
          className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-white/15 bg-black/70 p-3 text-white shadow-xl backdrop-blur-md"
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">
            Quick tips
          </div>
          <ul className="space-y-2 text-xs leading-snug">
            {TIPS.map(([title, body]) => (
              <li key={title}>
                <div className="font-medium text-white/95">{title}</div>
                <div className="text-white/70">{body}</div>
              </li>
            ))}
          </ul>
          <div className="absolute -bottom-1.5 left-3 h-3 w-3 rotate-45 border-b border-r border-white/15 bg-black/70" />
        </div>
      )}

      <button
        type="button"
        aria-label="Help"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-transparent text-white/90 transition active:scale-95"
      >
        <span className="font-serif text-base leading-none">?</span>
      </button>
    </div>
  );
}
