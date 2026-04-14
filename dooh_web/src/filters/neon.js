/**
 * Neon — saturates the building and applies a pulsing GlowFilter so the
 * building itself radiates magenta/cyan light beyond the bounding box.
 */
import * as PIXI from 'pixi.js';
import { GlowFilter } from 'pixi-filters';

export const id = 'neon';
export const label = 'Neon';

export function getFilters() {
  const cm = new PIXI.ColorMatrixFilter();
  cm.saturate(2.5, true);
  cm.brightness(1.15, false);

  const glow = new GlowFilter({
    distance: 22,
    outerStrength: 3,
    innerStrength: 0.5,
    color: 0xff00ff,
    quality: 0.4,
  });

  return [cm, glow];
}

export function animate(filters, time, detections = []) {
  const glow = filters[1];
  const pulse = (Math.sin(time * 2.5) + 1) / 2;
  
  // Scale glow effect based on detection box size
  let glowScale = 1;
  if (detections.length > 0) {
    const { x1, y1, x2, y2 } = detections[0].box;
    const boxMin = Math.min(x2 - x1, y2 - y1);
    glowScale = Math.max(0.3, Math.min(2, boxMin / 150)); // Scale between 0.3x and 2x
  }
  
  glow.distance = 22 * glowScale;
  glow.outerStrength = (2.5 + pulse * 3) * glowScale;
  glow.color = pulse > 0.5 ? 0xff00ff : 0x00ffff;
}

export function draw(gfx, textContainer, detections, time) {
  const { x1, y1, x2, y2 } = detections[0].box;
  const w  = x2 - x1;
  const h  = y2 - y1;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const boxMin = Math.max(1, Math.min(w, h));
  const pulse  = (Math.sin(time * 2.5) + 1) / 2;
  const color  = pulse > 0.5 ? 0xff00ff : 0x00ffff;

  // Pulsing concentric rings
  for (let i = 1; i <= 3; i++) {
    const r = Math.max(20, boxMin * 0.15) * i + pulse * 8;
    gfx.lineStyle(Math.max(1, 3 - i), color, 0.6 - i * 0.15);
    gfx.drawCircle(cx, cy, r);
  }

  // Corner brackets (thick neon)
  const brk = Math.max(18, boxMin * 0.22);
  const lw  = Math.max(2.5, boxMin * 0.015);
  gfx.lineStyle(lw, color, 1);
  _corner(gfx, x1, y1, brk,  1,  1);
  _corner(gfx, x2, y1, brk, -1,  1);
  _corner(gfx, x1, y2, brk,  1, -1);
  _corner(gfx, x2, y2, brk, -1, -1);

  // Building label with neon glow text style
  const labelSize = Math.min(20, Math.max(13, h * 0.13));
  const txt = new PIXI.Text(detections[0].label, new PIXI.TextStyle({
    fontFamily: '"Courier New", monospace',
    fontWeight: 'bold',
    fontSize: labelSize,
    fill: color,
    stroke: 0x000000,
    strokeThickness: 3,
    dropShadow: true,
    dropShadowColor: color,
    dropShadowBlur: 10,
    dropShadowDistance: 0,
  }));
  txt.anchor.set(0.5, 1);
  txt.position.set(cx, y1 - 8);
  textContainer.addChild(txt);
}

function _corner(gfx, cx, cy, size, dx, dy) {
  gfx.moveTo(cx + dx * size, cy);
  gfx.lineTo(cx, cy);
  gfx.lineTo(cx, cy + dy * size);
}
