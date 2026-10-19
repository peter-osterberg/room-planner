import { clamp, validNumber } from './geometry.js';

/** @param {number} rotation @param {number} tilt @param {number} dx @param {number} dy */
export function orbitView(rotation, tilt, dx, dy) {
  return { rotation: ((rotation + dx * .4 + 180) % 360 + 360) % 360 - 180, tilt: clamp(tilt - dy * .25, 25, 75) };
}

/** Fixed light from the upper left of the room, independent of the camera.
 * @param {number} angle Horizontal surface normal in degrees.
 */
export function surfaceShade(angle) {
  return `${16 - 10 * Math.cos((angle + 135) * Math.PI / 180)}%`;
}

/** @typedef {{kind: string, height?: number, sillHeight?: number}} VerticalOpening */

/** @param {VerticalOpening} opening */
export function openingBounds(opening) {
  const height = opening.height === undefined ? (opening.kind === 'window' ? 120 : 210) : opening.height;
  const bottom = opening.kind === 'window' ? (opening.sillHeight === undefined ? 90 : opening.sillHeight) : 0;
  return { height, bottom, top: bottom + height };
}

/** @param {VerticalOpening} opening @param {number} ceilingHeight */
export function validOpeningHeight(opening, ceilingHeight) {
  const { height, bottom, top } = openingBounds(opening);
  return validNumber(height, 0.1) && validNumber(bottom, 0) && top <= ceilingHeight + 1e-8;
}

/** Cut wall faces around openings, merging overlapping gaps.
 * @param {number} length
 * @param {(VerticalOpening & {offset: number, width: number})[]} openings
 * @param {number} [ceilingHeight]
 */
export function wallSections(length, openings, ceilingHeight = 240) {
  const sections = [];
  const edges = [...new Set([0, length, ...openings.flatMap((opening) => [opening.offset, opening.offset + opening.width])])].sort((a, b) => a - b);
  for (let i = 1; i < edges.length; i++) {
    const offset = edges[i - 1];
    const width = edges[i] - offset;
    const gaps = openings.filter((opening) => opening.offset < offset + width && opening.offset + opening.width > offset);
    let z = 0;
    for (const gap of gaps.map(openingBounds).sort((a, b) => a.bottom - b.bottom)) {
      if (gap.bottom > z) sections.push({ offset, width, z, height: gap.bottom - z });
      z = Math.max(z, gap.top);
    }
    if (z < ceilingHeight) sections.push({ offset, width, z, height: ceilingHeight - z });
  }
  return sections;
}

/** Default heights in cm for new furniture and plans saved before heights were added. */
export const furnitureHeights = {
  sofa: 75, 'chaise-sofa': 75, chair: 80, table: 42, bed: 50, storage: 100,
  rug: 1, tv: 70, art: 60, sill: 5, 'plant-small': 35, 'plant-floor': 90,
  'plant-large': 150, outlet: 8, light: 10, custom: 60, person: 175, 'round-table': 75
};

/** @param {string} kind @param {number} [ceilingHeight] @param {number} [height] @param {number} [elevation] */
export function furnitureElevation(kind, ceilingHeight = 240, height = 10, elevation) {
  if (elevation !== undefined) return elevation;
  return kind === 'art' || kind === 'tv' ? 100 : kind === 'sill' ? 90 : kind === 'outlet' ? 25 : kind === 'light' ? Math.max(0, ceilingHeight - height) : 0;
}

/** Preserve automatic placement for older plans; explicit elevations must fit below the ceiling.
 * @param {{height: number, elevation?: number}} item @param {number} ceilingHeight
 */
export function validFurnitureElevation(item, ceilingHeight) {
  return item.elevation === undefined || validNumber(item.elevation, 0) && item.elevation + item.height <= ceilingHeight + 1e-8;
}
