/**
 * Thermal — custom GLSL iron-palette shader maps building luminance to heat colors.
 * The actual building pixels are recolored; nothing is just "drawn on top".
 */
import * as PIXI from 'pixi.js';

export const id = 'thermal';
export const label = 'Thermal';

const FRAG = `
  precision mediump float;
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler;
  uniform float uTime;

  vec3 ironPalette(float t) {
    t = clamp(t, 0.0, 1.0);
    if (t < 0.25) return mix(vec3(0.0,0.0,0.0),   vec3(0.35,0.0,0.55), t / 0.25);
    if (t < 0.50) return mix(vec3(0.35,0.0,0.55),  vec3(0.9,0.0,0.0),  (t-0.25)/0.25);
    if (t < 0.75) return mix(vec3(0.9,0.0,0.0),    vec3(1.0,0.9,0.0),  (t-0.50)/0.25);
                  return mix(vec3(1.0,0.9,0.0),    vec3(1.0,1.0,1.0),  (t-0.75)/0.25);
  }

  void main(void) {
    vec4 color = texture2D(uSampler, vTextureCoord);
    float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    // Subtle shimmer: boost perceived heat slightly over time
    lum = clamp(lum + sin(uTime * 1.2) * 0.04, 0.0, 1.0);
    gl_FragColor = vec4(ironPalette(lum), color.a);
  }
`;

export function getFilters() {
  return [new PIXI.Filter(null, FRAG, { uTime: 0 })];
}

export function animate(filters, time, detections = []) {
  filters[0].uniforms.uTime = time;
}

export function draw(gfx, textContainer, detections, time) {
  const { x1, y1, x2, y2 } = detections[0].box;
  const w = x2 - x1;
  const h = y2 - y1;
  const boxMin = Math.max(1, Math.min(w, h));
  const cx = (x1 + x2) / 2;

  // "THERMAL" badge top-left
  const badgeSize = Math.max(10, boxMin * 0.07);
  const badge = new PIXI.Text('THERMAL', new PIXI.TextStyle({
    fontFamily: 'monospace',
    fontSize: badgeSize,
    fill: 0xff4400,
    fontWeight: 'bold',
    letterSpacing: 2,
  }));
  badge.position.set(x1 + 6, y1 + 6);
  textContainer.addChild(badge);

  // Temperature scale bar on right edge of bounding box
  const barH = h * 0.7;
  const barW = Math.max(8, boxMin * 0.04);
  const barX = x2 + 6;
  const barY = y1 + (h - barH) / 2;
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const color = _ironColor(t);
    gfx.lineStyle(0);
    gfx.beginFill(color, 0.95);
    gfx.drawRect(barX, barY + barH * (1 - t) - barH / steps, barW, barH / steps + 0.5);
    gfx.endFill();
  }

  // Hot/Cold labels
  const scaleStyle = new PIXI.TextStyle({ fontFamily: 'monospace', fontSize: Math.max(9, badgeSize * 0.85), fill: 0xffffff });
  const hotTxt = new PIXI.Text('HOT', scaleStyle);
  hotTxt.position.set(barX, barY - badgeSize - 2);
  textContainer.addChild(hotTxt);
  const coldTxt = new PIXI.Text('COLD', scaleStyle);
  coldTxt.position.set(barX, barY + barH + 2);
  textContainer.addChild(coldTxt);

  // Crosshair at building center (orange)
  const crossLen = Math.max(12, boxMin * 0.06);
  gfx.lineStyle(Math.max(1.5, boxMin * 0.008), 0xff6600, 0.9);
  gfx.moveTo(cx - crossLen, (y1 + y2) / 2); gfx.lineTo(cx + crossLen, (y1 + y2) / 2);
  gfx.moveTo(cx, (y1 + y2) / 2 - crossLen); gfx.lineTo(cx, (y1 + y2) / 2 + crossLen);

  // Dashed border (draw as segments)
  const dash = Math.max(8, boxMin * 0.06);
  const gap  = dash * 0.6;
  gfx.lineStyle(Math.max(1.5, boxMin * 0.008), 0xff4400, 0.7);
  _dashedRect(gfx, x1, y1, w, h, dash, gap);
}

// Approximate the iron palette as a hex color for canvas segments
function _ironColor(t) {
  t = Math.max(0, Math.min(1, t));
  let r, g, b;
  if (t < 0.25)      { r = Math.round(0.35 * t / 0.25 * 255);   g = 0;   b = Math.round(0.55 * t / 0.25 * 255); }
  else if (t < 0.50) { r = Math.round((0.35 + 0.55 * (t-0.25)/0.25) * 255); g = 0; b = Math.round((0.55 - 0.55*(t-0.25)/0.25)*255); }
  else if (t < 0.75) { r = Math.round((0.9 + 0.1*(t-0.5)/0.25)*255); g = Math.round(0.9*(t-0.5)/0.25*255); b = 0; }
  else               { r = 255; g = Math.round((0.9 + 0.1*(t-0.75)/0.25)*255); b = Math.round((t-0.75)/0.25*255); }
  return (Math.min(255,r) << 16) | (Math.min(255,g) << 8) | Math.min(255,b);
}

function _dashedRect(gfx, x, y, w, h, dash, gap) {
  // top
  for (let d = 0; d < w; d += dash + gap) {
    gfx.moveTo(x + d, y); gfx.lineTo(x + Math.min(d + dash, w), y);
  }
  // bottom
  for (let d = 0; d < w; d += dash + gap) {
    gfx.moveTo(x + d, y + h); gfx.lineTo(x + Math.min(d + dash, w), y + h);
  }
  // left
  for (let d = 0; d < h; d += dash + gap) {
    gfx.moveTo(x, y + d); gfx.lineTo(x, y + Math.min(d + dash, h));
  }
  // right
  for (let d = 0; d < h; d += dash + gap) {
    gfx.moveTo(x + w, y + d); gfx.lineTo(x + w, y + Math.min(d + dash, h));
  }
}
