import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measurementRows } from '../src/lib/plan-output.js';

test('output includes dimensions, placement and clearances for every object, including overlaps', () => {
  const plan = {
    id: 'room', name: 'Vardagsrum', room: { width: 500, height: 400 },
    items: [
      { id: 'sofa', name: 'Soffa', width: 220, depth: 90, x: 145, y: 80, angle: 0 },
      { id: 'rug', name: 'Matta', width: 200, depth: 300, x: 145, y: 180, angle: 90 },
      { id: 'outlet', kind: 'outlet', name: 'Eluttag', width: 0, depth: 0, height: 8, elevation: 30, x: 0, y: 100, angle: 0 }
    ],
    openings: [{ id: 'window', name: 'Fönster', kind: 'window', wall: 'top', width: 160, offset: 230 }]
  };
  const rows = measurementRows(plan);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((row) => row.number), [1, 2, 3, 4]);
  assert.match(rows[0].lines[1], /220 × 90 cm/);
  assert.match(rows[1].lines[1], /200 × 300 cm · 90°/);
  assert.deepEqual(rows[2].lines, ['Eluttag']);
  assert.deepEqual(rows[2].guides, []);
  assert.match(rows[3].lines[1], /160 cm bred · Övre vägg/);
  assert.match(rows[3].lines[2], /230 cm från vänster hörn/);
  assert.ok(rows.filter((row) => row.item.kind !== 'outlet').every((row) => row.lines.length === 4));
});

test('printed furniture clearances ignore outlets as measurement obstacles', () => {
  const [table] = measurementRows({ id: 'room', name: 'Rum', room: { width: 500, height: 400 }, openings: [], items: [
    { id: 'table', kind: 'table', name: 'Bord', width: 100, depth: 60, height: 75, x: 100, y: 200, angle: 0 },
    { id: 'outlet', kind: 'outlet', name: 'Eluttag', width: 0, depth: 0, height: 8, x: 300, y: 200, angle: 0 }
  ] });
  assert.equal(table.guides.find((guide) => guide.direction === 'right').distance, 350);
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

test('output includes furniture height without adding extra lines', () => {
  const [row] = measurementRows({ id: 'room', name: 'Rum', room: { width: 500, height: 400 }, openings: [], items: [
    { id: 'table', name: 'Bord', kind: 'table', width: 110, depth: 60, height: 45, x: 250, y: 200, angle: 0 }
  ] });
  assert.match(row.lines[1], /höjd 45 cm/);
  assert.equal(row.lines.length, 4);
});

test('output includes explicit elevation for wall objects', () => {
  const [row] = measurementRows({ id: 'room', name: 'Rum', room: { width: 500, height: 400 }, openings: [], items: [
    { id: 'art', name: 'Tavla', kind: 'art', width: 60, depth: 5, height: 60, elevation: 120, x: 250, y: 2.5, angle: 0 }
  ] });
  assert.match(row.lines[2], /z 120 cm/);
});

test('output includes opening heights and the window bottom above floor', () => {
  const rows = measurementRows({ id: 'room', name: 'Rum', room: { width: 500, height: 400, ceilingHeight: 270 }, items: [], openings: [
    { id: 'window', name: 'Fönster', kind: 'window', wall: 'top', width: 100, offset: 100, height: 140, sillHeight: 80 },
    { id: 'door', name: 'Dörr', kind: 'door', wall: 'bottom', width: 90, offset: 50, height: 220 },
    { id: 'passage', name: 'Dörröppning utan dörr', kind: 'passage', wall: 'left', width: 100, offset: 50, height: 205 }
  ] });
  assert.match(rows[0].lines[1], /höjd 140 cm/);
  assert.match(rows[0].lines[2], /underkant 80 cm över golv/);
  assert.match(rows[1].lines[1], /höjd 220 cm/);
  assert.equal(rows[2].lines[0], 'Dörröppning utan dörr');
  assert.match(rows[2].lines[1], /100 cm bred · Vänster vägg · höjd 205 cm/);
  assert.ok(rows.every((row) => row.lines.length === 4));
});
