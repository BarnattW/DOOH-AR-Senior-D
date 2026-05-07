import { useRef, useEffect, useState } from 'react';
import { FILTERS } from '../filters';
import { BUILDING_CLASSES } from '../constants/buildings';
import { useArStore } from '../store/arStore';

const PICKER_FILTERS = FILTERS.filter(f => f.id !== 'glitch');
const ALWAYS_UNLOCKED = new Set(['unique']);

/**
 * Horizontal scrollable filter selector pinned inside the camera view.
 * Shows the active filter name as a fading badge above the pill row.
 * Non-default filters stay locked until the user has scanned every supported
 * building at least once.
 */
export default function FilterPicker({ activeId, onSelect, pulsing = false }) {
  const [toast, setToast]   = useState(null);   // { label, key }
  const toastTimer          = useRef(null);

  const scannedBuildings = useArStore((s) => s.scannedBuildings);
  const allUnlocked = scannedBuildings.length >= BUILDING_CLASSES.length;
  const remaining = Math.max(0, BUILDING_CLASSES.length - scannedBuildings.length);

  // Show filter name briefly when selection changes
  useEffect(() => {
    const f = FILTERS.find(f => f.id === activeId);
    if (!f) return;

    setToast({ label: f.label, key: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1400);

    return () => clearTimeout(toastTimer.current);
  }, [activeId]);

  return (
    <div className="flex w-full flex-col items-center px-3 pointer-events-none">
      {/* Filter name toast */}
      <div
        key={toast?.key}
        className={`mb-2 px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase
          bg-black/60 text-white border border-white/20 backdrop-blur-sm
          transition-opacity duration-500 ${toast ? 'opacity-100' : 'opacity-0'}`}
        style={{ pointerEvents: 'none' }}
      >
        {toast?.label ?? ''}
      </div>

      {/* Lock progress hint */}
      {!allUnlocked && (
        <div className="mb-2 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/65 backdrop-blur-sm">
          Scan {remaining} more building{remaining === 1 ? '' : 's'} to unlock filters
        </div>
      )}

      {/* Pill row */}
      <div
        className={`flex max-w-full gap-2 overflow-x-auto px-1 pb-1 pointer-events-auto scrollbar-hide rounded-2xl transition-all duration-500
          ${pulsing ? 'ring-2 ring-white/50 ring-offset-2 ring-offset-transparent animate-pulse' : ''}`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {PICKER_FILTERS.map(f => {
          const locked = !allUnlocked && !ALWAYS_UNLOCKED.has(f.id);
          const isActive = activeId === f.id;
          return (
            <button
              key={f.id}
              onClick={() => !locked && onSelect(f.id)}
              disabled={locked}
              aria-label={locked ? `${f.label} (locked)` : f.label}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium
                transition-all duration-200 border
                ${locked
                  ? 'bg-black/40 text-white/40 border-white/10 cursor-not-allowed'
                  : isActive
                    ? 'bg-white text-black border-white scale-105 shadow-lg shadow-white/20'
                    : 'bg-black/50 text-gray-200 border-white/20 hover:bg-white/10 backdrop-blur-sm'
                }`}
            >
              {locked && (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 10-8 0v4M5 11h14v10H5z" />
                </svg>
              )}
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
