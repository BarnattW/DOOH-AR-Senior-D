const MODES = [
  { id: "original", label: "Original" },
  { id: "strong", label: "Strong" },
];

export default function ModelToggle({ mode, onMode, compact = false }) {
  return (
    <div
      className={`grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/5 ${
        compact ? "p-0.5" : "p-1"
      }`}
    >
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onMode(m.id)}
          className={`rounded-full font-semibold transition ${
            compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-2 text-sm"
          } ${
            mode === m.id ? "bg-white text-black" : "text-white/70 hover:bg-white/10"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
