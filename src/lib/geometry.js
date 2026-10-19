/** @typedef {{ width: number, height: number }} Room */
/** @typedef {{ x: number, y: number, width: number, depth: number, angle: number, kind?: string, sofaDepth?: number, chaiseWidth?: number, chaiseSide?: string }} Furniture */

/** The axis-aligned half extents of a rotated rectangle, in centimeters.
 * @param {Furniture} item
 */
export function halfExtents(item) {
  const radians = item.angle * Math.PI / 180;
  const c = Math.abs(Math.cos(radians));
  const s = Math.abs(Math.sin(radians));
  return { x: (item.width * c + item.depth * s) / 2, y: (item.width * s + item.depth * c) / 2 };
}

/** Keeps the entire rotated rectangle inside the room without changing its size.
 * @param {Furniture} item
 * @param {Room} room
 */
export function fitFurniture(item, room) {
  const half = halfExtents(item);
  if (half.x * 2 > room.width + 1e-8 || half.y * 2 > room.height + 1e-8) return null;
  return { ...item, x: clamp(item.x, half.x, room.width - half.x), y: clamp(item.y, half.y, room.height - half.y) };
}

/** Soft alignment of outer edges and centers, without resizing the object.
 * @param {Furniture & {id: string}} item @param {Room} room
 * @param {(Furniture & {id: string})[]} others @param {number} threshold
 */
export function snapFurniture(item, room, others, threshold) {
  const fitted = fitFurniture(item, room);
  if (!fitted) return null;
  const half = halfExtents(fitted);
  const targetsX = [half.x, room.width - half.x];
  const targetsY = [half.y, room.height - half.y];
  for (const other of others) {
    if (other.id === item.id || other.width === 0 || other.depth === 0) continue;
    const size = halfExtents(other);
    if (Math.abs(other.y - fitted.y) <= half.y + size.y + threshold) {
      targetsX.push(other.x - size.x - half.x, other.x + size.x + half.x,
        other.x - size.x + half.x, other.x + size.x - half.x, other.x);
    }
    if (Math.abs(other.x - fitted.x) <= half.x + size.x + threshold) {
      targetsY.push(other.y - size.y - half.y, other.y + size.y + half.y,
        other.y - size.y + half.y, other.y + size.y - half.y, other.y);
    }
  }
  const nearest = (value, targets, min, max) => targets
    .filter((target) => target >= min && target <= max && Math.abs(target - value) <= threshold)
    .reduce((best, target) => Math.abs(target - value) < Math.abs(best - value) ? target : best, Infinity);
  const x = nearest(fitted.x, targetsX, half.x, room.width - half.x);
  const y = nearest(fitted.y, targetsY, half.y, room.height - half.y);
  return { ...fitted, x: Number.isFinite(x) ? x : fitted.x, y: Number.isFinite(y) ? y : fitted.y };
}

/** @param {number} value @param {number} min @param {number} max */
export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

/** @param {string} wall @param {Room} room */
export function wallLength(wall, room) { return wall === 'top' || wall === 'bottom' ? room.width : room.height; }

/** @param {unknown} value @param {number} min @param {number} [max] */
export function validNumber(value, min, max = 5000) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/** @typedef {{id: string, wall: string, offset: number, width: number}} Opening */
/** @typedef {{x: number, y: number}} Point */

/** Validate the two parts of a chaise sofa. Depth is measured from its back.
 * @param {Furniture} item
 */
export function validChaise(item) {
  return item.kind !== 'chaise-sofa' || (validNumber(item.sofaDepth, 1, item.depth)
    && validNumber(item.chaiseWidth, 1, item.width) && ['left', 'right'].includes(item.chaiseSide ?? ''));
}

/** Local footprint in centimeters, shared by the sketch and rulers.
 * @param {Furniture} item @returns {number[][]}
 */
export function furniturePoints(item) {
  const w = item.width / 2, d = item.depth / 2;
  if (item.kind !== 'chaise-sofa') return [[-w, -d], [w, -d], [w, d], [-w, d]];
  const front = -d + (item.sofaDepth ?? item.depth);
  const edge = w - (item.chaiseWidth ?? item.width);
  const points = [[-w, -d], [w, -d], [w, d], [edge, d], [edge, front], [-w, front]];
  return item.chaiseSide === 'left' ? points.map(([x, y]) => [-x, y]) : points;
}

