import { useRef, useEffect, useState } from 'react';
import { FILTERS } from '../filters';

/**
 * Horizontal scrollable filter selector pinned inside the camera view.
 * Shows the active filter name as a fading badge above the pill row.
 */
export default function FilterPicker({ activeId, onSelect }) {
  const [toast, setToast]   = useState(null);   // { label, key }
  const toastTimer          = useRef(null);

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

      {/* Pill row */}
      <div
        className="flex max-w-full gap-2 overflow-x-auto px-1 pb-1 pointer-events-auto scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium
              transition-all duration-200 border
              ${activeId === f.id
                ? 'bg-white text-black border-white scale-105 shadow-lg shadow-white/20'
                : 'bg-black/50 text-gray-200 border-white/20 hover:bg-white/10 backdrop-blur-sm'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
