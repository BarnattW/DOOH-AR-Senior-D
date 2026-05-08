/**
 * Brand Logo Filter — product on the left side, hovering and rotating in place
 * Uses GLTF and PNG assets from public assets.
 */
import * as PIXI from 'pixi.js';
import * as PIXI3D from 'pixi3d/pixi7';
import { BRANDS } from '../constants/brands';
import { anchorPoint, getBoxMetrics, getCachedObject } from './arUtils';

export const id = 'brandLogo';
export const label = 'Brand';

const MODEL_DEPTH = 3.05;
const MODEL_SCALE_BASE = 0.016;
const MODEL_X_ANCHOR = -0.08;
const MODEL_BOB_AMPLITUDE = 0.12;
const MODEL_BOB_SPEED = 1.6;

const loadedModels = {};
const loadedLogos = {};

export async function preload() {
  await Promise.all(BRANDS.map(async (brand) => {
    if (!loadedModels[brand.id]) {
      loadedModels[brand.id] = await PIXI.Assets.load(brand.modelPath);
    }
    if (brand.logoPath && !loadedLogos[brand.id]) {
      loadedLogos[brand.id] = await PIXI.Assets.load(brand.logoPath);
    }
  }));
}

function getBrandModel(context, brand) {
  const gltf = loadedModels[brand.id];
  if (!gltf) return null;
  return getCachedObject(context, `brand-model-${brand.id}`, () => PIXI3D.Model.from(gltf));
}

function getBrandLogo(context, brand) {
  const texture = loadedLogos[brand.id];
  if (!texture) return null;

  return getCachedObject(context, `brand-logo-${brand.id}`, () => {
    const sprite = PIXI.Sprite.from(texture);
    sprite.anchor.set(0.5);
    return sprite;
  });
}

export function draw(gfx, textContainer, detections, time, screen, context) {
  const metrics = getBoxMetrics(detections);
  if (!metrics) return;

  const currentBrand = BRANDS[0];
  const logo = getBrandLogo(context, currentBrand);
  if (!logo) return;

  const logoWidth = Math.min(
    Math.max(190, metrics.width * 0.54),
    Math.max(230, (screen?.width ?? 360) * 0.5)
  );
  const textureRatio = logo.texture?.height && logo.texture?.width
    ? logo.texture.height / logo.texture.width
    : 320 / 1200;
  logo.width = logoWidth;
  logo.height = logoWidth * textureRatio;
  logo.position.set(
    metrics.centerX,
    Math.min((screen?.height ?? metrics.y2) - logo.height * 0.72, metrics.y2 + logo.height * 0.7)
  );
  textContainer.addChild(logo);
}

export function draw3d(scene3d, detections, time, screen, context) {
  const metrics = getBoxMetrics(detections);
  if (!metrics || !PIXI3D.Camera.main) return;

  const currentBrand = BRANDS[0];
  const model = getBrandModel(context, currentBrand);
  if (!model) return;

  const anchor = anchorPoint(metrics, { x: MODEL_X_ANCHOR, y: 0.5 });
  const worldPos = PIXI3D.Camera.main.screenToWorld(anchor.x, anchor.y, MODEL_DEPTH);
  if (!worldPos) return;

  scene3d.addChild(model);

  const bob = Math.sin(time * MODEL_BOB_SPEED) * MODEL_BOB_AMPLITUDE;
  const scaleFactor = Math.max(1.15, Math.min(3.4, metrics.minSize / 105));
  const brandScale = currentBrand.modelScale ?? 1;
  const sideSway = Math.sin(time * (currentBrand.rotationSpeed ?? 1.5)) * (currentBrand.rotationAmplitude ?? 10);
  const rotationX = (currentBrand.rotationX ?? 0) + sideSway * -1;
  const rotationY = (currentBrand.rotationY ?? 0) + sideSway;
  const rotationZ = currentBrand.rotationZ ?? 0;

  model.position.set(worldPos.x, worldPos.y + bob, worldPos.z);
  model.scale.set(MODEL_SCALE_BASE * brandScale * scaleFactor);
  model.rotationQuaternion.setEulerAngles(rotationX, rotationY, rotationZ);
}
