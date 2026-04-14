/**
 * Glitch — GlitchFilter randomly tears the building's pixels, plus
 * chromatic-aberration text and scan-line decorations.
 */
import * as PIXI from 'pixi.js';
import { GlitchFilter } from 'pixi-filters';

export const id = 'glitch';
export const label = 'Glitch';

export function getFilters() {
  return [new GlitchFilter({
    slices:     6,
    offset:     20,
    direction:  0,
    fillMode:   0,
    red:   [2,  2],
    green: [0,  0],
    blue:  [-2, 2],
    minSize:    8,
    sampleSize: 512,
  })];
}

export function animate(filters, time, detections = []) {
  const g = filters[0];
  
  // Scale glitch intensity based on detection box size
  let glitchScale = 1;
  if (detections.length > 0) {
    const { x1, y1, x2, y2 } = detections[0].box;
    const boxMin = Math.min(x2 - x1, y2 - y1);
    glitchScale = Math.max(0.4, Math.min(2, boxMin / 120)); // Scale between 0.4x and 2x
  }
  
  // Fire a new random tear ~3 times per second
  if (Math.random() < 0.05) {
    g.refresh();
    g.offset  = (8 + Math.random() * 35) * glitchScale;
    g.slices  = 3 + Math.floor(Math.random() * 9);
  }
  // Pulse red/blue channel split
  const t = Math.sin(time * 4) * 0.5 + 0.5;
  const split = t * 4 * glitchScale;
  g.red  = [split,  split];
  g.blue = [-split, split];
}

export function draw(gfx, textContainer, detections, time) {
  const { x1, y1, x2, y2 } = detections[0].box;
  const w  = x2 - x1;
  const h  = y2 - y1;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const boxMin = Math.max(1, Math.min(w, h));

  // Horizontal scan lines with random jitter
  const numLines = 10;
  for (let i = 0; i < numLines; i++) {
    const ly = y1 + (h / numLines) * i + (Math.random() * 4 - 2);
    const alpha = 0.2 + Math.random() * 0.35;
    gfx.lineStyle(Math.max(1, boxMin * 0.005), 0x00ff88, alpha);
    gfx.moveTo(x1, ly); gfx.lineTo(x2, ly);
  }

  // Fragmented corner markers
  const seg = Math.max(12, boxMin * 0.12);
  const lw  = Math.max(2, boxMin * 0.012);
  const jit = () => (Math.random() - 0.5) * 4; // small random jitter each frame
  gfx.lineStyle(lw, 0x00ff88, 0.9);
  // TL
  gfx.moveTo(x1 + seg + jit(), y1 + jit()); gfx.lineTo(x1 + jit(), y1 + jit()); gfx.lineTo(x1 + jit(), y1 + seg + jit());
  // TR
  gfx.moveTo(x2 - seg + jit(), y1 + jit()); gfx.lineTo(x2 + jit(), y1 + jit()); gfx.lineTo(x2 + jit(), y1 + seg + jit());
  // BL
  gfx.moveTo(x1 + jit(), y2 - seg + jit()); gfx.lineTo(x1 + jit(), y2 + jit()); gfx.lineTo(x1 + seg + jit(), y2 + jit());
  // BR
  gfx.moveTo(x2 + jit(), y2 - seg + jit()); gfx.lineTo(x2 + jit(), y2 + jit()); gfx.lineTo(x2 - seg + jit(), y2 + jit());

  // Chromatic aberration label — three offset copies (R / W / B)
  const labelSize = Math.min(18, Math.max(12, h * 0.12));
  const baseStyle = { fontFamily: '"Courier New", monospace', fontWeight: 'bold', fontSize: labelSize };
  const name = detections[0].label;
  const shift = 3 + Math.sin(time * 8) * 2;

  const rTxt = new PIXI.Text(name, new PIXI.TextStyle({ ...baseStyle, fill: 0xff0000, alpha: 0.75 }));
  rTxt.anchor.set(0.5, 1); rTxt.position.set(cx - shift, y1 - 8);
  textContainer.addChild(rTxt);

  const bTxt = new PIXI.Text(name, new PIXI.TextStyle({ ...baseStyle, fill: 0x0088ff, alpha: 0.75 }));
  bTxt.anchor.set(0.5, 1); bTxt.position.set(cx + shift, y1 - 8);
  textContainer.addChild(bTxt);

  const wTxt = new PIXI.Text(name, new PIXI.TextStyle({ ...baseStyle, fill: 0xffffff }));
  wTxt.anchor.set(0.5, 1); wTxt.position.set(cx, y1 - 8);
  textContainer.addChild(wTxt);

  // Flashing "ERR" badge
  if (Math.sin(time * 6) > 0.3) {
    const errTxt = new PIXI.Text('ERR_404', new PIXI.TextStyle({
      fontFamily: 'monospace', fontSize: Math.max(9, boxMin * 0.065),
      fill: 0xff0000, fontWeight: 'bold',
    }));
    errTxt.position.set(x1 + 4, y2 - errTxt.style.fontSize - 4);
    textContainer.addChild(errTxt);
  }

  // Center dot
  gfx.lineStyle(0);
  gfx.beginFill(0x00ff88, 0.85);
  gfx.drawCircle(cx + jit(), cy + jit(), Math.max(3, boxMin * 0.025));
  gfx.endFill();
}
