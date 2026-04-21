import { useEffect, useRef, useState } from "react";
import { BUILDING_URLS } from "../../constants/buildings";

/**
 * DetectionOverlay: Displays interactive buttons over detected buildings
 * Positions buttons based on detection bounding boxes
 */
export function DetectionOverlay({ detections, containerRef }) {
  const buttonsContainerRef = useRef(null);
  const [buttonPositions, setButtonPositions] = useState([]);

  useEffect(() => {
    if (!containerRef?.current || !buttonsContainerRef.current) return;

    const parentContainer = containerRef.current;
    const canvas = parentContainer.querySelector("canvas");
    
    if (!canvas) {
      // No canvas yet, try again in next render
      return;
    }

    // Calculate button positions
    const positions = detections
      .map((detection) => {
        const { box, label } = detection;
        if (!box) return null;

        const url = BUILDING_URLS[label];
        if (!url) return null; // No URL configured

        // Get canvas dimensions and bounding rect
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = parentContainer.getBoundingClientRect();

        // Detection box is in model coordinates (typically 0-640)
        // Calculate relative position within the displayed canvas
        const modelWidth = canvas.width;
        const modelHeight = canvas.height;
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;

        // Scale factors
        const scaleX = displayWidth / modelWidth;
        const scaleY = displayHeight / modelHeight;

        // Calculate button position: center-top of detection box
        const boxCenterX = (box.x1 + box.x2) / 2;
        const boxBottomY = box.y2;

        const posX = boxCenterX * scaleX - 55; // Center button (-55 ≈ half width)
        const posY = Math.min(displayHeight, boxBottomY * scaleY + 12); // Below box

        return {
          label,
          url,
          posX,
          posY,
        };
      })
      .filter(Boolean);

    setButtonPositions(positions);
  }, [detections, containerRef]);

  return (
    <div
      ref={buttonsContainerRef}
      className="absolute inset-0 w-full h-full"
      style={{ 
        pointerEvents: "auto",
        overflow: "visible"
      }}
    >
      {buttonPositions.map((btn, idx) => (
        <button
          key={`${btn.label}-${idx}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(btn.url, "_blank", "noopener,noreferrer");
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 20px 40px rgba(59, 130, 246, 0.4), 0 0 20px rgba(59, 130, 246, 0.6)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.4), 0 0 15px rgba(59, 130, 246, 0.3)";
          }}
          className="absolute px-5 py-3 bg-gradient-to-b from-sky-400 to-blue-500 text-white rounded-xl hover:from-sky-300 hover:to-blue-400 transition-all duration-200 text-sm shadow-xl z-20 whitespace-nowrap border border-blue-300 backdrop-blur-sm"
          style={{
            left: `${btn.posX}px`,
            top: `${btn.posY}px`,
            transform: "scale(1)",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.4), 0 0 15px rgba(59, 130, 246, 0.3)",
            letterSpacing: "0.5px",
          }}
        >
          🔎 Learn More
        </button>
      ))}
    </div>
  );
}
