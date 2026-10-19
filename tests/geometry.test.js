import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitFurniture, halfExtents, measurementGuides, snapFurniture, wallLength, validNumber } from '../src/lib/geometry.js';

test('centimeter dimensions, rotation and boundary constraints preserve furniture scale', () => {
  const room = { width: 500, height: 400 };
  const sofa = { width: 220, depth: 90, x: 110, y: 45, angle: 0 };
  assert.deepEqual(halfExtents(sofa), { x: 110, y: 45 });
  const turned = fitFurniture({ ...sofa, angle: 90, x: -20, y: 600 }, room);
  assert.ok(turned);
  assert.ok(Math.abs(turned.x - 45) < 1e-8);
  assert.ok(Math.abs(turned.y - 290) < 1e-8);
  assert.equal(turned.width, 220);
  assert.equal(turned.depth, 90);
  const diagonal = halfExtents({ ...sofa, angle: 45 });
  assert.ok(Math.abs(diagonal.x - 310 / Math.sqrt(2) / 2) < 1e-8);
  assert.equal(fitFurniture(sofa, { width: 100, height: 100 }), null);
  assert.equal(wallLength('left', room), 400);
  assert.equal(wallLength('bottom', room), 500);
  assert.equal(validNumber(NaN, 1), false);
  assert.equal(validNumber(undefined, 1), false);
  assert.equal(validNumber(-1, 0), false);
});

test('rulers find the nearest aligned object or wall and update when moved', () => {
  const room = { width: 500, height: 400 };
  const sofa = { id: 'sofa', width: 220, depth: 90, x: 145, y: 80, angle: 0 };
  const table = { id: 'table', width: 110, depth: 60, x: 145, y: 190, angle: 0 };
  const guides = measurementGuides('sofa', room, [sofa, table], []);
  assert.deepEqual(guides.map((guide) => guide.distance), [35, 245, 35, 35]);
  const bottom = guides.find((guide) => guide.direction === 'bottom');
  assert.deepEqual(bottom.start, { x: 145, y: 125 });
  assert.deepEqual(bottom.end, { x: 145, y: 160 });
  const moved = measurementGuides('sofa', room, [{ ...sofa, x: 370 }, table], []);
  assert.equal(moved.find((guide) => guide.direction === 'bottom').distance, 275);
  const overlap = measurementGuides('sofa', room, [sofa, { ...table, y: 100 }], []);
  assert.ok(overlap.every((guide) => guide.distance >= 0));
  assert.deepEqual(measurementGuides('', room, [sofa], []), []);
});

test('rulers use actual rotated edges and opening endpoints on all walls', () => {
  const room = { width: 500, height: 400 };
  const square = { id: 'square', width: 100, depth: 100, x: 200, y: 200, angle: 45 };
  const table = { id: 'table', width: 100, depth: 100, x: 350, y: 200, angle: 0 };
  const right = measurementGuides('square', room, [square, table], []).find((guide) => guide.direction === 'right');
  assert.ok(Math.abs(right.distance - (100 - Math.sqrt(5000))) < 1e-8);
  assert.ok(Math.abs(right.start.y - 200) < 1e-8);
  for (const wall of ['top', 'bottom', 'left', 'right']) {
    const opening = { id: 'opening', wall, offset: 60, width: 90 };
    const guides = measurementGuides('opening', room, [], [opening]);
    assert.equal(guides.length, 3);
    assert.equal(guides.find((guide) => guide.direction === (['top', 'bottom'].includes(wall) ? 'left' : 'top')).distance, 60);
  }
  const windows = [{ id: 'one', wall: 'top', offset: 60, width: 90 }, { id: 'two', wall: 'top', offset: 200, width: 80 }];
  assert.equal(measurementGuides('one', room, [], windows).find((guide) => guide.direction === 'right').distance, 50);
});

test('electrical planning symbols are points with exact wall positions and clearances', () => {
  const room = { width: 500, height: 400 };
  const outlet = { id: 'outlet', x: 0, y: 100, width: 0, depth: 0, angle: 0 };
  assert.deepEqual(fitFurniture(outlet, room), outlet);
  assert.deepEqual(measurementGuides('outlet', room, [outlet], []).map((guide) => guide.distance), [500, 100, 300]);
  assert.equal(fitFurniture({ ...outlet, x: -10 }, room).x, 0);
});


test('soft snapping aligns walls, nearby furniture edges and centers, preserving rotation and size', () => {
  const room = { width: 500, height: 400 };
  const item = { id: 'moving', width: 100, depth: 60, x: 54, y: 90, angle: 0 };
  assert.equal(snapFurniture(item, room, [], 6).x, 50);
  assert.equal(snapFurniture({ ...item, x: 57 }, room, [], 6).x, 57);
  const neighbor = { ...item, id: 'neighbor', x: 250, y: 150 };
  assert.equal(snapFurniture({ ...item, x: 146, y: 150 }, room, [neighbor], 6).x, 150);
  assert.equal(snapFurniture({ ...item, x: 254, y: 86 }, room, [neighbor], 6).y, 90);
  assert.equal(snapFurniture({ ...item, x: 254, y: 90 }, room, [neighbor], 6).x, 250);
  assert.equal(snapFurniture({ ...item, x: 146, y: 350 }, room, [neighbor], 6).x, 146);
  const rotated = snapFurniture({ ...item, x: 32, angle: 90 }, room, [], 6);
  assert.ok(Math.abs(rotated.x - 30) < 1e-8);
  assert.equal(rotated.width, 100);
  assert.equal(rotated.depth, 60);
  assert.equal(rotated.angle, 90);
  assert.equal(snapFurniture(item, { width: 50, height: 50 }, [], 6), null);
});

test('chaise sofa footprint measures the open space beside its extension', async () => {
  const { furniturePoints, validChaise } = await import('../src/lib/geometry.js');
  const sofa = { id: 'chaise', kind: 'chaise-sofa', width: 260, depth: 160, sofaDepth: 90, chaiseWidth: 90, chaiseSide: 'right', x: 250, y: 150, angle: 0 };
  assert.equal(validChaise(sofa), true);
  assert.equal(validChaise({ ...sofa, chaiseWidth: 270 }), false);
  assert.equal(validChaise({ ...sofa, sofaDepth: 170 }), false);
  assert.equal(validChaise({ ...sofa, chaiseSide: 'bad' }), false);
  const points = furniturePoints(sofa);
  assert.deepEqual(points, [[-130, -80], [130, -80], [130, 80], [40, 80], [40, 10], [-130, 10]]);
  assert.deepEqual(furniturePoints({ ...sofa, chaiseSide: 'left' }), points.map(([x, y]) => [-x, y]));
  const table = { id: 'table', width: 50, depth: 30, x: 190, y: 200, angle: 0 };
  const room = { width: 500, height: 400 };
  const topGap = measurementGuides('table', room, [sofa, table], []).find((g) => g.direction === 'top');
  assert.equal(topGap.distance, 25);
  assert.equal(topGap.end.y, 160);
  const rotated = fitFurniture({ ...sofa, angle: 90, x: 0, y: 0 }, room);
  assert.ok(rotated);
  assert.ok(Math.abs(rotated.x - 80) < 1e-8);
  assert.ok(Math.abs(rotated.y - 130) < 1e-8);
});
