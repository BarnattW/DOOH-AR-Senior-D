import { useEffect, useRef, useState } from "react";

const PHASES = [
  { text: "Detecting a build...", delay: 0 },
  { text: "Hold...", delay: 1200 },
  { text: "Detected.", delay: 2200 },
];

const CHAR_INTERVAL = 40; // ms per character for typewriter

export default function LockOnOverlay({ arState }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const timersRef = useRef([]);

  // Reset when entering glitching state
  useEffect(() => {
    if (arState === "glitching") {
      setPhaseIndex(0);
      setDisplayedText("");

      // Schedule phase transitions
      const timers = PHASES.map((phase, i) =>
        setTimeout(() => setPhaseIndex(i), phase.delay)
      );
      timersRef.current = timers;

      return () => timers.forEach(clearTimeout);
    }
  }, [arState]);

  // Typewriter effect for current phase
  useEffect(() => {
    if (arState !== "glitching" && arState !== "lost") return;

    const targetText =
      arState === "lost" ? "Building lost..." : PHASES[phaseIndex]?.text ?? "";

    setDisplayedText("");
    let charIndex = 0;

    const interval = setInterval(() => {
      charIndex++;
      setDisplayedText(targetText.slice(0, charIndex));
      if (charIndex >= targetText.length) clearInterval(interval);
    }, CHAR_INTERVAL);

    return () => clearInterval(interval);
  }, [phaseIndex, arState]);

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => setShowCursor((c) => !c), 500);
    return () => clearInterval(interval);
  }, []);

  if (arState !== "glitching" && arState !== "lost") return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center" style={{ bottom: "calc(env(safe-area-inset-bottom) + 10rem)" }}>
      <div className="rounded-lg border border-green-500/30 bg-black/60 px-6 py-4 backdrop-blur-sm">
        <span
          className="font-mono text-lg font-bold tracking-wider"
          style={{
            color: arState === "lost" ? "#ff4444" : "#00ff88",
            textShadow:
              arState === "lost"
                ? "0 0 10px rgba(255,68,68,0.6)"
                : "0 0 10px rgba(0,255,136,0.6)",
          }}
        >
          {displayedText}
          <span
            className="inline-block w-[2px] align-baseline"
            style={{
              height: "1.1em",
              backgroundColor:
                arState === "lost" ? "#ff4444" : "#00ff88",
              opacity: showCursor ? 1 : 0,
              marginLeft: "2px",
            }}
          />
        </span>
      </div>
    </div>
  );
}
