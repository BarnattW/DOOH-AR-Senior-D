import { BUILDING_CLASSES } from '../ai/Detector';

// AR Overlay function
export const drawAROverlay = (ctx, boxes) => {
  if (boxes.length === 0) return;

  const [x1, y1, x2, y2, conf, classId] = boxes[0];
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;

  const boxWidth = x2 - x1;
  const boxHeight = y2 - y1;
  const boxMin = Math.max(1, Math.min(boxWidth, boxHeight));
  const boxMax = Math.max(boxWidth, boxHeight, 1);

  // Get building name from class ID
  const buildingName = BUILDING_CLASSES[classId] || `Building ${classId}`;

  // Scale AR elements relative to the detected box size instead of fixed pixels.
  // This keeps things looking consistent on different resolutions / mobile vs desktop.
  const radiusBase = boxMin * 0.35;           // circle radius ~ 35% of shorter side
  const crosshairHalf = boxMin * 0.45;       // crosshair arms ~ 45% of shorter side
  const bracketSize = boxMin * 0.25;         // corner brackets ~ 25% of shorter side

  // Clamp sizes so overlay is still usable when the box is tiny or huge
  const canvas = ctx.canvas;
  const maxRadius = Math.min(canvas.width, canvas.height) * 0.25;
  const minRadius = 18;
  const radiusBaseClamped = Math.min(maxRadius, Math.max(minRadius, radiusBase));

  const minBracket = 16;
  const maxBracket = canvas.width * 0.15;
  const bracketSizeClamped = Math.min(maxBracket, Math.max(minBracket, bracketSize));

  const minCross = 24;
  const maxCross = canvas.width * 0.25;
  const crosshairHalfClamped = Math.min(maxCross, Math.max(minCross, crosshairHalf));

  ctx.save();

  // Pulsing green circle at center
  const time = Date.now() / 1000;
  const pulse = Math.sin(time * 2) * 0.5 + 0.5;
  const radius = radiusBaseClamped + pulse * (radiusBaseClamped * 0.25);

  ctx.fillStyle = `rgba(0, 255, 0, ${0.3 + pulse * 0.3})`;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();

  // Crosshair at center
  ctx.strokeStyle = "#0f0";
  ctx.lineWidth = Math.max(2, boxMin * 0.01);
  ctx.beginPath();
  ctx.moveTo(centerX - crosshairHalfClamped, centerY);
  ctx.lineTo(centerX + crosshairHalfClamped, centerY);
  ctx.moveTo(centerX, centerY - crosshairHalfClamped);
  ctx.lineTo(centerX, centerY + crosshairHalfClamped);
  ctx.stroke();

  // Info box above building
  const canvasPadding = 8;
  let infoHeight = Math.max(40, boxHeight * 0.4);

  // Font sizes scale with box height, with sane limits for mobile/desktop
  const titleFontSize = Math.min(24, Math.max(14, boxHeight * 0.16));
  const subFontSize = Math.min(18, Math.max(12, boxHeight * 0.12));

  ctx.font = `bold ${titleFontSize}px Arial`;
  const titleWidth = ctx.measureText(buildingName).width;
  ctx.font = `${subFontSize}px Arial`;
  const confText = `Confidence: ${(conf * 100).toFixed(1)}%`;
  const confWidth = ctx.measureText(confText).width;

  let infoWidth = Math.max(titleWidth, confWidth) + 24; // padding inside box
  infoWidth = Math.min(infoWidth, canvas.width - canvasPadding * 2); // don't go off-screen

  let infoX = centerX - infoWidth / 2;
  infoX = Math.max(canvasPadding, Math.min(infoX, canvas.width - infoWidth - canvasPadding));

  let infoY = y1 - infoHeight - 12;
  if (infoY < canvasPadding) {
    // If there's no room above, place box just below the detection
    infoY = y2 + 12;
    if (infoY + infoHeight > canvas.height - canvasPadding) {
      infoY = canvas.height - canvasPadding - infoHeight;
    }
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(infoX, infoY, infoWidth, infoHeight);

  ctx.strokeStyle = "#0f0";
  ctx.lineWidth = Math.max(1, boxMin * 0.006);
  ctx.strokeRect(infoX, infoY, infoWidth, infoHeight);

  ctx.fillStyle = "#0f0";
  ctx.font = `bold ${titleFontSize}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText(buildingName, infoX + infoWidth / 2, infoY + titleFontSize + 6);
  ctx.font = `${subFontSize}px Arial`;
  ctx.fillText(confText, infoX + infoWidth / 2, infoY + titleFontSize + 6 + subFontSize + 4);

  // Corner brackets around building
  ctx.strokeStyle = "#0f0";
  ctx.lineWidth = Math.max(2, boxMin * 0.012);

  // Top-left bracket
  ctx.beginPath();
  ctx.moveTo(x1 + bracketSizeClamped, y1);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1, y1 + bracketSizeClamped);
  ctx.stroke();

  // Top-right bracket
  ctx.beginPath();
  ctx.moveTo(x2 - bracketSizeClamped, y1);
  ctx.lineTo(x2, y1);
  ctx.lineTo(x2, y1 + bracketSizeClamped);
  ctx.stroke();

  // Bottom-left bracket
  ctx.beginPath();
  ctx.moveTo(x1, y2 - bracketSizeClamped);
  ctx.lineTo(x1, y2);
  ctx.lineTo(x1 + bracketSizeClamped, y2);
  ctx.stroke();

  // Bottom-right bracket
  ctx.beginPath();
  ctx.moveTo(x2 - bracketSizeClamped, y2);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2, y2 - bracketSizeClamped);
  ctx.stroke();

  ctx.restore();
};