/** Actual corners, so rulers also measure rotated furniture correctly.
 * @param {Furniture | Opening} item @param {Room} room
 * @returns {Point[]}
 */
function corners(item, room) {
  if ('wall' in item) {
    const end = item.offset + item.width;
    if (item.wall === 'top' || item.wall === 'bottom') {
      const y = item.wall === 'top' ? 0 : room.height;
      return [{ x: item.offset, y }, { x: end, y }];
    }
    const x = item.wall === 'left' ? 0 : room.width;
    return [{ x, y: item.offset }, { x, y: end }];
  }
  const angle = item.angle * Math.PI / 180;
  return furniturePoints(item).map(([x, y]) => ({
    x: item.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: item.y + x * Math.sin(angle) + y * Math.cos(angle)
  }));
}

/** Intersections of a polygon (or wall opening) with a horizontal line.
 * @param {Point[]} polygon @param {number} y
 */
function spanAt(polygon, y) {
  const xs = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if (y < Math.min(a.y, b.y) - 1e-8 || y > Math.max(a.y, b.y) + 1e-8) continue;
    if (Math.abs(a.y - b.y) < 1e-8) xs.push(a.x, b.x);
    else xs.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y));
  }
  return [Math.min(...xs), Math.max(...xs)];
}

/** Nearest horizontal/vertical clearances to walls or aligned objects, in cm.
 * @param {string} id @param {Room} room
 * @param {(Furniture & {id: string})[]} items @param {Opening[]} openings
 */
export function measurementGuides(id, room, items, openings) {
  const objects = [...items, ...openings];
  const target = objects.find((item) => item.id === id);
  if (!target) return [];
  const polygon = corners(target, room);
  return ['left', 'right', 'top', 'bottom'].flatMap((direction) => {
    const horizontal = direction === 'left' || direction === 'right';
    const sign = direction === 'left' || direction === 'top' ? -1 : 1;
    const transform = (p) => ({ x: sign * (horizontal ? p.x : p.y), y: horizontal ? p.y : p.x });
    const restore = (p) => horizontal ? { x: sign * p.x, y: p.y } : { x: p.y, y: sign * p.x };
    const shape = polygon.map(transform);
    const edge = Math.max(...shape.map((p) => p.x));
    const outer = shape.filter((p) => Math.abs(p.x - edge) < 1e-8);
    const center = (Math.min(...shape.map((p) => p.y)) + Math.max(...shape.map((p) => p.y))) / 2;
    const wall = sign < 0 ? 0 : horizontal ? room.width : room.height;
    if (wall - edge < 1e-8) return [];
    let y = outer.reduce((sum, p) => sum + p.y, 0) / outer.length;
    let start = { x: edge, y }, end = { x: wall, y };
    let distance = wall - edge;
    for (const other of objects) {
      if (other.id === id) continue;
      const obstacle = corners(other, room).map(transform);
      const low = Math.max(Math.min(...shape.map((p) => p.y)), Math.min(...obstacle.map((p) => p.y)));
      const high = Math.min(Math.max(...shape.map((p) => p.y)), Math.max(...obstacle.map((p) => p.y)));
      if (high < low - 1e-8) continue;
      // Polygon edges are linear; the minimum gap occurs at a vertex height.
      const rows = [clamp(center, low, high), low, high, ...shape.map((p) => p.y), ...obstacle.map((p) => p.y)].filter((v) => v >= low && v <= high);
      let nearest = { gap: Infinity, from: 0, to: 0, y: 0 };
      for (y of rows) {
        const from = spanAt(shape, y)[1], to = spanAt(obstacle, y)[0];
        if (to - from < nearest.gap - 1e-8) nearest = { gap: to - from, from, to, y };
      }
      // Intersecting objects do not have a positive clearance in this direction.
      if (nearest.gap < -1e-8 || nearest.gap >= distance - 1e-8) continue;
      distance = Math.max(0, nearest.gap);
      start = { x: nearest.from, y: nearest.y };
      end = { x: nearest.to, y: nearest.y };
    }
    return [{ direction, start: restore(start), end: restore(end), distance }];
  });
}
