const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=800&q=80";
const DEFAULT_ANIMATED_IMAGE =
  "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExMDE2N3Z3eTd1eXJ5amN0dnJ4ajNmdzFkcWV5azVhdGZ4ejNqYWgzNSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3NeSk2IVEd2FYUQEcM/giphy.gif";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ARCube({ size }) {
  const faceStyle = {
    width: `${size}px`,
    height: `${size}px`,
  };
  const half = size / 2;

  return (
    <div className="ar-cube-wrap" style={{ width: `${size}px`, height: `${size}px` }}>
      <div className="ar-cube">
        <div className="ar-cube-face ar-cube-front" style={{ ...faceStyle, transform: `translateZ(${half}px)` }} />
        <div className="ar-cube-face ar-cube-back" style={{ ...faceStyle, transform: `rotateY(180deg) translateZ(${half}px)` }} />
        <div className="ar-cube-face ar-cube-right" style={{ ...faceStyle, transform: `rotateY(90deg) translateZ(${half}px)` }} />
        <div className="ar-cube-face ar-cube-left" style={{ ...faceStyle, transform: `rotateY(-90deg) translateZ(${half}px)` }} />
        <div className="ar-cube-face ar-cube-top" style={{ ...faceStyle, transform: `rotateX(90deg) translateZ(${half}px)` }} />
        <div className="ar-cube-face ar-cube-bottom" style={{ ...faceStyle, transform: `rotateX(-90deg) translateZ(${half}px)` }} />
      </div>
    </div>
  );
}

export function HtmlAROverlay({
  detections,
  frameWidth,
  frameHeight,
  mode = "color",
  color = "rgba(255, 153, 0, 0.72)",
  imageUrl = DEFAULT_IMAGE,
  animatedUrl = DEFAULT_ANIMATED_IMAGE,
}) {
  if (!detections?.length || !frameWidth || !frameHeight) return null;

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {detections.map((d, idx) => {
        const { x1, y1, x2, y2 } = d.box;
        const left = (clamp(x1, 0, frameWidth) / frameWidth) * 100;
        const top = (clamp(y1, 0, frameHeight) / frameHeight) * 100;
        const width = ((clamp(x2, 0, frameWidth) - clamp(x1, 0, frameWidth)) / frameWidth) * 100;
        const height = ((clamp(y2, 0, frameHeight) - clamp(y1, 0, frameHeight)) / frameHeight) * 100;
        const pixelWidth = Math.max(1, clamp(x2, 0, frameWidth) - clamp(x1, 0, frameWidth));
        const pixelHeight = Math.max(1, clamp(y2, 0, frameHeight) - clamp(y1, 0, frameHeight));
        const cubeSize = clamp(Math.min(pixelWidth, pixelHeight) * 0.55, 40, 180);

        const isImageMode = mode === "image";
        const isAnimatedImageMode = mode === "animated-image";
        const isCubeMode = mode === "cube-3d";

        return (
          <div
            key={`${d.label}-${idx}`}
            className={`absolute border border-cyan-300/90 rounded-sm overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.35)] ${
              mode === "pulse" ? "ar-pulse-overlay" : ""
            }`}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
              backgroundColor: !isImageMode && !isAnimatedImageMode && !isCubeMode ? color : "transparent",
              backgroundImage: isImageMode
                ? `url(${imageUrl || DEFAULT_IMAGE})`
                : isAnimatedImageMode
                ? `url(${animatedUrl || DEFAULT_ANIMATED_IMAGE})`
                : "none",
              backgroundSize: isImageMode || isAnimatedImageMode ? "cover" : undefined,
              backgroundPosition: isImageMode || isAnimatedImageMode ? "center" : undefined,
            }}
          >
            {mode === "pulse" && <div className="ar-pulse-ring" />}
            {isCubeMode && (
              <div className="absolute inset-0 flex items-center justify-center overflow-visible">
                <ARCube size={cubeSize} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { DEFAULT_IMAGE, DEFAULT_ANIMATED_IMAGE };
