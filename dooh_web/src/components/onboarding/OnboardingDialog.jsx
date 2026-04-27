import { useState, useEffect, useRef, useCallback } from 'react';
import { FILTERS } from '../../filters';
import HelpVideoPanel from './HelpVideoPanel';

function useTypewriter(text, speed = 22) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const frameRef = useRef(null);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;

    function tick() {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i < text.length) {
        frameRef.current = setTimeout(tick, speed);
      } else {
        setDone(true);
      }
    }

    frameRef.current = setTimeout(tick, speed);
    return () => clearTimeout(frameRef.current);
  }, [text, speed]);

  return { displayed, done };
}

const STEPS = [
  {
    id: 1,
    label: 'Step 1 of 3',
    title: 'Point',
    description: 'Raise your device and aim at a New York City landmark — Empire State Building, Hudson Yards, or One World Trade.',
    pulseTarget: 'frame',
  },
  {
    id: 2,
    label: 'Step 2 of 3',
    title: 'Detect',
    description: 'Hold steady while the scanner looks for a building. Detection happens automatically.',
    pulseTarget: 'sweep',
  },
  {
    id: 3,
    label: 'Step 3 of 3',
    title: 'Explore',
    description: 'Pick a filter below to apply an AR effect to the building. Try one to finish the tutorial.',
    pulseTarget: 'filters',
  },
];

const PULSE_DELAY_MS = 30_000;

export default function OnboardingDialog({ detections, activeFilterId, onSelectFilter, onDone }) {
  const [step, setStep] = useState(0);         // 0-indexed into STEPS
  const [pulsing, setPulsing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const pulseTimer = useRef(null);
  const prevFilterId = useRef(activeFilterId);
  const prevDetections = useRef(detections);

  // Reset 30s pulse timer whenever the step changes
  useEffect(() => {
    setPulsing(false);
    clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulsing(true), PULSE_DELAY_MS);
    return () => clearTimeout(pulseTimer.current);
  }, [step]);

  // Step 2 → auto-advance on first detection
  useEffect(() => {
    if (step === 1 && detections?.length > 0 && prevDetections.current?.length === 0) {
      advance();
    }
    prevDetections.current = detections;
  }, [detections, step]);

  // Step 3 → auto-advance when user picks any filter
  useEffect(() => {
    if (step === 2 && activeFilterId !== prevFilterId.current) {
      finish();
    }
    prevFilterId.current = activeFilterId;
  }, [activeFilterId, step]);

  function advance() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }

  function finish() {
    localStorage.setItem('dooh_onboarded', 'true');
    onDone();
  }

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;
  const { displayed: typedTitle, done: titleDone } = useTypewriter(current.title, 40);
  const { displayed: typedDesc } = useTypewriter(current.description, 18);

  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center pointer-events-none">
      {/* Semi-transparent backdrop — doesn't block camera */}
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" />

      {/* Dialog card */}
      <div className="relative pointer-events-auto w-full sm:max-w-sm mx-auto bg-black/85 border border-white/15 backdrop-blur-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">

        {/* Viewfinder frame pulse (Step 1) */}
        {current.pulseTarget === 'frame' && (
          <div
            className={`absolute inset-0 rounded-t-3xl sm:rounded-3xl border-2 pointer-events-none transition-all
              ${pulsing ? 'border-white/70 animate-pulse' : 'border-white/10'}`}
          />
        )}

        <div className="px-6 pt-6 pb-4 flex flex-col gap-5">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
              {current.label}
            </span>
            <button
              onClick={finish}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Skip Tutorial
            </button>
          </div>

          {/* Step title + description */}
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {typedTitle}
              {!titleDone && <span className="animate-pulse">|</span>}
            </h2>
            <p className="mt-1.5 text-sm text-white/65 leading-relaxed">
              {typedDesc}
              <span className="animate-pulse opacity-0"> </span>
            </p>
          </div>

          {/* Sweep line indicator (Step 2) */}
          {current.pulseTarget === 'sweep' && (
            <div className="relative h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 w-1/3 rounded-full bg-cyan-400
                  ${pulsing ? 'animate-bounce' : 'animate-[sweep_2s_ease-in-out_infinite]'}`}
                style={!pulsing ? {
                  animation: 'sweep 2s ease-in-out infinite',
                } : undefined}
              />
            </div>
          )}

          {/* Filter picker (Step 3) */}
          {current.pulseTarget === 'filters' && (
            <div
              className={`flex gap-2 overflow-x-auto pb-1 scrollbar-hide rounded-xl p-2
                ${pulsing ? 'ring-2 ring-white/60 animate-pulse' : 'ring-1 ring-white/10'}`}
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => onSelectFilter(f.id)}
                  className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium
                    transition-all duration-200 border
                    ${activeFilterId === f.id
                      ? 'bg-white text-black border-white scale-105'
                      : 'bg-white/5 text-gray-300 border-white/20 hover:bg-white/15'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300
                  ${i === step ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/25'}`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pb-2">
            <button
              onClick={() => setShowHelp(true)}
              className="text-xs text-white/45 hover:text-white/70 transition-colors underline underline-offset-2"
            >
              Need Help?
            </button>

            {isLastStep ? (
              <button
                onClick={finish}
                className="px-5 py-2 rounded-full bg-white text-black text-sm font-semibold
                  hover:bg-white/90 transition-colors"
              >
                Done
              </button>
            ) : (
              <button
                onClick={advance}
                className="px-5 py-2 rounded-full bg-white text-black text-sm font-semibold
                  hover:bg-white/90 transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Help video panel — rendered inside dialog layer */}
      {showHelp && <HelpVideoPanel onClose={() => setShowHelp(false)} />}

      <style>{`
        @keyframes sweep {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(300%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
