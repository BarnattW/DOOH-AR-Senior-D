import { useState } from "react";

const STEPS = [
  { welcome: true },
  {
    title: "Point at a building",
    description: "Aim your camera at the Empire State Building, Hudson Yards, or One World Trade Center.",
  },
  {
    title: "AR locks on",
    description: "Hold steady when a building is detected. The glitch effect activates automatically.",
  },
  {
    title: "Try a filter",
    description: "Swipe the strip at the bottom and tap a filter to apply an AR effect to the building.",
  },
];

const TUTORIAL_STEPS = STEPS.filter((s) => !s.welcome);

export default function TutorialFlow({ onDone }) {
  const [step, setStep] = useState(0);

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onDone();
  };

  const current = STEPS[step];
  const isWelcome = !!current.welcome;
  const isLast = step === STEPS.length - 1;
  const tutorialIndex = step - 1; // -1 on welcome card

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-black/85 shadow-2xl backdrop-blur-md px-6 py-6">

        {isWelcome ? (
          <>
            <div className="text-3xl mb-3">👋</div>
            <h3 className="text-xl font-bold text-white leading-snug">Welcome to DOOH AR</h3>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">
              Point your camera at iconic NYC buildings and watch them come to life with augmented reality.
            </p>
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={onDone}
                className="px-3 py-2 text-sm text-white/35 hover:text-white/60 transition-colors"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={next}
                className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black transition-transform duration-100 active:scale-95"
              >
                Get started
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/35 mb-4">
              {tutorialIndex + 1} of {TUTORIAL_STEPS.length}
            </div>

            <h3 className="text-lg font-semibold text-white leading-snug">{current.title}</h3>
            <p className="mt-2 text-sm text-white/60 leading-relaxed">{current.description}</p>

            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="flex gap-1.5">
                {TUTORIAL_STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={`block h-1.5 rounded-full transition-all duration-300 ${
                      i === tutorialIndex ? "w-4 bg-white" : "w-1.5 bg-white/25"
                    }`}
                  />
                ))}
              </div>

              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={onDone}
                  className="px-3 py-2 text-sm text-white/35 hover:text-white/60 transition-colors"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black transition-transform duration-100 active:scale-95"
                >
                  {isLast ? "Got it" : "Next"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
