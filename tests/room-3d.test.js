import { test } from 'node:test';
import assert from 'node:assert/strict';
import { furnitureElevation, openingBounds, orbitView, surfaceShade, validFurnitureElevation, validOpeningHeight, wallSections } from '../src/lib/room-3d.js';

test('explicit floor elevations override defaults and stay below the ceiling', () => {
  assert.equal(furnitureElevation('art', 240, 60, 120), 120);
  assert.equal(furnitureElevation('light', 240, 10, 0), 0);
  assert.equal(furnitureElevation('outlet', 240, 8), 25);
  assert.equal(furnitureElevation('light', 300, 10), 290);
  assert.equal(validFurnitureElevation({ height: 60, elevation: 180 }, 240), true);
  assert.equal(validFurnitureElevation({ height: 60, elevation: 181 }, 240), false);
  assert.equal(validFurnitureElevation({ height: 60, elevation: -1 }, 240), false);
  assert.equal(validFurnitureElevation({ height: 60, elevation: NaN }, 240), false);
  assert.equal(validFurnitureElevation({ height: 60 }, 240), true);
});

test('dragging the 3D view rotates continuously and clamps tilt to the slider limits', () => {
  assert.deepEqual(orbitView(-30, 55, 100, 40), { rotation: 10, tilt: 45 });
  assert.deepEqual(orbitView(170, 55, 100, -1000), { rotation: -150, tilt: 75 });
  assert.deepEqual(orbitView(-170, 55, -100, 1000), { rotation: 150, tilt: 25 });
  assert.deepEqual(orbitView(-30, 55, 900, 0), { rotation: -30, tilt: 55 });
});

test('directional shading stays consistent across walls and rotated furniture', () => {
  assert.equal(surfaceShade(-135), '6%');
  assert.equal(surfaceShade(45), '26%');
  assert.ok(Math.abs(parseFloat(surfaceShade(0)) - parseFloat(surfaceShade(360))) < 1e-10);
  assert.ok(parseFloat(surfaceShade(90)) > parseFloat(surfaceShade(180)));
});

test('3D walls leave correctly sized door and window gaps, including overlapping openings', () => {
  assert.deepEqual(wallSections(500, []), [{ offset: 0, width: 500, z: 0, height: 240 }]);
  const sections = wallSections(500, [
    { kind: 'window', offset: 100, width: 150 },
    { kind: 'door', offset: 200, width: 90 }
  ]);
  const solidAt = (x, z) => sections.some((section) => x > section.offset && x < section.offset + section.width && z > section.z && z < section.z + section.height);
  assert.equal(solidAt(50, 100), true);
  assert.equal(solidAt(150, 50), true);
  assert.equal(solidAt(150, 150), false);
  assert.equal(solidAt(225, 50), false);
  assert.equal(solidAt(275, 150), false);
  assert.equal(solidAt(225, 225), true);
  assert.equal(solidAt(350, 150), true);
  assert.deepEqual(wallSections(100, [{ kind: 'door', offset: 0, width: 100 }]), [{ offset: 0, width: 100, z: 210, height: 30 }]);
});

test('custom heights cut separate vertical openings and use the room ceiling', () => {
  const sections = wallSections(200, [
    { kind: 'window', offset: 50, width: 100, height: 40, sillHeight: 60 },
    { kind: 'window', offset: 50, width: 100, height: 70, sillHeight: 150 }
  ], 300);
  const column = sections.filter((section) => section.offset === 50);
  assert.deepEqual(column, [
    { offset: 50, width: 100, z: 0, height: 60 },
    { offset: 50, width: 100, z: 100, height: 50 },
    { offset: 50, width: 100, z: 220, height: 80 }
  ]);
  assert.deepEqual(wallSections(100, [{ kind: 'door', offset: 0, width: 100, height: 250 }], 250), []);
  assert.equal(furnitureElevation('light', 300, 15), 285);
});

test('height validation allows ceiling contact and rejects invalid or overflowing openings', () => {
  assert.deepEqual(openingBounds({ kind: 'window' }), { height: 120, bottom: 90, top: 210 });
  assert.deepEqual(openingBounds({ kind: 'door' }), { height: 210, bottom: 0, top: 210 });
  assert.deepEqual(openingBounds({ kind: 'passage' }), { height: 210, bottom: 0, top: 210 });
  assert.equal(validOpeningHeight({ kind: 'window', height: 130, sillHeight: 120 }, 250), true);
  assert.equal(validOpeningHeight({ kind: 'door', height: 250 }, 250), true);
  for (const opening of [
    { kind: 'window', height: 131, sillHeight: 120 },
    { kind: 'window', height: 100, sillHeight: -1 },
    { kind: 'window', height: 0, sillHeight: 90 },
    { kind: 'door', height: NaN },
    { kind: 'door', height: Infinity },
    { kind: 'door', height: 251 }
  ]) assert.equal(validOpeningHeight(opening, 250), false);
});

test('doorless passage cuts the wall from floor to its configured height', () => {
  const passage = { kind: 'passage', offset: 0, width: 100, height: 205 };
  assert.equal(validOpeningHeight(passage, 240), true);
  assert.deepEqual(wallSections(100, [passage], 240), [{ offset: 0, width: 100, z: 205, height: 35 }]);
});
