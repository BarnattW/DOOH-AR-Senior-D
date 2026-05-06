import * as PIXI from 'pixi.js';
import * as PIXI3D from 'pixi3d/pixi7';
import {
  anchorPoint,
  drawBuildingForegroundOcclusion,
  getBoxMetrics,
  getCachedObject,
} from './arUtils';

export const id = 'king-kong';
export const label = 'King Kong';

const KING_KONG_MODEL_PATH = '/assets/king_kong_scene_low_poly/scene.gltf';
const MODEL_DEPTH = 3.5;
const MODEL_OFFSET_Y = -150;
const MODEL_OFFSET_X_FACTOR = 0.6;
const MODEL_SCALE = 0.01;
const CLIMB_ANCHOR = { x: -MODEL_OFFSET_X_FACTOR, y: 0.5 };

let kingKongGltf = null;

export async function preload() {
  if (!kingKongGltf) {
    kingKongGltf = await PIXI.Assets.load(KING_KONG_MODEL_PATH);
  }
}

export function draw(gfx, textContainer, detections, time) {
  const metrics = getBoxMetrics(detections);
  if (!metrics) return;

  gfx.lineStyle(Math.max(2, metrics.minSize * 0.012), 0xffa500, 1);
  gfx.drawRect(metrics.x1, metrics.y1, metrics.width, metrics.height);

  const titleStyle = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontWeight: 'bold',
    fontSize: Math.min(24, Math.max(14, metrics.height * 0.14)),
    fill: 0xffcc66,
    dropShadow: true,
    dropShadowColor: 0x000000,
    dropShadowBlur: 4,
    dropShadowDistance: 2,
  });

  const title = new PIXI.Text('KING KONG', titleStyle);
  title.anchor.set(0.5, 1);
  title.position.set(metrics.centerX, metrics.y1 - 8);
  textContainer.addChild(title);
}

export function draw3d(scene3d, detections, time, screen, context) {
  const metrics = getBoxMetrics(detections);
  if (!metrics) return;

  if (!PIXI3D.Camera.main || !kingKongGltf) return;

  const anchor = anchorPoint(metrics, CLIMB_ANCHOR);
  const worldPos = PIXI3D.Camera.main.screenToWorld(anchor.x, anchor.y - MODEL_OFFSET_Y, MODEL_DEPTH);
  if (!worldPos) return;

  const scaleMultiplier = Math.max(0.5, Math.min(3, metrics.minSize / 200));
  const modelScale = MODEL_SCALE * scaleMultiplier;

  const model = getCachedObject(context, 'king-kong-model', () => PIXI3D.Model.from(kingKongGltf));
  scene3d.addChild(model);
  model.position.set(worldPos.x, worldPos.y, worldPos.z);
  model.scale.set(modelScale);
  model.rotationQuaternion.setEulerAngles(0, 0, 0);
}

export function drawOcclusion(maskGfx, detections) {
  drawBuildingForegroundOcclusion(maskGfx, detections, {
    top: 0.36,
    bottom: 1,
    insetX: 0.02,
  });
}
