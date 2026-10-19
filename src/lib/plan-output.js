import { halfExtents, measurementGuides } from './geometry.js';

const format = (value) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 }).format(value);
const wallNames = { top: 'Övre vägg', right: 'Höger vägg', bottom: 'Nedre vägg', left: 'Vänster vägg' };

/** Include every object, even when objects overlap in the drawing.
 * @param {import('./room-storage.js').RoomPlan} plan
 */
export function measurementRows(plan) {
  return [...plan.items, ...plan.openings].map((item, index) => {
    const guides = measurementGuides(item.id, plan.room, plan.items, plan.openings);
    const opening = 'wall' in item;
    const point = !opening && item.width === 0 && item.depth === 0;
    const dimensions = opening ? `${format(item.width)} cm bred · ${wallNames[item.wall]}`
      : point ? 'Placeringssymbol'
      : `${format(item.width)} × ${format(item.depth)} cm · ${format(item.angle)}°`;
    const position = opening ? `${format(item.offset)} cm från ${['top', 'bottom'].includes(item.wall) ? 'vänster' : 'övre'} hörn`
      : `Centrum: x ${format(item.x)} · y ${format(item.y)} cm`;
    const distances = [['left', 'V'], ['right', 'H'], ['top', 'U'], ['bottom', 'N']].map(([direction, label]) => {
      const guide = guides.find((entry) => entry.direction === direction);
      return `${label} ${guide ? format(guide.distance) : '–'}`;
    }).join(' · ');
    const parts = item.kind === 'chaise-sofa'
      ? [`Soffdel: ${format(item.width)} × ${format(item.sofaDepth)} cm · ${format(item.angle)}°`,
        `Divan: ${format(item.chaiseWidth)} × ${format(item.depth)} cm (totaldjup)`]
      : [dimensions];
    return { item, number: index + 1, guides, lines: [item.name, ...parts, position, `${distances} cm`] };
  });
}

/** Shared standalone drawing for download, preview and printing.
 * @param {SVGSVGElement} drawing
 * @param {import('./room-storage.js').RoomPlan} plan
 * @param {boolean} [monochrome]
 */
