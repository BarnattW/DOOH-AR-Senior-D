export function getBoxMetrics(detections) {
  const box = detections?.[0]?.box;
  if (!box) return null;

  const { x1, y1, x2, y2 } = box;
  const width = x2 - x1;
  const height = y2 - y1;

  return {
    ...box,
    width,
    height,
    minSize: Math.max(1, Math.min(width, height)),
    centerX: (x1 + x2) / 2,
    centerY: (y1 + y2) / 2,
  };
}

export function anchorPoint(metrics, anchor) {
  return {
    x: metrics.x1 + metrics.width * anchor.x,
    y: metrics.y1 + metrics.height * anchor.y,
  };
}

export function getCachedObject(context, key, createObject) {
  if (!context) return createObject();

  if (!context.objects.has(key)) {
    context.objects.set(key, createObject());
  }

  return context.objects.get(key);
}

export function drawBuildingForegroundOcclusion(maskGfx, detections, options = {}) {
  const metrics = getBoxMetrics(detections);
  if (!metrics) return;

  const {
    top = 0.52,
    bottom = 1,
    insetX = 0.08,
    alpha = 1,
  } = options;

  const x = metrics.x1 + metrics.width * insetX;
  const y = metrics.y1 + metrics.height * top;
  const width = metrics.width * (1 - insetX * 2);
  const height = metrics.height * (bottom - top);

  maskGfx.beginFill(0xffffff, alpha);
  maskGfx.drawRect(x, y, width, height);
  maskGfx.endFill();
}
