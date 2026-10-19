/** @typedef {{past: string[], future: string[]}} PlanHistory */

/** @param {PlanHistory} history @param {string} before @param {string} after */
export function recordChange(history, before, after) {
  if (before === after) return;
  history.past.push(before);
  if (history.past.length > 100) history.past.shift();
  history.future = [];
}

/** @param {PlanHistory} history @param {string} current @param {'undo' | 'redo'} direction */
export function takeHistory(history, current, direction) {
  const source = direction === 'undo' ? history.past : history.future;
  const destination = direction === 'undo' ? history.future : history.past;
  const snapshot = source.pop();
  if (snapshot === undefined) return null;
  destination.push(current);
  return snapshot;
}
