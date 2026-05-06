import * as PIXI from 'pixi.js';
import { SimplePlane } from '@pixi/mesh-extras';
import {
  anchorPoint,
  getBoxMetrics,
  getCachedObject,
} from './arUtils';

export const id = 'moving-american-flag';
export const label = 'Moving American Flag';

const FLAG_TEXTURE_PATH = '/assets/moving_american_flag/textures/PlaneShape_baseColor.png';
const FLAG_OFFSET_X_FACTOR = 0.45;
const FLAG_OFFSET_Y_FACTOR = 0.1;
const FLAG_VERTICES_X = 16;
const FLAG_VERTICES_Y = 6;
const FLAG_POLE_ANCHOR = { x: 1 + FLAG_OFFSET_X_FACTOR, y: 0.05 };

let flagTexture = null;

export async function preload() {
  if (!flagTexture) {
    flagTexture = await PIXI.Assets.load(FLAG_TEXTURE_PATH);
  }
}

function drawTexturedFlag(textContainer, poleX, poleTopY, flagWidth, flagHeight, time, context) {
  if (!flagTexture) return;

  const flag = getCachedObject(
    context,
    'flag-plane',
    () => new SimplePlane(flagTexture, FLAG_VERTICES_X, FLAG_VERTICES_Y)
  );
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

export function draw(gfx, textContainer, detections, time, screen, context) {
  const metrics = getBoxMetrics(detections);
  if (!metrics) return;

  gfx.lineStyle(Math.max(2, metrics.minSize * 0.012), 0xffffff, 1);
  gfx.drawRoundedRect(metrics.x1, metrics.y1, metrics.width, metrics.height, Math.max(8, metrics.minSize * 0.05));

  const poleTop = anchorPoint(metrics, FLAG_POLE_ANCHOR);
  const poleX = poleTop.x;
  const poleTopY = poleTop.y;
  const poleBottomY = metrics.y2 + metrics.height * 0.35;
  const flagWidth = Math.max(88, metrics.width * 0.9);
  const flagHeight = Math.max(52, metrics.height * 0.5);

  gfx.lineStyle(Math.max(4, metrics.minSize * 0.03), 0xd0d7e2, 1);
  gfx.moveTo(poleX, poleTopY - metrics.height * FLAG_OFFSET_Y_FACTOR);
  gfx.lineTo(poleX, poleBottomY);
  drawTexturedFlag(textContainer, poleX, poleTopY, flagWidth, flagHeight, time, context);

  const title = getCachedObject(context, 'flag-title', () => new PIXI.Text('AMERICAN FLAG', new PIXI.TextStyle({
      fontFamily: 'Arial',
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: 0x1f3c88,
      strokeThickness: 4,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowBlur: 4,
      dropShadowDistance: 2,
      letterSpacing: 1,
    })));
  title.style.fontSize = Math.min(24, Math.max(14, metrics.height * 0.14));
  title.anchor.set(0.5, 1);
  title.position.set(metrics.centerX, metrics.y1 - 8);
  textContainer.addChild(title);
}
