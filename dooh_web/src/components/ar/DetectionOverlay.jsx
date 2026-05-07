import { useEffect, useRef, useState } from "react";
import { BUILDING_URLS } from "../../constants/buildings";
import { useArStore } from "../../store/arStore";

export function DetectionOverlay({ detections, containerRef }) {
  const buttonsContainerRef = useRef(null);
  const [buttonPositions, setButtonPositions] = useState([]);
  const arState = useArStore((s) => s.arState);

  useEffect(() => {
    if (!containerRef?.current || !buttonsContainerRef.current) return;

    if (arState !== "tracking") {
      setButtonPositions([]);
      return;
    }

    const parentContainer = containerRef.current;
    const canvas = parentContainer.querySelector("canvas");

    if (!canvas) return;

    const positions = detections
      .map((detection) => {
        const { box, label } = detection;
        if (!box) return null;

        const url = BUILDING_URLS[label];
        if (!url) return null;

        const modelWidth = canvas.width;
        const modelHeight = canvas.height;
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        const scaleX = displayWidth / modelWidth;
        const scaleY = displayHeight / modelHeight;

        const boxCenterX = (box.x1 + box.x2) / 2;
        const boxBottomY = box.y2;

        const posX = boxCenterX * scaleX - 55;
        const posY = Math.min(displayHeight, boxBottomY * scaleY + 12);

        return {
          label,
          url,
          posX,
          posY,
        };
      })
      .filter(Boolean);

    setButtonPositions(positions);
  }, [detections, containerRef, arState]);

  return (
    <div
      ref={buttonsContainerRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "auto", overflow: "visible" }}
    >
      {buttonPositions.map((btn, idx) => (
        <button
          key={`${btn.label}-${idx}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(btn.url, "_blank", "noopener,noreferrer");
          }}
          className="group absolute flex items-center gap-2 px-3.5 py-2 z-20 whitespace-nowrap
            rounded-xl border border-white/20 bg-black/55 backdrop-blur-md
            text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75
            hover:bg-white/10 hover:border-white/40 hover:text-white
            active:scale-95 transition-all duration-200"
          style={{
            left: `${btn.posX}px`,
            top: `${btn.posY}px`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <svg
            className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity"
            fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M2 10L10 2M5 2h5v5" />
          </svg>
          Learn More
        </button>
      ))}
    </div>
  );
}