export function createMeasuredSvg(drawing, plan, monochrome = false) {
  const document = drawing.ownerDocument;
  const element = (tag, attributes = {}, text = '') => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
    if (text) node.textContent = text;
    return node;
  };
  const rows = measurementRows(plan);
  const box = drawing.viewBox.baseVal;
  const scale = Math.min(720 / box.width, 650 / box.height);
  const planHeight = box.height * scale;
  const height = Math.max(100 + planHeight, 140 + rows.length * 78);
  const output = /** @type {SVGSVGElement} */ (element('svg', {
    xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 1120 ${height}`, width: 1120, height,
    class: 'plan-output', role: 'group', 'aria-label': `${plan.name} – skiss med alla mått`
  }));
  // Color downloads also become monochrome when printed directly.
  const printRules = `.plan-output{color:#111!important}.plan-output [fill]:not([fill="none"]):not(text):not(tspan){fill:#fff!important}.plan-output [stroke]:not([stroke="none"]):not(text):not(tspan){stroke:#111!important}.plan-output text,.plan-output tspan{fill:#111!important;stroke:none!important}.plan-output [color]{color:#111!important}.plan-output .output-grid{fill:#fff!important}`;
  output.append(element('style', {}, monochrome ? printRules : `@media print{${printRules}}`));
  output.append(element('rect', { width: 1120, height, fill: '#fff' }));
  output.append(element('text', { x: 24, y: 30, 'font-size': 22, 'font-family': 'Arial, sans-serif', fill: '#111' }, plan.name));
  output.append(element('text', { x: 24, y: 53, 'font-size': 12, 'font-family': 'Arial, sans-serif', fill: '#111' },
    `${format(plan.room.width)} × ${format(plan.room.height)} cm · ${format(plan.room.width * plan.room.height / 10000)} m² · Skalenlig planvy`));

  const sketch = /** @type {SVGSVGElement} */ (drawing.cloneNode(true));
  sketch.removeAttribute('class');
  sketch.removeAttribute('style');
  sketch.setAttribute('x', '16');
  sketch.setAttribute('y', '70');
  sketch.setAttribute('width', String(box.width * scale));
  sketch.setAttribute('height', String(planHeight));
  sketch.querySelectorAll('[data-editor-only]').forEach((node) => node.remove());
  sketch.querySelectorAll('[tabindex]').forEach((node) => node.removeAttribute('tabindex'));
  sketch.querySelectorAll('[aria-pressed]').forEach((node) => node.removeAttribute('aria-pressed'));
  sketch.querySelectorAll('[role="button"]').forEach((node) => node.removeAttribute('role'));
  // Normalize editor-dependent sizes so zoom does not change the output.
  const groups = new Map([...sketch.querySelectorAll('[data-item-id]')].map((node) => [node.getAttribute('data-item-id'), node]));
  for (const item of plan.items) {
    const group = groups.get(item.id);
    const label = group?.querySelector('[data-item-label]');
    if (label) {
      const outside = label.hasAttribute('data-outside-label');
      label.setAttribute('font-size', String(outside ? 11 / scale : Math.min(11 / scale, item.width / 7, item.depth / 3)));
      if (outside) label.setAttribute('y', String(item.depth / 2 + 13 / scale));
    }
    const symbol = group?.querySelector('[data-symbol-scale]');
    if (symbol) symbol.setAttribute('transform', `scale(${Number(symbol.getAttribute('data-symbol-scale')) / scale})`);
  }
  output.append(sketch);

  const seen = new Set();
  const annotations = element('g', { 'font-family': 'Arial, sans-serif', 'pointer-events': 'none' });
  sketch.append(annotations);
  for (const row of rows) {
    for (const guide of row.guides) {
      const key = [guide.start, guide.end].map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).sort().join('/');
      if (seen.has(key)) continue;
      seen.add(key);
      const vertical = guide.direction === 'top' || guide.direction === 'bottom';
      annotations.append(element('line', { x1: guide.start.x, y1: guide.start.y, x2: guide.end.x, y2: guide.end.y, stroke: '#397fa2', 'stroke-width': 0.7 / scale, 'stroke-dasharray': `${3 / scale} ${2 / scale}` }));
      const label = element('g', { transform: `translate(${(guide.start.x + guide.end.x) / 2},${(guide.start.y + guide.end.y) / 2}) rotate(${vertical ? -90 : 0}) scale(${1 / scale})` });
      const value = `${format(guide.distance)} cm`;
      const width = Math.max(38, value.length * 5.5 + 8);
      label.append(element('rect', { x: -width / 2, y: -15, width, height: 14, rx: 2, fill: '#fff' }));
      label.append(element('text', { y: -5, 'font-size': 10, 'text-anchor': 'middle', fill: '#286787' }, value));
      annotations.append(label);
    }
    const item = row.item;
    let x, y;
    if ('wall' in item) {
      const center = item.offset + item.width / 2;
      x = ['top', 'bottom'].includes(item.wall) ? center : item.wall === 'left' ? 0 : plan.room.width;
      y = ['left', 'right'].includes(item.wall) ? center : item.wall === 'top' ? 0 : plan.room.height;
    } else {
      const half = halfExtents(item);
      x = item.x - half.x;
      y = item.y - half.y;
    }
    const badge = element('g', { transform: `translate(${x},${y}) scale(${1 / scale})` });
    badge.append(element('circle', { r: 8, fill: '#fff', stroke: '#111', 'stroke-width': 0.8 }));
    badge.append(element('text', { y: 3.5, 'font-size': 10, 'text-anchor': 'middle', fill: '#111' }, String(row.number)));
    annotations.append(badge);
  }

  output.append(element('text', { x: 760, y: 79, 'font-size': 15, 'font-family': 'Arial, sans-serif', 'font-weight': 'bold', fill: '#111' }, 'Objekt och mått (cm)'));
  output.append(element('text', { x: 760, y: 99, 'font-size': 12, 'font-family': 'Arial, sans-serif', fill: '#111' }, 'V / H / U / N = vänster / höger / upp / ned'));
  output.append(element('text', { x: 760, y: 115, 'font-size': 12, 'font-family': 'Arial, sans-serif', fill: '#111' }, 'Avstånd till närmaste vägg eller objekt.'));
  rows.forEach((row, index) => {
    row.lines.forEach((line, lineIndex) => {
      output.append(element('text', { x: 760, y: 140 + index * 78 + lineIndex * 16, 'font-family': 'Arial, sans-serif', 'font-size': lineIndex === 0 ? 14 : 13, 'font-weight': lineIndex === 0 ? 'bold' : 'normal', fill: '#111' }, lineIndex === 0 ? `${row.number}. ${line}` : line));
    });
  });
  output.append(element('text', { x: 24, y: height - 12, 'font-family': 'Arial, sans-serif', 'font-size': 10, fill: '#111' }, 'Alla mått i cm. Utskriften anpassas till sidan. Streck i måttlistan betyder att inget fritt avstånd visas i den riktningen.'));
  return output;
}
