import * as PIXI from 'pixi.js';
import * as PIXI3D from 'pixi3d/pixi7';

export const id = 'king-kong';
export const label = 'King Kong';

const KING_KONG_MODEL_PATH = '/assets/king_kong_scene_low_poly/scene.gltf';
const MODEL_DEPTH = 3.5;
const MODEL_OFFSET_Y = -150;
const MODEL_OFFSET_X_FACTOR = 0.6;
const MODEL_SCALE = 0.01;

let kingKongGltf = null;

export async function preload() {
  if (!kingKongGltf) {
    kingKongGltf = await PIXI.Assets.load(KING_KONG_MODEL_PATH);
  }
}

export function draw(gfx, textContainer, detections) {
  const det = detections[0];
  const { x1, y1, x2, y2 } = det.box;
  const cx = (x1 + x2) / 2;
  const w = x2 - x1;
  const h = y2 - y1;

  gfx.lineStyle(Math.max(2, Math.min(w, h) * 0.012), 0xffa500, 1);
  gfx.drawRect(x1, y1, w, h);

  const titleStyle = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontWeight: 'bold',
    fontSize: Math.min(24, Math.max(14, h * 0.14)),
    fill: 0xffcc66,
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 4,
    dropShadowDistance: 2,
  });

  const title = new PIXI.Text('KING KONG', titleStyle);
  title.anchor.set(0.5, 1);
  title.position.set(cx, y1 - 8);
  textContainer.addChild(title);
}

export function draw3d(scene3d, detections, time) {
  const det = detections[0];
  const { x1, y1, x2, y2 } = det.box;
  const cy = (y1 + y2) / 2;
  const w = x2 - x1;
  const h = y2 - y1;
  const boxMin = Math.min(w, h);

  if (!PIXI3D.Camera.main || !kingKongGltf) return;

  const screenX = x1 - w * MODEL_OFFSET_X_FACTOR;
  const worldPos = PIXI3D.Camera.main.screenToWorld(screenX, cy - MODEL_OFFSET_Y, MODEL_DEPTH);
  if (!worldPos) return;

  // Scale model based on bounding box size
  const scaleMultiplier = Math.max(0.5, Math.min(3, boxMin / 200));
  const modelScale = MODEL_SCALE * scaleMultiplier;

  const model = scene3d.addChild(PIXI3D.Model.from(kingKongGltf));
  model.position.set(worldPos.x, worldPos.y, worldPos.z);
  model.scale.set(modelScale);
  model.rotationQuaternion.setEulerAngles(0, 0, 0);
}
