import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSavedRooms, saveRoomSnapshot } from '../src/lib/room-storage.js';

test('room snapshots preserve earlier rooms, update by id, and survive storage round trips', () => {
  let value = null;
  const storage = { getItem: () => value, setItem: (_key, next) => { value = next; } };
  const first = { id: 'first', name: 'Vardagsrum', room: { width: 500, height: 400 }, items: [{ name: 'Soffa' }], openings: [] };
  assert.deepEqual(readSavedRooms(storage), []);
  const saved = saveRoomSnapshot(storage, first);
  first.items[0].name = 'Ändrad';
  assert.equal(saved[0].items[0].name, 'Soffa');
  saveRoomSnapshot(storage, { ...first, id: 'second', name: 'Nytt rum', items: [] });
  assert.equal(readSavedRooms(storage).length, 2);
  saveRoomSnapshot(storage, { ...first, name: 'Uppdaterat vardagsrum' });
  assert.deepEqual(readSavedRooms(storage).map((plan) => plan.id), ['first', 'second']);
  assert.equal(readSavedRooms(storage)[0].name, 'Uppdaterat vardagsrum');
  value = '{trasig data';
  assert.throws(() => saveRoomSnapshot(storage, first));
  assert.equal(value, '{trasig data');
  const fullStorage = { getItem: () => '[]', setItem: () => { throw new Error('Fullt'); } };
  assert.throws(() => saveRoomSnapshot(fullStorage, first), /Fullt/);
});
