import { create } from "zustand";

const GLITCH_MS = 5000;
const LOST_MS = 2000;   // tracking → lost after 2s without a positive detection
const RESET_MS = 8000;  // lost → idle after 8s (long grace period before full reset)

let glitchTimer = null;
let lostTimer = null;
let resetTimer = null;

function pickPrimaryLabel(detections) {
  let best = null;
  for (const d of detections) {
    if (!d?.label) continue;
    if (!best || (d.confidence ?? 0) > (best.confidence ?? 0)) best = d;
  }
  return best?.label ?? null;
}

export const useArStore = create((set, get) => ({
  arState: "idle", // "idle" | "glitching" | "tracking" | "lost"
  detections: [],
  currentLabel: null,

  onDetections(rawDetections) {
    const { arState, currentLabel } = get();
    if (rawDetections.length === 0) {
      return;
    }

    const primaryLabel = pickPrimaryLabel(rawDetections);
    set({ detections: rawDetections });

    // Slide the lost timer — if no fresh detection within LOST_MS, go to "lost"
    clearTimeout(lostTimer);
    lostTimer = setTimeout(() => {
      lostTimer = null;
      const current = get().arState;
      if (current === "tracking") {
        set({ arState: "lost" });
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          resetTimer = null;
          set({ arState: "idle", detections: [], currentLabel: null });
        }, RESET_MS);
      }
    }, LOST_MS);

    const startGlitch = () => {
      clearTimeout(glitchTimer);
      set({ arState: "glitching", currentLabel: primaryLabel });
      glitchTimer = setTimeout(() => {
        glitchTimer = null;
        set({ arState: "tracking" });
      }, GLITCH_MS);
    };

    if (arState === "idle") {
      // Fresh acquisition — play glitch lock-on
      startGlitch();
    } else if (arState === "lost") {
      // Re-acquired — re-glitch if it's a different building, else snap back
      clearTimeout(resetTimer);
      resetTimer = null;
      if (primaryLabel && primaryLabel !== currentLabel) {
        startGlitch();
      } else {
        set({ arState: "tracking" });
      }
    } else if (arState === "tracking" && primaryLabel && primaryLabel !== currentLabel) {
      // New building swapped in mid-tracking — replay detecting effect
      startGlitch();
    }
    // "glitching" or same-building "tracking": just update the box
  },

  reset() {
    clearTimeout(glitchTimer);
    clearTimeout(lostTimer);
    clearTimeout(resetTimer);
    glitchTimer = null;
    lostTimer = null;
    resetTimer = null;
    set({ arState: "idle", detections: [], currentLabel: null });
  },
}));
