import * as PIXI from 'pixi.js';
import { SimplePlane } from '@pixi/mesh-extras';

export const id = 'moving-american-flag';
export const label = 'Moving American Flag';

const FLAG_TEXTURE_PATH = '/assets/moving_american_flag/textures/PlaneShape_baseColor.png';
const FLAG_OFFSET_X_FACTOR = 0.45;
const FLAG_OFFSET_Y_FACTOR = 0.1;
const FLAG_VERTICES_X = 16;
const FLAG_VERTICES_Y = 6;

let flagTexture = null;

export async function preload() {
  if (!flagTexture) {
    flagTexture = await PIXI.Assets.load(FLAG_TEXTURE_PATH);
  }
}

function drawTexturedFlag(textContainer, poleX, poleTopY, flagWidth, flagHeight, time) {
  if (!flagTexture) return;

  const flag = new SimplePlane(flagTexture, FLAG_VERTICES_X, FLAG_VERTICES_Y);
  flag.position.set(poleX, poleTopY + flagHeight);
  flag.scale.set(flagWidth / flagTexture.width, -flagHeight / flagTexture.height);

  const vertexBuffer = flag.geometry.getBuffer('aVertexPosition');
  const vertices = vertexBuffer.data;
  const waveSize = flagTexture.height * 0.04;

  for (let row = 0; row < FLAG_VERTICES_Y; row++) {
    for (let col = 0; col < FLAG_VERTICES_X; col++) {
      const index = (row * FLAG_VERTICES_X + col) * 2;
      const x = (col / (FLAG_VERTICES_X - 1)) * flagTexture.width;
      const y = (row / (FLAG_VERTICES_Y - 1)) * flagTexture.height;
      const waveStrength = col / (FLAG_VERTICES_X - 1);

      vertices[index] = x;
      vertices[index + 1] = y + Math.sin(time * 4 + col * 0.7 + row * 0.25) * waveSize * waveStrength;
    }
  }

  vertexBuffer.update();
  textContainer.addChild(flag);
}

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

  gfx.lineStyle(Math.max(4, boxMin * 0.03), 0xd0d7e2, 1);
  gfx.moveTo(poleX, poleTopY - h * FLAG_OFFSET_Y_FACTOR);
  gfx.lineTo(poleX, poleBottomY);
  drawTexturedFlag(textContainer, poleX, poleTopY, flagWidth, flagHeight, time);

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
