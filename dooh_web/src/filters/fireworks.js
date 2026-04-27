import * as PIXI from 'pixi.js';
export const id = 'fireworks';
export const label = 'Fireworks';

export function draw(gfx, textContainer, detections, time) {
  const det = detections[0];
  const { x1, y1, x2, y2 } = det.box;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const w = x2 - x1;
  const h = y2 - y1;
  const boxMin = Math.max(1, Math.min(w, h));
  const burstRadius = Math.max(112, boxMin * 1.44);

  gfx.lineStyle(Math.max(2, boxMin * 0.01), 0x66d9ff, 0.95);
  gfx.drawRect(x1, y1, w, h);

  const bursts = [
    { ox: -0.62, oy: -0.55, phase: 0 },
    { ox: 0.58, oy: -0.44, phase: 0.9 },
    { ox: 0, oy: -0.82, phase: 1.7 },
  ];

  bursts.forEach(({ ox, oy, phase }, burstIndex) => {
    const localPhase = (time * 1.6 + phase) % 1;
    const inner = burstRadius * (0.2 + localPhase * 0.22);
    const outer = burstRadius * (0.8 + localPhase * 1.15);
    const alpha = 1 - localPhase;
    const burstCx = cx + w * ox;
    const burstCy = cy + h * oy;
    const rays = 12;

    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2 + burstIndex * 0.35;
      const color = [0xffcc33, 0xff6699, 0x66d9ff][i % 3];
      gfx.lineStyle(Math.max(2, boxMin * 0.01), color, 0.85 * alpha);
      gfx.moveTo(
        burstCx + Math.cos(angle) * inner,
        burstCy + Math.sin(angle) * inner
      );
      gfx.lineTo(
        burstCx + Math.cos(angle) * outer,
        burstCy + Math.sin(angle) * outer
      );
    }

    for (let i = 0; i < 8; i++) {
      const sparkAngle = (i / 8) * Math.PI * 2 + phase;
      const sparkRadius = outer * (0.96 + ((i % 3) * 0.2));
      const sparkSize = Math.max(8, boxMin * 0.052) * alpha;
      gfx.beginFill(0xffffff, 0.8 * alpha);
      gfx.drawCircle(
        burstCx + Math.cos(sparkAngle) * sparkRadius,
        burstCy + Math.sin(sparkAngle) * sparkRadius,
        sparkSize
      );
      gfx.endFill();
    }
  });

  const title = new PIXI.Text('FIREWORKS', new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontWeight: 'bold',
    fontSize: Math.min(24, Math.max(14, h * 0.14)),
    fill: 0xfff0a8,
    stroke: 0x000000,
    strokeThickness: 4,
    dropShadow: true,
    dropShadowColor: 0x3b1f66,
    dropShadowBlur: 4,
    dropShadowDistance: 2,
    letterSpacing: 2,
  }));
  title.anchor.set(0.5, 1);
  title.position.set(cx, y1 - 8);
  textContainer.addChild(title);
}
