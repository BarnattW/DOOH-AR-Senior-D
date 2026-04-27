import { create } from "zustand";

const GLITCH_MS = 800;
const LOST_MS = 2000;   // tracking → lost after 2s without a positive detection
const RESET_MS = 8000;  // lost → idle after 8s (long grace period before full reset)

let glitchTimer = null;
let lostTimer = null;
let resetTimer = null;

export const useArStore = create((set, get) => ({
  arState: "idle", // "idle" | "glitching" | "tracking" | "lost"
  detections: [],

  onDetections(rawDetections) {
    const { arState } = get();
    if (rawDetections.length === 0) {
      return;
    }

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
          set({ arState: "idle", detections: [] });
        }, RESET_MS);
      }
    }, LOST_MS);

    if (arState === "idle") {
      // Fresh acquisition — play glitch lock-on
      clearTimeout(glitchTimer);
      set({ arState: "glitching" });
      glitchTimer = setTimeout(() => {
        glitchTimer = null;
        set({ arState: "tracking" });
      }, GLITCH_MS);
    } else if (arState === "lost") {
      // Re-acquired after brief loss — snap back without re-glitching
      clearTimeout(resetTimer);
      resetTimer = null;
      set({ arState: "tracking" });
    }
    // "glitching" or "tracking": just update the box, stay in current state
  },

  reset() {
    clearTimeout(glitchTimer);
    clearTimeout(lostTimer);
    clearTimeout(resetTimer);
    glitchTimer = null;
    lostTimer = null;
    resetTimer = null;
    set({ arState: "idle", detections: [] });
  },
}));
