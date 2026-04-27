import * as PIXI from 'pixi.js';
import * as PIXI3D from 'pixi3d/pixi7';

export const id = 'statue-of-liberty';
export const label = 'Statue';

const STATUE_MODEL_PATH = '/assets/statue_of_liberty/scene.gltf';
const MODEL_DEPTH = 4.2;
const MODEL_OFFSET_Y = -30;
const MODEL_OFFSET_X_FACTOR = 0.85;
const MODEL_SCALE = 0.00039;

let statueGltf = null;

export async function preload() {
  if (!statueGltf) {
    statueGltf = await PIXI.Assets.load(STATUE_MODEL_PATH);
  }
}

export function draw(gfx, textContainer, detections) {
  const det = detections[0];
  const { x1, y1, x2, y2 } = det.box;
  const cx = (x1 + x2) / 2;
  const w = x2 - x1;
  const h = y2 - y1;

  gfx.lineStyle(Math.max(2, Math.min(w, h) * 0.012), 0x7ee0b5, 1);
  gfx.drawRoundedRect(x1, y1, w, h, Math.max(8, Math.min(w, h) * 0.06));

  const title = new PIXI.Text('STATUE OF LIBERTY', new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontWeight: 'bold',
    fontSize: Math.min(24, Math.max(14, h * 0.14)),
    fill: 0xb8ffe4,
    stroke: 0x12382e,
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

export function draw3d(scene3d, detections) {
  const det = detections[0];
  const { x1, y1, x2, y2 } = det.box;
  const w = x2 - x1;
  const boxMin = Math.max(1, Math.min(x2 - x1, y2 - y1));

  if (!PIXI3D.Camera.main || !statueGltf) return;

  const screenX = x2 + w * MODEL_OFFSET_X_FACTOR;
  const worldPos = PIXI3D.Camera.main.screenToWorld(screenX, y2 + MODEL_OFFSET_Y, MODEL_DEPTH);
  if (!worldPos) return;

  const scaleMultiplier = Math.max(1.15, Math.min(2.6, boxMin / 180));
  const model = scene3d.addChild(PIXI3D.Model.from(statueGltf));
  model.position.set(worldPos.x, worldPos.y, worldPos.z);
  model.scale.set(MODEL_SCALE * scaleMultiplier);
  model.rotationQuaternion.setEulerAngles(0, -40, 0);
}
