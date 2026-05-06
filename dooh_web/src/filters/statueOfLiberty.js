import * as PIXI from 'pixi.js';
import * as PIXI3D from 'pixi3d/pixi7';
import {
  anchorPoint,
  drawBuildingForegroundOcclusion,
  getBoxMetrics,
  getCachedObject,
} from './arUtils';

export const id = 'statue-of-liberty';
export const label = 'Statue';

const STATUE_MODEL_PATH = '/assets/statue_of_liberty/scene.gltf';
const MODEL_DEPTH = 4.2;
const MODEL_OFFSET_Y = -12;
const MODEL_OFFSET_X_FACTOR = 0.85;
const MODEL_SCALE = 0.00039;
const MODEL_EXPOSURE = 1.55;
const MODEL_EMISSIVE = 0.08;
const BASE_ANCHOR = { x: 1 + MODEL_OFFSET_X_FACTOR, y: 1 };

let statueGltf = null;

function brightenModel(model) {
  model.meshes.forEach((mesh) => {
    const material = mesh.material;
    if (!material) return;

    if ('exposure' in material) {
      material.exposure = MODEL_EXPOSURE;
    }

    if (material.emissive) {
      material.emissive = new PIXI3D.Color(MODEL_EMISSIVE, MODEL_EMISSIVE * 1.25, MODEL_EMISSIVE);
    }
  });
}

export async function preload() {
  if (!statueGltf) {
    statueGltf = await PIXI.Assets.load(STATUE_MODEL_PATH);
  }
}

export function draw(gfx, textContainer, detections, time) {
  const metrics = getBoxMetrics(detections);
  if (!metrics) return;

  gfx.lineStyle(Math.max(2, metrics.minSize * 0.012), 0x7ee0b5, 1);
  gfx.drawRoundedRect(metrics.x1, metrics.y1, metrics.width, metrics.height, Math.max(8, metrics.minSize * 0.06));

  const title = new PIXI.Text('STATUE OF LIBERTY', new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontWeight: 'bold',
    fontSize: Math.min(24, Math.max(14, metrics.height * 0.14)),
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
  title.position.set(metrics.centerX, metrics.y1 - 8);
  textContainer.addChild(title);
}

export function draw3d(scene3d, detections, time, screen, context) {
  const metrics = getBoxMetrics(detections);
  if (!metrics) return;

  if (!PIXI3D.Camera.main || !statueGltf) return;

  const base = anchorPoint(metrics, BASE_ANCHOR);
  const worldPos = PIXI3D.Camera.main.screenToWorld(base.x, base.y + MODEL_OFFSET_Y, MODEL_DEPTH);
  if (!worldPos) return;

  const scaleMultiplier = Math.max(1.15, Math.min(2.6, metrics.minSize / 180));
  const model = getCachedObject(context, 'statue-model', () => {
    const instance = PIXI3D.Model.from(statueGltf);
    brightenModel(instance);
    return instance;
  });
  scene3d.addChild(model);
  model.position.set(worldPos.x, worldPos.y, worldPos.z);
  model.scale.set(MODEL_SCALE * scaleMultiplier);
  model.rotationQuaternion.setEulerAngles(0, -40, 0);
}

export function drawOcclusion(maskGfx, detections) {
  const metrics = getBoxMetrics(detections);
  if (!metrics) return;

  drawBuildingForegroundOcclusion(maskGfx, detections, {
    top: 0.56,
    bottom: 1,
    insetX: 0.04,
  });

  const base = anchorPoint(metrics, BASE_ANCHOR);
  const baseWidth = metrics.width * 0.6;
  const baseTop = metrics.y2 - metrics.height * 0.1;
  const baseHeight = metrics.height * 0.42;

  maskGfx.beginFill(0xffffff);
  maskGfx.drawRoundedRect(
    base.x - baseWidth * 0.5,
    baseTop,
    baseWidth,
    baseHeight,
    Math.max(8, metrics.minSize * 0.05)
  );
  maskGfx.endFill();
}
