import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measurementRows } from '../src/lib/plan-output.js';

test('output includes dimensions, placement and clearances for every object, including overlaps', () => {
  const plan = {
    id: 'room', name: 'Vardagsrum', room: { width: 500, height: 400 },
    items: [
      { id: 'sofa', name: 'Soffa', width: 220, depth: 90, x: 145, y: 80, angle: 0 },
      { id: 'rug', name: 'Matta', width: 200, depth: 300, x: 145, y: 180, angle: 90 },
      { id: 'outlet', name: 'Eluttag', width: 0, depth: 0, x: 0, y: 100, angle: 0 }
    ],
    openings: [{ id: 'window', name: 'Fönster', kind: 'window', wall: 'top', width: 160, offset: 230 }]
  };
  const rows = measurementRows(plan);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((row) => row.number), [1, 2, 3, 4]);
  assert.match(rows[0].lines[1], /220 × 90 cm/);
  assert.match(rows[1].lines[1], /200 × 300 cm · 90°/);
  assert.match(rows[2].lines[1], /Placeringssymbol/);
  assert.match(rows[2].lines[2], /x 0 · y 100 cm/);
  assert.match(rows[3].lines[1], /160 cm bred · Övre vägg/);
  assert.match(rows[3].lines[2], /230 cm från vänster hörn/);
  assert.ok(rows.every((row) => row.lines.length === 4));
});

test('chaise sofa output includes both independently sized parts', () => {
  const plan = { id: 'room', name: 'Rum', room: { width: 500, height: 400 }, openings: [], items: [
    { id: 'chaise', name: 'Divansoffa', kind: 'chaise-sofa', width: 280, depth: 170, sofaDepth: 95, chaiseWidth: 100, chaiseSide: 'left', x: 250, y: 200, angle: 90 }
  ] };
  const [row] = measurementRows(plan);
  assert.match(row.lines[1], /Soffdel: 280 × 95 cm · 90°/);
  assert.match(row.lines[2], /Divan: 100 × 170 cm \(totaldjup\)/);
  assert.equal(row.lines.length, 5);
});
