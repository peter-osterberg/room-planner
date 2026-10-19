const roomsKey = 'rum-saved-rooms-v1';

/** @typedef {{ id: string, name: string, room: {width: number, height: number}, items: any[], openings: any[] }} RoomPlan */

/** @param {Pick<Storage, 'getItem'>} storage @returns {RoomPlan[]} */
export function readSavedRooms(storage) {
  const raw = storage.getItem(roomsKey);
  const rooms = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(rooms) || rooms.some((plan) => !plan || typeof plan.id !== 'string' || !plan.id || typeof plan.name !== 'string' || !plan.room || !Array.isArray(plan.items) || !Array.isArray(plan.openings))) {
    throw new Error('Sparade rum kunde inte läsas.');
  }
  return rooms;
}

/** Save a separate snapshot; failed reads/writes leave earlier rooms untouched.
 * @param {Pick<Storage, 'getItem' | 'setItem'>} storage @param {RoomPlan} plan
 */
export function saveRoomSnapshot(storage, plan) {
  const rooms = readSavedRooms(storage);
  const snapshot = JSON.parse(JSON.stringify(plan));
  const next = [snapshot, ...rooms.filter((room) => room.id !== plan.id)];
  storage.setItem(roomsKey, JSON.stringify(next));
  return next;
}
