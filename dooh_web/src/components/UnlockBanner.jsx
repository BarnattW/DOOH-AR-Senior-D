import { useEffect, useState } from "react";
import { useArStore } from "../store/arStore";

const AUTO_DISMISS_MS = 5000;

export default function UnlockBanner() {
  const justUnlocked = useArStore((s) => s.justUnlocked);
  const acknowledgeUnlock = useArStore((s) => s.acknowledgeUnlock);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!justUnlocked) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      acknowledgeUnlock();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [justUnlocked, acknowledgeUnlock]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div
        className="pointer-events-auto max-w-sm rounded-2xl border border-emerald-300/40 bg-gradient-to-br from-emerald-500/30 to-emerald-700/40 px-5 py-3 text-center shadow-2xl shadow-emerald-500/30 backdrop-blur-md"
        role="status"
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-100/90">
          All buildings scanned
        </div>
        <div className="mt-1 text-sm font-medium text-white">
          Good job — you found all the buildings! Try out the new filters.
        </div>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            acknowledgeUnlock();
          }}
          className="mt-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition-colors hover:bg-white/20"
        >
          Nice
        </button>
      </div>
    </div>
  );
}
