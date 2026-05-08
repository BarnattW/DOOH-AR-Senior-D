import * as kingKong from './kingKong';
import * as fireworks from './fireworks';
import * as brandLogo from './brandLogo';

export const id = 'unique';
export const label = 'Unique';

const BUILDING_FILTERS = {
  'Hudson Yards - The Edge': brandLogo,
  'Empire State Building': kingKong,
  'WTC': fireworks,
};

function getBuildingFilter(detections) {
  const buildingLabel = detections?.[0]?.label;
  return BUILDING_FILTERS[buildingLabel] ?? null;
}

function getChildContext(context, filter) {
  if (!context || !filter) return context;

  if (!context.objects.has(filter.id)) {
    context.objects.set(filter.id, { objects: new Map() });
  }

  return context.objects.get(filter.id);
}

export async function preload() {
  await Promise.all(
    Object.values(BUILDING_FILTERS).map((filter) => filter.preload?.())
  );
}

export function draw(gfx, textContainer, detections, time, screen, context) {
  const filter = getBuildingFilter(detections);
  filter?.draw?.(gfx, textContainer, detections, time, screen, getChildContext(context, filter));
}

export function draw3d(scene3d, detections, time, screen, context) {
  const filter = getBuildingFilter(detections);
  filter?.draw3d?.(scene3d, detections, time, screen, getChildContext(context, filter));
}

export function drawOcclusion(maskGfx, detections, time, screen, context) {
  const filter = getBuildingFilter(detections);
  filter?.drawOcclusion?.(maskGfx, detections, time, screen, getChildContext(context, filter));
}
