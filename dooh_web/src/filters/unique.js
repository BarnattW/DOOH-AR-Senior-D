import * as kingKong from './kingKong';
import * as fireworks from './fireworks';
import * as movingAmericanFlag from './movingAmericanFlag';

export const id = 'unique';
export const label = 'Unique';

const BUILDING_FILTERS = {
  'Hudson Yards - The Edge': movingAmericanFlag,
  'Empire State Building': kingKong,
  'WTC': fireworks,
};

function getBuildingFilter(detections) {
  const buildingLabel = detections?.[0]?.label;
  return BUILDING_FILTERS[buildingLabel] ?? null;
}

export async function preload() {
  await Promise.all(
    Object.values(BUILDING_FILTERS).map((filter) => filter.preload?.())
  );
}

export function draw(gfx, textContainer, detections, time, screen) {
  const filter = getBuildingFilter(detections);
  filter?.draw?.(gfx, textContainer, detections, time, screen);
}

export function draw3d(scene3d, detections, time, screen) {
  const filter = getBuildingFilter(detections);
  filter?.draw3d?.(scene3d, detections, time, screen);
}
