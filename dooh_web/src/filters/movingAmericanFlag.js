import * as PIXI from 'pixi.js';

export const id = 'moving-american-flag';
export const label = 'Moving American Flag';

const FLAG_OFFSET_X_FACTOR = 0.45;
const FLAG_OFFSET_Y_FACTOR = 0.1;

export function draw(gfx, textContainer, detections, time) {
  const det = detections[0];
  const { x1, y1, x2, y2 } = det.box;
  const cx = (x1 + x2) / 2;
  const w = x2 - x1;
  const h = y2 - y1;
  const boxMin = Math.max(1, Math.min(w, h));

  gfx.lineStyle(Math.max(2, Math.min(w, h) * 0.012), 0xffffff, 1);
  gfx.drawRoundedRect(x1, y1, w, h, Math.max(8, Math.min(w, h) * 0.05));

  const poleX = x2 + w * FLAG_OFFSET_X_FACTOR;
  const poleTopY = y1 + h * 0.05;
  const poleBottomY = y2 + h * 0.35;
  const flagWidth = Math.max(88, w * 0.9);
  const flagHeight = Math.max(52, h * 0.5);
  const stripeHeight = flagHeight / 13;
  const wave = Math.sin(time * 3.2) * flagHeight * 0.06;

  gfx.lineStyle(Math.max(4, boxMin * 0.03), 0xd0d7e2, 1);
  gfx.moveTo(poleX, poleTopY - h * FLAG_OFFSET_Y_FACTOR);
  gfx.lineTo(poleX, poleBottomY);

  for (let stripe = 0; stripe < 13; stripe++) {
    const yBase = poleTopY + stripe * stripeHeight;
    const color = stripe % 2 === 0 ? 0xbf0a30 : 0xffffff;
    gfx.beginFill(color, 0.95);
    gfx.moveTo(poleX, yBase);
    for (let step = 1; step <= 8; step++) {
      const t = step / 8;
      const x = poleX + flagWidth * t;
      const y = yBase + Math.sin(time * 4 + t * 3.6) * wave * (0.4 + t);
      gfx.lineTo(x, y);
    }
    for (let step = 8; step >= 0; step--) {
      const t = step / 8;
      const x = poleX + flagWidth * t;
      const y = yBase + stripeHeight + Math.sin(time * 4 + t * 3.6) * wave * (0.4 + t);
      gfx.lineTo(x, y);
    }
    gfx.closePath();
    gfx.endFill();
  }

  const cantonWidth = flagWidth * 0.42;
  const cantonHeight = stripeHeight * 7;
  gfx.beginFill(0x002868, 0.98);
  gfx.moveTo(poleX, poleTopY);
  for (let step = 1; step <= 8; step++) {
    const t = step / 8;
    const x = poleX + cantonWidth * t;
    const y = poleTopY + Math.sin(time * 4 + t * 3.6) * wave * (0.4 + t);
    gfx.lineTo(x, y);
  }
  for (let step = 8; step >= 0; step--) {
    const t = step / 8;
    const x = poleX + cantonWidth * t;
    const y = poleTopY + cantonHeight + Math.sin(time * 4 + t * 3.6) * wave * (0.4 + t);
    gfx.lineTo(x, y);
  }
  gfx.closePath();
  gfx.endFill();

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 6; col++) {
      const starX = poleX + cantonWidth * (0.12 + col * 0.14) + row * 2;
      const starY = poleTopY + cantonHeight * (0.14 + row * 0.18);
      gfx.beginFill(0xffffff, 0.95);
      gfx.drawCircle(starX, starY, Math.max(1.8, boxMin * 0.012));
      gfx.endFill();
    }
  }

  const title = new PIXI.Text('AMERICAN FLAG', new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontWeight: 'bold',
    fontSize: Math.min(24, Math.max(14, h * 0.14)),
    fill: 0xffffff,
    stroke: 0x1f3c88,
    strokeThickness: 4,
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 4,
    dropShadowDistance: 2,
    letterSpacing: 1,
  }));
  title.anchor.set(0.5, 1);
  title.position.set(cx, y1 - 8);
  textContainer.addChild(title);
}
