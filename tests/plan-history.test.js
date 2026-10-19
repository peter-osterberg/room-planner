import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordChange, takeHistory } from '../src/lib/plan-history.js';

test('undo and redo restore complete plans and discard redo after a new edit', () => {
  const history = { past: [], future: [] };
  const initial = JSON.stringify({ room: { width: 500 }, items: [] });
  const added = JSON.stringify({ room: { width: 500 }, items: [{ id: 'art', elevation: 100 }] });
  const moved = JSON.stringify({ room: { width: 500 }, items: [{ id: 'art', elevation: 120 }] });
  assert.equal(takeHistory(history, initial, 'undo'), null);
  recordChange(history, initial, initial);
  assert.equal(history.past.length, 0);
  recordChange(history, initial, added);
  recordChange(history, added, moved);
  assert.equal(takeHistory(history, moved, 'undo'), added);
  assert.equal(takeHistory(history, added, 'undo'), initial);
  assert.equal(takeHistory(history, initial, 'redo'), added);
  recordChange(history, added, moved);
  assert.equal(takeHistory(history, moved, 'redo'), null);
});

test('history retains the most recent 100 changes', () => {
  const history = { past: [], future: [] };
  for (let i = 0; i < 105; i++) recordChange(history, String(i), String(i + 1));
  assert.equal(history.past.length, 100);
  assert.equal(history.past[0], '5');
});
