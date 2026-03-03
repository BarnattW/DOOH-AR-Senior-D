/**
 * KABOOM! — animated cartoon explosion anchored to the detected building.
 * No pixel shader; pure PIXI.Graphics + PIXI.Text scene animation.
 *
 * Cycle (3 s):
 *  0.0–0.4 s  star burst expands
 *  0.2–0.7 s  "BOOM!" text bounces in
 *  0.7–2.4 s  hold + orbiting sparkles
 *  2.4–3.0 s  fade out
 */
import * as PIXI from 'pixi.js';

export const id = 'kaboom';
export const label = 'KABOOM!';

const CYCLE  = 3.0;
const WORDS  = ['BOOM!', 'POW!', 'ZAP!', 'KAPOW!'];

export function draw(gfx, textContainer, detections, time) {
  const { x1, y1, x2, y2 } = detections[0].box;
  const w  = x2 - x1;
  const h  = y2 - y1;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const boxMin = Math.max(1, Math.min(w, h));

  const phase = time % CYCLE;
  const word  = WORDS[Math.floor(time / CYCLE) % WORDS.length];
  const alpha = phase < 2.4 ? 1 : 1 - (phase - 2.4) / 0.6;
  if (alpha <= 0) return;

  // ── Star burst ──────────────────────────────────────────────────
  const burstGrow  = Math.min(1, phase / 0.4);
  const burstOuter = Math.max(50, boxMin * 0.65) * burstGrow;
  const burstInner = burstOuter * 0.48;
  const NUM_POINTS = 12;

  // Yellow outer star
  gfx.lineStyle(0);
  gfx.beginFill(0xffe800, 0.92 * alpha);
  _star(gfx, cx, cy, burstOuter, burstInner, NUM_POINTS, 0);
  gfx.endFill();

  // Orange inner rotating star
  const innerR = burstOuter * 0.58;
  gfx.beginFill(0xff6600, 0.9 * alpha);
  _star(gfx, cx, cy, innerR, innerR * 0.38, 8, time * 1.5);
  gfx.endFill();

  // ── Impact rays ─────────────────────────────────────────────────
  const rayLen  = Math.max(20, w * 0.18) * burstGrow;
  const numRays = 9;
  gfx.lineStyle(Math.max(2, boxMin * 0.012), 0xff3300, 0.8 * alpha);
  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2 + 0.35;
    const r0 = burstOuter * 0.95;
    const r1 = r0 + rayLen;
    gfx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
    gfx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
  }

  // ── Flying debris ───────────────────────────────────────────────
  if (phase > 0.3) {
    const dt = phase - 0.3;
    for (let i = 0; i < 9; i++) {
      const angle    = (i / 9) * Math.PI * 2;
      const speed    = (0.35 + (i * 0.08) % 0.5) * boxMin * 0.3;
      const dx       = Math.cos(angle) * speed * dt;
      const dy       = Math.sin(angle) * speed * dt + 180 * dt * dt; // gravity
      const dSize    = Math.max(3, boxMin * 0.02);
      const dAlpha   = alpha * Math.max(0, 1 - dt / 2.1);
      const dColor   = i % 2 === 0 ? 0xff4400 : 0xffaa00;
      gfx.lineStyle(0);
      gfx.beginFill(dColor, dAlpha);
      gfx.drawRect(cx + dx - dSize / 2, cy + dy - dSize / 2, dSize, dSize);
      gfx.endFill();
    }
  }

  // ── Orbiting sparkles (hold phase) ──────────────────────────────
  if (phase > 0.7 && phase < 2.4) {
    const NUM_SPARKS = 6;
    const orbitR = burstOuter * 1.15;
    for (let i = 0; i < NUM_SPARKS; i++) {
      const angle = (i / NUM_SPARKS) * Math.PI * 2 + time * 2.5;
      const sx = cx + Math.cos(angle) * orbitR;
      const sy = cy + Math.sin(angle) * orbitR;
      const sr = Math.max(3, boxMin * 0.025) * (0.6 + 0.4 * Math.sin(time * 8 + i));
      gfx.lineStyle(0);
      gfx.beginFill(0xffffff, 0.9 * alpha);
      gfx.drawCircle(sx, sy, sr);
      gfx.endFill();
    }
  }

  // ── "BOOM!" text ────────────────────────────────────────────────
  if (phase > 0.2) {
    const textProg  = Math.min(1, (phase - 0.2) / 0.3);
    // Elastic overshoot: 0 → 1.25 → 1.0
    const textScale = textProg < 0.7
      ? (textProg / 0.7) * 1.25
      : 1.25 - ((textProg - 0.7) / 0.3) * 0.25;
    const tSize = Math.max(36, boxMin * 0.3);
    const wobble = Math.sin(time * 8) * 0.04;

    const txt = new PIXI.Text(word, new PIXI.TextStyle({
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: tSize,
      fill: [0xffffff, 0xffff00],
      fillGradientStops: [0, 1],
      stroke: 0x000000,
      strokeThickness: Math.max(3, tSize * 0.09),
      dropShadow: true,
      dropShadowColor: 0xff2200,
      dropShadowBlur: 8,
      dropShadowAngle: Math.PI / 4,
      dropShadowDistance: 4,
      letterSpacing: 3,
    }));
    txt.anchor.set(0.5, 0.5);
    txt.position.set(cx, cy - burstOuter * 0.12);
    txt.scale.set(textScale * alpha);
    txt.rotation = -0.08 + wobble;
    textContainer.addChild(txt);
  }
}

/** Draws a star polygon with `n` outer points centred at (cx, cy). */
function _star(gfx, cx, cy, outerR, innerR, n, angleOffset) {
  const total = n * 2;
  for (let i = 0; i <= total; i++) {
    const r     = i % 2 === 0 ? outerR : innerR;
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2 + angleOffset;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) gfx.moveTo(x, y);
    else         gfx.lineTo(x, y);
  }
  gfx.closePath();
}
