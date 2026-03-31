import * as PIXI from 'pixi.js';
import * as PIXI3D from 'pixi3d/pixi7';

export const id = 'cyber';
export const label = 'Cyber';

export function draw(gfx, textContainer, detections, time) {
  const det = detections[0];
  const { x1, y1, x2, y2 } = det.box;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const w = x2 - x1;
  const h = y2 - y1;
  const boxMin = Math.max(1, Math.min(w, h));

  const pulse = Math.sin(time * 2) * 0.5 + 0.5;

  gfx.lineStyle(0);
  gfx.beginFill(0x00ff00, 0.3 + pulse * 0.3);
  gfx.drawCircle(cx, cy, Math.max(18, boxMin * 0.35) + pulse * boxMin * 0.08);
  gfx.endFill();

  const crossHalf = Math.max(24, boxMin * 0.45);
  gfx.lineStyle(Math.max(2, boxMin * 0.01), 0x00ff00, 1);
  gfx.moveTo(cx - crossHalf, cy);
  gfx.lineTo(cx + crossHalf, cy);
  gfx.moveTo(cx, cy - crossHalf);
  gfx.lineTo(cx, cy + crossHalf);

  const brk = Math.max(16, boxMin * 0.25);
  const lw = Math.max(2, boxMin * 0.012);
  gfx.lineStyle(lw, 0x00ff00, 1);
  _corner(gfx, x1, y1, brk, 1, 1);
  _corner(gfx, x2, y1, brk, -1, 1);
  _corner(gfx, x1, y2, brk, 1, -1);
  _corner(gfx, x2, y2, brk, -1, -1);

  const titleSize = Math.min(22, Math.max(13, h * 0.14));
  const subSize = Math.min(16, Math.max(11, h * 0.1));
  const panelH = titleSize + subSize + 18;
  const labelStr = det.label;
  const confStr = `${(det.confidence * 100).toFixed(1)}%`;

  const titleStyle = new PIXI.TextStyle({ fontFamily: 'Arial', fontWeight: 'bold', fontSize: titleSize, fill: 0x00ff00 });
  const subStyle = new PIXI.TextStyle({ fontFamily: 'Arial', fontSize: subSize, fill: 0x00ff00 });

  const titleMeasure = PIXI.TextMetrics.measureText(labelStr, titleStyle);
  const subMeasure = PIXI.TextMetrics.measureText(confStr, subStyle);
  const panelW = Math.max(titleMeasure.width, subMeasure.width) + 24;

  let panelX = cx - panelW / 2;
  panelX = Math.max(4, Math.min(panelX, gfx.currentPath ? 9999 : 9999));
  let panelY = y1 - panelH - 10;
  if (panelY < 4) panelY = y2 + 10;

  gfx.lineStyle(Math.max(1, boxMin * 0.006), 0x00ff00, 1);
  gfx.beginFill(0x000000, 0.82);
  gfx.drawRect(panelX, panelY, panelW, panelH);
  gfx.endFill();

  const titleTxt = new PIXI.Text(labelStr, titleStyle);
  titleTxt.anchor.set(0.5, 0);
  titleTxt.position.set(panelX + panelW / 2, panelY + 6);
  textContainer.addChild(titleTxt);

  const confTxt = new PIXI.Text(confStr, subStyle);
  confTxt.anchor.set(0.5, 0);
  confTxt.position.set(panelX + panelW / 2, panelY + titleSize + 10);
  textContainer.addChild(confTxt);
}

export function draw3d(scene3d, detections, time) {
  const det = detections[0];
  const { x1, y1, x2, y2 } = det.box;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  if (!PIXI3D.Camera.main) return;

  const worldPos = PIXI3D.Camera.main.screenToWorld(cx, cy - 80, 3.5);
  if (!worldPos) return;

  const sprite = scene3d.addChild(new PIXI3D.Sprite3D(PIXI.Texture.WHITE));
  sprite.billboardType = PIXI3D.SpriteBillboardType.spherical;
  sprite.position.set(worldPos.x, worldPos.y, worldPos.z);
  sprite.scale.set(0.45 + Math.sin(time * 2) * 0.08);
  sprite.tint = 0x00ff66;
  sprite.alpha = 0.75;
}

function _corner(gfx, cx, cy, size, dx, dy) {
  gfx.moveTo(cx + dx * size, cy);
  gfx.lineTo(cx, cy);
  gfx.lineTo(cx, cy + dy * size);
}
