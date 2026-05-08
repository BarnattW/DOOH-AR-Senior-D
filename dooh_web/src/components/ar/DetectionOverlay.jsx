import { useEffect, useRef, useState } from "react";
import { BUILDING_URLS } from "../../constants/buildings";
import { useArStore } from "../../store/arStore";

const HUDSON_LABEL = 'Hudson Yards - The Edge';
const BRAND_LOGO_RATIO = 320 / 1200;
const BRAND_BUTTON_GAP = 12;

export function DetectionOverlay({ detections, containerRef, activeFilterId }) {
  const buttonsContainerRef = useRef(null);
  const [buttonPositions, setButtonPositions] = useState([]);
  const arState = useArStore((s) => s.arState);

  // Direct brand AR has no building CTA. Hudson's unique brand AR keeps its CTA,
  // positioned under the rendered brand logo.
  const showButton = activeFilterId !== 'brandLogo';

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
        const boxWidth = box.x2 - box.x1;

        const isHudsonUniqueBrand =
          activeFilterId === 'unique' &&
          label === HUDSON_LABEL;

        if (isHudsonUniqueBrand) {
          const logoWidth = Math.min(
            Math.max(190, boxWidth * 0.54),
            Math.max(230, modelWidth * 0.5)
          );
          const logoHeight = logoWidth * BRAND_LOGO_RATIO;
          const logoCenterY = Math.min(
            modelHeight - logoHeight * 0.72,
            box.y2 + logoHeight * 0.7
          );

          return {
            label,
            url,
            posX: boxCenterX * scaleX,
            posY: Math.min(
              displayHeight,
              (logoCenterY + logoHeight * 0.5 + BRAND_BUTTON_GAP) * scaleY
            ),
          };
        }

        const posX = boxCenterX * scaleX;
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
  }, [detections, containerRef, arState, activeFilterId]);

  return (
    <div
      ref={buttonsContainerRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "auto", overflow: "visible" }}
    >
      {showButton && buttonPositions.map((btn, idx) => (
        <button
          key={`${btn.label}-${idx}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(btn.url, "_blank", "noopener,noreferrer");
          }}
          className="group absolute z-20 flex items-center gap-2.5 whitespace-nowrap
            rounded-full border border-white/20 bg-black/50 px-3 py-1.5
            text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-200
            shadow-lg shadow-black/30 backdrop-blur-sm
            transition-all duration-200 hover:border-white hover:bg-white hover:text-black
            active:scale-95"
          style={{
            left: `${btn.posX}px`,
            top: `${btn.posY}px`,
            transform: "translateX(-50%)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/80 transition-colors duration-200 group-hover:border-black/20 group-hover:bg-black group-hover:text-white">
            <svg
              className="h-2.5 w-2.5"
              fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2 10L10 2M5 2h5v5" />
            </svg>
          </span>
          <span>Learn More</span>
        </button>
      ))}
    </div>
  );
}
