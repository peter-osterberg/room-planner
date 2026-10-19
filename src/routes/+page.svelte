<script>
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { clamp, fitFurniture, furniturePoints, validChaise, measurementGuides, snapFurniture, validNumber, wallLength } from '$lib/geometry.js';
  import { readSavedRooms, saveRoomSnapshot } from '$lib/room-storage.js';
  import { createMeasuredSvg } from '$lib/plan-output.js';

  /** @typedef {{id: string, name: string, kind: string, width: number, depth: number, x: number, y: number, angle: number, color: string, sofaDepth?: number, chaiseWidth?: number, chaiseSide?: string}} Item */
  /** @typedef {{id: string, name: string, kind: string, wall: string, offset: number, width: number, hinge?: 'left' | 'right', swing?: 'inward' | 'outward'}} Opening */
  const colors = ['#aec1af', '#dac2aa', '#b8c5d2', '#c8bbce', '#d5ceba', '#ead6bd', '#e2a598', '#e7c979', '#94bdb8', '#9aa6d1', '#d5a9c0', '#a8a8a2', '#f5eee2', '#efb77e', '#c98672', '#b46f88', '#b9ca7e', '#729b83', '#639b9f', '#7383b1', '#9180ab', '#a48167', '#727b83', '#373d43'];
  const catalog = [
    { name: 'Soffa', kind: 'sofa', width: 220, depth: 90, color: colors[0] },
    { name: 'Soffa med divan', kind: 'chaise-sofa', width: 260, depth: 160, sofaDepth: 90, chaiseWidth: 90, chaiseSide: 'right', color: colors[0] },
    { name: 'Fåtölj', kind: 'chair', width: 80, depth: 80, color: colors[1] },
    { name: 'Soffbord', kind: 'table', width: 110, depth: 60, color: colors[1] },
    { name: 'Säng', kind: 'bed', width: 160, depth: 200, color: colors[2] },
    { name: 'Förvaring', kind: 'storage', width: 120, depth: 40, color: colors[4] },
    { name: 'Matta', kind: 'rug', width: 200, depth: 300, color: colors[4] },
    { name: 'TV', kind: 'tv', width: 120, depth: 10, color: colors[23] },
    { name: 'Tavla', kind: 'art', width: 60, depth: 5, color: colors[5] },
    { name: 'Krukväxt', kind: 'plant-small', width: 25, depth: 25, color: colors[0] },
    { name: 'Golvväxt', kind: 'plant-floor', width: 50, depth: 50, color: colors[17] },
    { name: 'Stor golvväxt', kind: 'plant-large', width: 80, depth: 80, color: colors[16] },
    { name: 'Egen möbel', kind: 'custom', width: 100, depth: 60, color: colors[3] },
    { name: 'Fönsterbräde', kind: 'sill', width: 120, depth: 20, color: colors[5] },
    { name: 'Eluttag', kind: 'outlet', width: 0, depth: 0, color: colors[2] },
    { name: 'Lampa', kind: 'light', width: 0, depth: 0, color: colors[1] }
  ];
  const isElectrical = (kind) => kind === 'outlet' || kind === 'light';
  const isWallItem = (kind) => kind === 'art' || kind === 'tv' || kind === 'sill';
  const isPlant = (kind) => kind.startsWith('plant-');
  const outsideLabel = (kind) => isWallItem(kind) || isPlant(kind);
  const layer = (kind) => kind === 'rug' ? 0 : isElectrical(kind) || isWallItem(kind) ? 2 : 1;
  const validColor = (color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
  const ink = (color) => {
    const rgb = parseInt(color.slice(1), 16);
    return ((rgb >> 16) * 299 + ((rgb >> 8) & 255) * 587 + (rgb & 255) * 114) / 1000 > 145 ? '#3d4d3e' : '#fff';
  };
  const walls = [{ value: 'top', name: 'Övre vägg' }, { value: 'right', name: 'Höger vägg' }, { value: 'bottom', name: 'Nedre vägg' }, { value: 'left', name: 'Vänster vägg' }];
  let room = $state({ width: 500, height: 400 });
  let roomId = $state('');
  let roomName = $state('Min rumsplan');
  /** @type {import('$lib/room-storage.js').RoomPlan[]} */
  let savedRooms = $state([]);
  let roomWidth = $state(500);
  let roomHeight = $state(400);
  /** @type {Item[]} */
  let items = $state([
    { ...catalog[0], id: 'sofa', x: 145, y: 80, angle: 0 },
    { ...catalog[3], id: 'table', x: 145, y: 190, angle: 0 },
    { ...catalog[2], id: 'chair', x: 380, y: 260, angle: 0 },
    { ...catalog[5], id: 'storage', x: 475, y: 100, angle: 90 }
  ]);
  /** @type {Opening[]} */
  let openings = $state([
    { id: 'window', kind: 'window', name: 'Fönster', wall: 'top', offset: 230, width: 160 },
    { id: 'door', kind: 'door', name: 'Dörr', wall: 'bottom', offset: 70, width: 90 }
  ]);
  let selectedId = $state('sofa');
  let selected = $derived(items.find((item) => item.id === selectedId));
  let layeredItems = $derived([...items].sort((a, b) => layer(a.kind) - layer(b.kind)));
  let opening = $derived(openings.find((item) => item.id === selectedId));
  let guides = $derived(measurementGuides(selectedId, room, items, openings));
  let planPadding = $derived(Math.max(60, ...openings.filter((item) => item.kind === 'door' && item.swing === 'outward').map((item) => item.width + 15)));
  let drawingWidth = $state(700);
  let drawingHeight = $state(500);
  let rulerScale = $derived(Math.max((room.width + 2 * planPadding) / (drawingWidth || 700), (room.height + 2 * planPadding + 10) / (drawingHeight || 500)));
  let tab = $state('furniture');
  let zoom = $state(100);
  let grid = $state(true);
  let snap = $state(false);
  let message = $state('');
  let saveState = $state('Sparas i din webbläsare');
  let ready = $state(false);
  /** @type {SVGSVGElement} */
  let drawing;
  /** @type {HTMLDialogElement} */
  let printDialog;
  /** @type {HTMLDivElement} */
  let printPreview;
  /** @type {HTMLDivElement} */
  let printArea;
  let enlargedPreview = $state(false);
  /** @type {{ id: string, x: number, y: number, startX: number, startY: number, offset: number } | null} */
  let drag = null;
  const storageKey = 'rum-plan-v1';
  const number = (value) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 }).format(value);

  function restorePlan(data) {
    data = JSON.parse(JSON.stringify(data));
    if (!validNumber(data.room?.width, 50) || !validNumber(data.room?.height, 50) || !Array.isArray(data.items) || !Array.isArray(data.openings)) throw new Error();
    const ids = [];
    for (const item of [...data.items, ...data.openings]) {
      if (typeof item.id !== 'string' || ids.includes(item.id) || typeof item.name !== 'string') throw new Error();
      ids.push(item.id);
    }
    for (const item of data.items) {
      const minimum = isElectrical(item.kind) ? 0 : 1;
      if (!validNumber(item.width, minimum) || !validNumber(item.depth, minimum) || !validNumber(item.angle, -360, 360) || !validNumber(item.x, 0) || !validNumber(item.y, 0) || !catalog.some((entry) => entry.kind === item.kind) || !validColor(item.color) || !validChaise(item) || !fitFurniture(item, data.room)) throw new Error();
    }
    for (const item of data.openings) {
      if (!['window', 'door'].includes(item.kind) || !walls.some((wall) => wall.value === item.wall) || !validNumber(item.width, 1) || !validNumber(item.offset, 0) || item.offset + item.width > wallLength(item.wall, data.room)) throw new Error();
      if (item.hinge !== undefined && !['left', 'right'].includes(item.hinge) || item.swing !== undefined && !['inward', 'outward'].includes(item.swing)) throw new Error();
    }
    room = data.room;
    items = data.items.map((item) => fitFurniture(item, room));
    openings = data.openings;
    roomId = typeof data.id === 'string' && data.id ? data.id : crypto.randomUUID();
    roomName = typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 60) : 'Min rumsplan';
    roomWidth = room.width;
    roomHeight = room.height;
    selectedId = '';
    drag = null;
    zoom = 100;
  }

  function currentPlan() {
    return { id: roomId, name: roomName.trim() || 'Nytt rum', room, items, openings };
  }

  function saveRoom(announce = true) {
    try {
      savedRooms = saveRoomSnapshot(localStorage, currentPlan());
      localStorage.setItem(storageKey, JSON.stringify(currentPlan()));
      if (announce) message = `Rummet ”${roomName.trim() || 'Nytt rum'}” är sparat i din webbläsare.`;
      return true;
    } catch {
      message = 'Kunde inte spara rummet. Det nuvarande rummet behålls. Kontrollera webbläsarens lagringsutrymme.';
      return false;
    }
  }

  function newRoom() {
    if (!saveRoom(false)) return;
    const next = { id: crypto.randomUUID(), name: 'Nytt rum', room: { width: 500, height: 400 }, items: [], openings: [] };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      restorePlan(next);
      message = 'Ett nytt, tomt rum är klart. Det förra finns under Öppna sparat rum.';
    } catch {
      message = 'Kunde inte börja ett nytt rum. Det nuvarande rummet behålls.';
    }
  }

  function openRoom(id) {
    if (!id || id === roomId) return;
    const plan = savedRooms.find((entry) => entry.id === id);
    if (!plan || !saveRoom(false)) return;
    try {
      restorePlan(plan);
      localStorage.setItem(storageKey, JSON.stringify(currentPlan()));
      message = '';
    } catch {
      message = 'Det sparade rummet kunde inte öppnas. Din nuvarande ritning har sparats.';
    }
  }

  onMount(() => {
    roomId = crypto.randomUUID();
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) restorePlan(JSON.parse(saved));
    } catch {
      message = 'Din sparade ritning kunde inte läsas. Ett exempelrum visas.';
    }
    try { savedRooms = readSavedRooms(localStorage); }
    catch { message = 'Listan med sparade rum kunde inte läsas. Din aktuella ritning finns kvar.'; }
    ready = true;
  });

  $effect(() => {
    const data = JSON.stringify(currentPlan());
    if (!ready) return;
    const timeout = setTimeout(() => {
      try { localStorage.setItem(storageKey, data); saveState = 'Sparat i din webbläsare'; }
      catch { saveState = 'Kunde inte spara i webbläsaren'; }
    }, 350);
    return () => clearTimeout(timeout);
  });

  function resizeRoom(event) {
    event.preventDefault();
    if (!validNumber(roomWidth, 50) || !validNumber(roomHeight, 50)) { message = 'Ange rumsmått mellan 50 och 5 000 cm.'; return; }
    const next = { width: roomWidth, height: roomHeight };
    if (items.some((item) => !fitFurniture(item, next)) || openings.some((item) => item.width > wallLength(item.wall, next))) {
      message = 'Rummet är för litet för något objekt. Ändra eller ta bort objektet först.'; return;
    }
    room = next;
    items = items.map((item) => ({ ...item, ...fitFurniture(item, room) }));
    openings = openings.map((item) => ({ ...item, offset: Math.min(item.offset, wallLength(item.wall, room) - item.width) }));
    message = '';
  }

  function addFurniture(preset) {
    const item = { ...preset, id: crypto.randomUUID(), x: preset.kind === 'outlet' ? 0 : room.width / 2, y: isWallItem(preset.kind) ? preset.depth / 2 : room.height / 2, angle: 0 };
    const fitted = fitFurniture(item, room);
    if (!fitted) { message = 'Möbeln får inte plats i rummet med dessa mått.'; return; }
    items.push({ ...item, ...fitted });
    selectedId = item.id;
    message = '';
  }

  function addOpening(kind) {
    const width = Math.min(kind === 'door' ? 90 : 120, room.width);
    const item = { id: crypto.randomUUID(), kind, name: kind === 'door' ? 'Dörr' : 'Fönster', wall: 'top', width, offset: Math.round((room.width - width) / 2) };
    openings.push(item);
    selectedId = item.id;
    message = '';
  }

  function updateFurniture(patch) {
    if (!selected) return;
    const next = { ...selected, ...patch };
    if (!validChaise(next)) { message = 'Divanens bredd får inte överstiga soffans bredd och dess totaldjup måste vara minst soffdelens djup.'; return; }
    const minimum = isElectrical(next.kind) ? 0 : 1;
    if (!validNumber(next.width, minimum) || !validNumber(next.depth, minimum) || !validNumber(next.angle, -360, 360) || !validNumber(next.x, 0) || !validNumber(next.y, 0)) { message = 'Kontrollera måtten. Använd positiva tal och en vinkel mellan −360 och 360°.'; return; }
    const fitted = fitFurniture(next, room);
    if (!fitted) { message = 'Möbeln får inte plats med dessa mått och denna rotation.'; return; }
    Object.assign(selected, next, fitted);
    message = '';
  }

  function updateOpening(patch) {
    if (!opening) return;
    const next = { ...opening, ...patch };
    const length = wallLength(next.wall, room);
    if (!validNumber(next.width, 1, length) || !validNumber(next.offset, 0, length - next.width)) { message = 'Öppningen måste rymmas på väggen. Kontrollera bredd och avstånd.'; return; }
    Object.assign(opening, next);
    message = '';
  }

  function inputNumber(event, field, isOpening = false) {
    const input = event.currentTarget;
    if (field === 'angle' && input.value === '' && !input.validity.badInput) input.value = '0';
    if (!input.reportValidity()) return;
    if (isOpening) updateOpening({ [field]: input.valueAsNumber });
    else updateFurniture({ [field]: input.valueAsNumber });
    const item = isOpening ? opening : selected;
    input.value = String(item[field]);
  }

  function removeSelected() {
    items = items.filter((item) => item.id !== selectedId);
    openings = openings.filter((item) => item.id !== selectedId);
    selectedId = '';
    message = '';
  }

  function duplicateSelected() {
    if (!selected) return;
    const copy = { ...selected, id: crypto.randomUUID(), name: `${selected.name} kopia`, x: selected.x + 20, y: selected.y + 20 };
    items.push({ ...copy, ...fitFurniture(copy, room) });
    selectedId = copy.id;
  }

  function point(event) {
    const matrix = drawing.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
  }

  function startDrag(event, item) {
    if (event.button !== 0) return;
    const p = point(event);
    if (!p) return;
    event.preventDefault();
    selectedId = item.id;
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag = { id: item.id, x: p.x, y: p.y, startX: item.x ?? 0, startY: item.y ?? 0, offset: item.offset ?? 0 };
  }

  function moveDrag(event) {
    if (!drag) return;
    const p = point(event);
    if (!p) return;
    const step = snap && !event.altKey ? 5 : 1;
    const round = (n) => Math.round(n / step) * step;
    const item = items.find((entry) => entry.id === drag.id);
    if (item) {
      const moved = { ...item, x: round(drag.startX + p.x - drag.x), y: round(drag.startY + p.y - drag.y) };
      Object.assign(item, event.altKey || isElectrical(item.kind) ? fitFurniture(moved, room) : snapFurniture(moved, room, items, 6 * rulerScale));
    }
    const aperture = openings.find((entry) => entry.id === drag.id);
    if (aperture) {
      const horizontal = ['top', 'bottom'].includes(aperture.wall);
      aperture.offset = clamp(round(drag.offset + (horizontal ? p.x - drag.x : p.y - drag.y)), 0, wallLength(aperture.wall, room) - aperture.width);
    }
  }

  function keyboard(event) {
    if (event.target instanceof HTMLElement && (event.target.matches('input, select, textarea, button') || event.target.isContentEditable)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') { selectedId = ''; drag = null; }
    if (!selectedId) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); }
    if (event.key.toLowerCase() === 'r' && selected) { event.preventDefault(); updateFurniture({ angle: (selected.angle + 90) % 360 }); }
    const step = event.shiftKey ? 10 : 1;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (delta) {
      event.preventDefault();
      if (selected) updateFurniture({ x: Math.max(0, selected.x + delta[0]), y: Math.max(0, selected.y + delta[1]) });
      if (opening) updateOpening({ offset: clamp(opening.offset + (['top', 'bottom'].includes(opening.wall) ? delta[0] : delta[1]), 0, wallLength(opening.wall, room) - opening.width) });
    }
  }

  function openingTransform(item) {
    if (item.wall === 'top') return `translate(${item.offset},0)`;
    if (item.wall === 'right') return `translate(${room.width},${item.offset}) rotate(90)`;
    if (item.wall === 'bottom') return `translate(${item.offset + item.width},${room.height}) rotate(180)`;
    return `translate(0,${item.offset + item.width}) rotate(-90)`;
  }

  function exportDrawing(monochrome = false) {
    const svg = createMeasuredSvg(drawing, currentPlan(), monochrome);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'min-rumsplan.svg';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function previewPrint() {
    printPreview.replaceChildren(createMeasuredSvg(drawing, currentPlan(), true));
    enlargedPreview = false;
    printDialog.showModal();
  }

  function preparePrint() {
    printArea.replaceChildren(createMeasuredSvg(drawing, currentPlan(), true));
  }
</script>

<svelte:head>
  <title>rum. — Ditt rum, i rätt skala</title>
  <meta name="description" content="Planera ditt rum i 2D. Ange mått i centimeter, placera dörrar och fönster och möblera i rätt skala." />
</svelte:head>
<svelte:window onpointermove={moveDrag} onpointerup={() => drag = null} onpointercancel={() => drag = null} onblur={() => drag = null} onkeydown={keyboard} onbeforeprint={preparePrint} />

{#snippet icon(kind, size = 24)}
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if kind === 'sofa' || kind === 'chaise-sofa'}<path d="M5 11V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M5 17v3m14-3v3"/><path d="M5 10a2 2 0 0 0-3 2v5h20v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-1-2Z"/>
    {:else if kind === 'chair'}<path d="M6 12V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6M6 18v3m12-3v3M3 10v8h18v-8M3 14h18"/>
    {:else if kind === 'table'}<path d="M3 7h18v8H3zM6 15v5m12-5v5"/>
    {:else if kind === 'bed'}<path d="M4 19v2m16-2v2M4 10V4h16v6M3 10h18v9H3zM7 7h3m4 0h3"/>
    {:else if kind === 'storage'}<path d="M4 3h16v17H4zM4 11h16M10 7h4m-4 8h4M6 20v2m12-2v2"/>
    {:else if kind === 'rug'}<rect x="5" y="4" width="14" height="16" rx="1"/><path d="M8 7h8v10H8zM2 5h3M2 9h3M2 13h3M2 17h3m14-12h3m-3 4h3m-3 4h3m-3 4h3"/>
    {:else if kind === 'art'}<path d="M3 4h18v16H3zM6 7h12v10H6zM6 17l4-5 3 3 2-2 3 4"/><circle cx="15" cy="10" r="1"/>
    {:else if kind === 'tv'}<rect x="2" y="4" width="20" height="14" rx="2"/><path d="M12 18v3m-5 0h10"/>
    {:else if kind === 'sill'}<path d="M5 3h14v13H5zM12 3v13M2 16h20v4H2z"/>
    {:else if isPlant(kind)}<path d="M8 16h8l-1 6H9zM12 16V8M12 12C5 12 4 8 4 5c5 0 8 2 8 7Zm0-4c0-4 3-6 8-6 0 5-3 8-8 8"/>
    {:else if kind === 'outlet'}<circle cx="12" cy="12" r="8"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M12 4v3m0 10v3"/>
    {:else if kind === 'light'}<circle cx="12" cy="12" r="6"/><path d="m8 8 8 8m0-8-8 8M12 1v2m0 18v2M1 12h2m18 0h2"/>
    {:else if kind === 'door'}<path d="M5 21V3h14v18M5 3l10 3v15H5m7-8h.01"/>
    {:else if kind === 'window'}<path d="M4 4h16v16H4zM12 4v16M4 12h16M2 21h20"/>
    {:else if kind === 'rotate'}<path d="M3 9a9 9 0 1 1 1 9M3 3v6h6"/>
    {:else if kind === 'copy'}<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v12h5"/>
    {:else if kind === 'trash'}<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>
    {:else if kind === 'download'}<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>
    {:else if kind === 'print'}<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6zM17 11h1"/>
    {:else if kind === 'grid'}<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>
    {:else if kind === 'fit'}<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><rect x="8" y="8" width="8" height="8"/>
    {:else if kind === 'plus'}<path d="M12 5v14M5 12h14"/>
    {:else}<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M8 5v4m4-4v2m4-2v4"/>{/if}
  </svg>
{/snippet}

<div class="app">
  <header class="header">
    <a href={resolve('/')} class="brand" aria-label="rum. startsida"><span class="brand-mark">⌑</span>rum<span class="brand-dot">.</span></a>
    <div class="header-divider"></div>
    <span class="project-title">{roomName || 'Nytt rum'} <span class="project-tag">2D</span></span>
    <div class="header-actions"><span class="save-status"><i></i>{saveState}</span><button class="export-button" onclick={previewPrint}>{@render icon('print', 16)}<span>Utskriftsvy</span></button><button class="export-button" onclick={() => exportDrawing()}>{@render icon('download', 16)}<span>Exportera SVG</span></button></div>
  </header>

  <div class="workspace">
    <aside class="sidebar left-sidebar" aria-label="Rum och möbelbibliotek">
      <div class="intro"><span class="eyebrow">PLATS FÖR DINA IDÉER</span><h1>Ditt rum.<br />Dina möjligheter.</h1><p>Prova dig fram. Allt i rätt skala.</p></div>
      <section class="room-section">
        <div class="room-manager">
          <label>Rumsnamn<input aria-label="Rumsnamn" maxlength="60" bind:value={roomName} /></label>
          <div class="two-columns"><button class="apply-button" onclick={() => saveRoom()}>Spara rum</button><button class="apply-button" onclick={newRoom}>Nytt rum</button></div>
          {#if savedRooms.length}
            <label class="offset-label">Öppna sparat rum<select value={savedRooms.some((plan) => plan.id === roomId) ? roomId : ''} onchange={(event) => openRoom(event.currentTarget.value)}><option value="" disabled>Välj rum…</option>{#each savedRooms as plan (plan.id)}<option value={plan.id}>{plan.name}</option>{/each}</select></label>
          {/if}
          <p class="library-note">Nytt rum sparar ditt nuvarande rum först. Rummen sparas i denna webbläsare.</p>
        </div>
        <div class="section-heading"><h2>Rummets mått</h2><span class="unit-pill">cm</span></div>
        <form onsubmit={resizeRoom}>
          <div class="two-columns"><label>Bredd<div class="input-unit"><input aria-label="Rummets bredd" type="number" min="50" max="5000" step="1" required bind:value={roomWidth} /><span>cm</span></div></label><label>Djup<div class="input-unit"><input aria-label="Rummets djup" type="number" min="50" max="5000" step="1" required bind:value={roomHeight} /><span>cm</span></div></label></div>
          <button class="apply-button" type="submit">Uppdatera rum <span>↗</span></button>
        </form>
      </section>
      <section class="library">
        <div class="section-heading"><h2>Lägg till i rummet</h2><span class="small-plus">+</span></div>
        <div class="tabs" role="tablist" aria-label="Objekttyp"><button role="tab" aria-selected={tab === 'furniture'} aria-controls="furniture-panel" id="furniture-tab" onclick={() => tab = 'furniture'}>Möbler</button><button role="tab" aria-selected={tab === 'openings'} aria-controls="openings-panel" id="openings-tab" onclick={() => tab = 'openings'}>Dörrar & fönster</button><button role="tab" aria-selected={tab === 'electrical'} aria-controls="electrical-panel" id="electrical-tab" onclick={() => tab = 'electrical'}>El & ljus</button></div>
        {#if tab !== 'openings'}
          <div class="catalog" id={tab === 'electrical' ? 'electrical-panel' : 'furniture-panel'} role="tabpanel" aria-labelledby={tab === 'electrical' ? 'electrical-tab' : 'furniture-tab'}>
            {#each catalog.filter((preset) => preset.kind !== 'sill' && isElectrical(preset.kind) === (tab === 'electrical')) as preset (preset.kind)}
              <button class="catalog-card" onclick={() => addFurniture(preset)}><span class="catalog-icon">{@render icon(preset.kind, 31)}</span><span class="catalog-name">{preset.name}</span><span class="catalog-size">{isElectrical(preset.kind) ? 'Placeringssymbol' : `${preset.width} × ${preset.depth} cm`}</span><span class="card-plus">+</span></button>
            {/each}
          </div>
        {:else}
          <div class="catalog" id="openings-panel" role="tabpanel" aria-labelledby="openings-tab">
            {#each ['door', 'window'] as kind (kind)}<button class="catalog-card" onclick={() => addOpening(kind)}><span class="catalog-icon">{@render icon(kind, 31)}</span><span class="catalog-name">{kind === 'door' ? 'Dörr' : 'Fönster'}</span><span class="catalog-size">{kind === 'door' ? '90' : '120'} cm bred</span><span class="card-plus">+</span></button>{/each}
            {#each catalog.filter((preset) => preset.kind === 'sill') as preset (preset.kind)}
              <button class="catalog-card" onclick={() => addFurniture(preset)}><span class="catalog-icon">{@render icon(preset.kind, 31)}</span><span class="catalog-name">{preset.name}</span><span class="catalog-size">{preset.width} × {preset.depth} cm</span><span class="card-plus">+</span></button>
            {/each}
          </div>
          <p class="library-note">För dörrar och fönster: välj vägg och ange avståndet från hörnet. Fönsterbräden dras på plats och kan roteras som möbler.</p>
        {/if}
        {#if tab === 'electrical'}<p class="library-note">Placera med exakta cm-mått eller dra symbolen. Eluttag kan placeras direkt på väggen. Symbolerna visas förstorade.</p>{/if}
        <p class="library-note">Klicka för att lägga till. Du kan ändra alla mått efteråt.</p>
      </section>
      <div class="scale-note">{@render icon('custom', 21)}<div><strong>Små mått. Stora möjligheter.</strong><p>Alla mått anges i centimeter.</p></div></div>
    </aside>

    <main class="canvas-panel">
      <div class="canvas-heading"><div><h2>{roomName || 'Nytt rum'} <span>Planvy</span></h2><p>{number(room.width)} × {number(room.height)} cm <span>·</span> {number(room.width * room.height / 10000)} m²</p></div><span class="scale-badge"><i></i>Skalenlig vy</span></div>
      {#if message}<div class="message" role="status">{message}<button aria-label="Stäng meddelande" onclick={() => message = ''}>×</button></div>{/if}
      <div class="drawing-scroll">
        <div class="drawing-wrap" bind:clientWidth={drawingWidth} bind:clientHeight={drawingHeight} style:width={`${zoom}%`} style:--zoom={zoom / 100}>
          <svg {@attach (element) => { drawing = element; }} class="floorplan" viewBox={`${-planPadding} ${-planPadding - 5} ${room.width + 2 * planPadding} ${room.height + 2 * planPadding + 10}`} role="group" aria-label="Skalenlig rumsplan. Välj ett objekt och flytta med piltangenter eller dra. R roterar möbler.">
            <defs><pattern id="small-grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#dce1d9" stroke-width="0.45"/></pattern><pattern id="large-grid" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="url(#small-grid)"/><path d="M50 0H0V50" fill="none" stroke="#cbd3c6" stroke-width="0.65"/></pattern></defs>
            <rect x={-planPadding} y={-planPadding - 5} width={room.width + 2 * planPadding} height={room.height + 2 * planPadding + 10} fill="#f6f7f2" />
            <rect class="output-grid" width={room.width} height={room.height} fill={grid ? 'url(#large-grid)' : '#fbfcf8'} />
            <g stroke="#9aa69a" stroke-width="0.8" fill="none"><path d={`M0 -18V-40M${room.width} -18V-40M0 -31H${room.width}M-18 0H-40M-18 ${room.height}H-40M-31 0V${room.height}`} /><path d={`M-3 -34L3 -28M${room.width - 3} -34L${room.width + 3} -28M-34 -3L-28 3M-34 ${room.height - 3}L-28 ${room.height + 3}`}/></g>
            <g fill="#657565" font-family="Arial, sans-serif" font-size="11" text-anchor="middle"><rect x={room.width / 2 - 36} y="-40" width="72" height="18" fill="#f6f7f2"/><text x={room.width / 2} y="-27">{number(room.width)} cm</text><g transform={`translate(-31,${room.height / 2}) rotate(-90)`}><rect x="-36" y="-10" width="72" height="18" fill="#f6f7f2"/><text y="4">{number(room.height)} cm</text></g></g>
            <rect width={room.width} height={room.height} fill="none" stroke="#4c5b4e" stroke-width="6" />
            {#each layeredItems as item (item.id)}
              <g data-item-id={item.id} transform={`translate(${item.x},${item.y}) rotate(${item.angle})`} role="button" tabindex="0" aria-label={isElectrical(item.kind) ? `${item.name}, position ${number(item.x)}, ${number(item.y)} centimeter` : `${item.name}, ${item.width} gånger ${item.depth} centimeter, ${item.angle} grader`} aria-pressed={selectedId === item.id} onpointerdown={(event) => startDrag(event, item)} onclick={() => selectedId = item.id} onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectedId = item.id; } }} style="cursor: grab; touch-action: none; outline: none;">
                {#if isElectrical(item.kind)}
                  <g data-symbol-scale={item.kind === 'outlet' ? 0.7 : 1} transform={`scale(${rulerScale * (item.kind === 'outlet' ? 0.7 : 1)})`} color={ink(item.color)}>
                    <circle r="15" fill={item.color} stroke={selectedId === item.id ? '#3f7259' : '#7b8777'} stroke-width={selectedId === item.id ? 2 : 1} />
                    <g transform="translate(-12,-12)">{@render icon(item.kind, 24)}</g>
                    <text y="28" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#3d4d3e" stroke="#fbfcf8" stroke-width="3" paint-order="stroke">{item.name}</text>
                  </g>
                {:else}
                {#if item.kind === 'chaise-sofa'}
                  <polygon points={furniturePoints(item).map((point) => point.join(',')).join(' ')} fill={item.color} stroke={selectedId === item.id ? '#3f7259' : '#7b8777'} stroke-width={selectedId === item.id ? 1.8 : 1}/>
                  <path d={`M${item.chaiseSide === 'left' ? -item.width / 2 : item.width / 2 - item.chaiseWidth} ${-item.depth / 2 + item.sofaDepth}h${item.chaiseWidth}`} fill="none" stroke="#718c72" stroke-width="1"/>
                {:else}
                <rect x={-item.width / 2} y={-item.depth / 2} width={item.width} height={item.depth} rx={isPlant(item.kind) ? Math.min(item.width, item.depth) / 2 : 2} fill={item.color} stroke={selectedId === item.id ? '#3f7259' : '#7b8777'} stroke-width={selectedId === item.id ? 1.8 : 1} />
                {/if}
                {#if isPlant(item.kind)}
                  <g transform={`scale(${item.width / 100},${item.depth / 100})`}>
                    {#each [0, 90, 180, 270] as angle (angle)}<ellipse cx="0" cy="-20" rx="12" ry="24" transform={`rotate(${angle})`} fill={ink(item.color)} opacity="0.22"/>{/each}
                    <circle r="7" fill={ink(item.color)} opacity="0.3"/>
                  </g>
                {:else if (item.kind === 'sofa' || item.kind === 'chair') && item.width >= 30 && item.depth >= 35}
                  <rect x={-item.width / 2 + 9} y={-item.depth / 2 + 9} width={Math.max(1, item.width - 18)} height={Math.max(1, item.depth - 18)} rx="3" fill="none" stroke="#718c72" stroke-width="1" opacity="0.55"/>
                  <path d={`M${-item.width / 2 + 9} ${-item.depth / 2 + 21}H${item.width / 2 - 9}`} stroke="#718c72" stroke-width="1" opacity="0.55"/>
                  {#if item.kind === 'sofa'}<path d={`M${-item.width / 6} ${-item.depth / 2 + 21}V${item.depth / 2 - 9}M${item.width / 6} ${-item.depth / 2 + 21}V${item.depth / 2 - 9}`} stroke="#718c72" stroke-width="1" opacity="0.45"/>{/if}
                {:else if item.kind === 'bed' && item.width >= 30 && item.depth >= 80}<rect x={-item.width / 2 + 10} y={-item.depth / 2 + 10} width={Math.max(1, item.width - 20)} height={Math.min(30, item.depth / 4)} rx="3" fill="#edf0ed" opacity="0.7"/><path d={`M${-item.width / 2} ${-item.depth / 2 + 60}H${item.width / 2}`} stroke="#8a9ba8"/>
                {:else if item.kind === 'storage'}<path d={`M0 ${-item.depth / 2}V${item.depth / 2}`} stroke="#aca58d"/>
                {:else if item.kind === 'rug' && item.width > 12 && item.depth > 12}<rect x={-item.width / 2 + 6} y={-item.depth / 2 + 6} width={item.width - 12} height={item.depth - 12} rx="1" fill="none" stroke="#a69e86" stroke-width="1" stroke-dasharray="3 2"/>{/if}
                <text data-item-label data-outside-label={outsideLabel(item.kind) ? '' : undefined} text-anchor="middle" y={item.kind === 'chaise-sofa' ? -item.depth / 2 + item.sofaDepth / 2 - 8 * rulerScale : outsideLabel(item.kind) ? item.depth / 2 + 12 * rulerScale : '-0.25em'} font-size={outsideLabel(item.kind) ? 10 * rulerScale : Math.min(10 * rulerScale, item.width / 7, item.depth / 3)} font-family="Arial, sans-serif" fill={outsideLabel(item.kind) ? '#3d4d3e' : ink(item.color)} pointer-events="none">
                  {item.name}
                  <tspan x="0" dy="1.4em" font-size="0.85em">{item.kind === 'chaise-sofa' ? 'Soffdel: ' : ''}{number(item.width)} × {number(item.kind === 'chaise-sofa' ? item.sofaDepth : item.depth)} cm</tspan>
                  {#if item.kind === 'chaise-sofa'}<tspan x="0" dy="1.4em" font-size="0.85em">Divan: {number(item.chaiseWidth)} × {number(item.depth)} cm</tspan>{/if}
                </text>
                {#if selectedId === item.id}
                  <g data-editor-only>
                  <rect x={-item.width / 2 - 4} y={-item.depth / 2 - 4} width={item.width + 8} height={item.depth + 8} rx="2" fill="none" stroke="#477864" stroke-width="0.8" stroke-dasharray="4 3" pointer-events="none"/>
                  {#each [-1, 1] as x (x)}{#each [-1, 1] as y (y)}<rect x={x * item.width / 2 - 2.5} y={y * item.depth / 2 - 2.5} width="5" height="5" fill="#fff" stroke="#477864" stroke-width="1" pointer-events="none"/>{/each}{/each}
                  </g>
                {/if}
                {/if}
              </g>
            {/each}
            {#each openings as item (item.id)}
              <g transform={openingTransform(item)} role="button" tabindex="0" aria-label={`${item.name}, ${item.width} cm, välj och flytta med piltangenter`} aria-pressed={selectedId === item.id} onpointerdown={(event) => startDrag(event, item)} onclick={() => selectedId = item.id} onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectedId = item.id; } }} style="cursor: grab; touch-action: none;">
                <rect x="-2" y="-8" width={item.width + 4} height="16" fill="#fbfcf8" stroke={selectedId === item.id ? '#477864' : 'none'} stroke-width="1" stroke-dasharray="4 3" />
                {#if item.kind === 'window'}<path d={`M0 -3H${item.width}M0 0H${item.width}M0 3H${item.width}M0 -5V5M${item.width} -5V5`} fill="none" stroke="#87a5aa" stroke-width="1.5" />
                {:else}
                  <g transform={`translate(${item.hinge === 'right' ? item.width : 0},0) scale(${item.hinge === 'right' ? -1 : 1},${item.swing === 'outward' ? -1 : 1})`}>
                    <path d={`M0 0V${item.width}M${item.width} 0A${item.width} ${item.width} 0 0 1 0 ${item.width}`} fill="none" stroke="#9aab99" stroke-width="1.2"/>
                    <path d={`M0 0V${item.width}`} stroke="#5f7560" stroke-width="2.5"/>
                  </g>
                {/if}
              </g>
            {/each}
            <g data-editor-only class="measurement-guides" pointer-events="none" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" aria-label="Avstånd till närmaste vägg eller objekt">
              {#each guides as guide (guide.direction)}
                {@const vertical = guide.direction === 'top' || guide.direction === 'bottom'}
                <g>
                  <line x1={guide.start.x} y1={guide.start.y} x2={guide.end.x} y2={guide.end.y} stroke="#397fa2" stroke-width="1" stroke-dasharray="3 2" vector-effect="non-scaling-stroke" />
                  {#each [guide.start, guide.end] as point, index (index)}
                    <line x1={point.x - (vertical ? 4 * rulerScale : 0)} y1={point.y - (vertical ? 0 : 4 * rulerScale)} x2={point.x + (vertical ? 4 * rulerScale : 0)} y2={point.y + (vertical ? 0 : 4 * rulerScale)} stroke="#397fa2" stroke-width="1.2" vector-effect="non-scaling-stroke" />
                  {/each}
                  <g transform={`translate(${(guide.start.x + guide.end.x) / 2},${(guide.start.y + guide.end.y) / 2}) rotate(${vertical ? -90 : 0}) scale(${rulerScale})`}>
                    <rect x="-28" y={isElectrical(selected?.kind) ? -38 : -18} width="56" height="16" rx="3" fill="#f5fbff" stroke="#c0d9e6" stroke-width="0.6" />
                    <text y={isElectrical(selected?.kind) ? -27 : -7} fill="#286787">{number(guide.distance)} cm</text>
                  </g>
                </g>
              {/each}
            </g>
            <g transform={`translate(0,${room.height + 35})`} font-family="Arial, sans-serif" font-size="8" fill="#7c887b"><path d="M0 -4V0H100V-4M50 0V-3" fill="none" stroke="#7c887b" stroke-width="1"/><text y="12">0</text><text x="100" y="12" text-anchor="end">100 cm</text></g>
            <text x={room.width} y={room.height + 46} text-anchor="end" font-size="8" font-family="Arial, sans-serif" fill="#8c9789">rum. / planvy</text>
          </svg>
        </div>
      </div>
      <div class="canvas-toolbar"><div class="view-controls"><button class:active={grid} aria-label="Visa rutnät" aria-pressed={grid} onclick={() => grid = !grid}>{@render icon('grid', 17)}</button><span class="toolbar-separator"></span><label class="snap-label"><input type="checkbox" bind:checked={snap}/>Fäst vid 5 cm</label></div><div class="zoom-controls"><button aria-label="Zooma ut" disabled={zoom <= 50} onclick={() => zoom = Math.max(50, zoom - 25)}>−</button><span>{zoom}%</span><button aria-label="Zooma in" disabled={zoom >= 200} onclick={() => zoom = Math.min(200, zoom + 25)}>+</button><span class="toolbar-separator"></span><button aria-label="Anpassa till vy" onclick={() => zoom = 100}>{@render icon('fit', 18)}</button></div></div>
      <div class="canvas-footer"><span><i></i>Rutnät: 10 × 10 cm</span><span>Dra för att flytta <b>·</b> <kbd>R</kbd> rotera <b>·</b> <kbd>⌫</kbd> ta bort</span></div>
    </main>

    <aside class="sidebar right-sidebar" aria-label="Objektets egenskaper">
      <div class="properties-header"><span class="eyebrow">DETALJER</span><h2>{selected || opening ? 'Gör det till ditt.' : 'En plats för allt.'}</h2><p>{selected || opening ? 'Finjustera mått och placering.' : 'Välj ett objekt i din rumsplan.'}</p></div>
      {#if selected || opening}
        {@const current = selected || opening}
        <div class="selected-object"><div class="selected-icon">{@render icon(current.kind, 25)}</div><div><strong>{current.name}</strong><span>{selected ? isElectrical(current.kind) ? 'El & belysning' : 'Möbel' : 'Väggöppning'}</span></div><span class="selected-dot"></span></div>
        <label class="name-field">Namn<input maxlength="40" value={current.name} onchange={(event) => current.name = event.currentTarget.value.trim() || current.name} /></label>
        {#if isWallItem(current.kind)}<p class="library-note">Visas uppifrån: bredd längs väggen och djup ut i rummet.</p>{/if}
        {#if !isElectrical(current.kind)}
        {#if selected?.kind === 'chaise-sofa'}
        <section class="property-section"><h3>Soffdel <span>cm</span></h3>
          <div class="two-columns"><label>Bredd<input aria-label="Soffdelens bredd" type="number" min={selected.chaiseWidth} max="5000" value={selected.width} onchange={(event) => inputNumber(event, 'width')} required/></label><label>Djup<input aria-label="Soffdelens djup" type="number" min="1" max={selected.depth} value={selected.sofaDepth} onchange={(event) => inputNumber(event, 'sofaDepth')} required/></label></div>
        </section>
        <section class="property-section"><h3>Divan <span>cm</span></h3>
          <div class="two-columns"><label>Bredd<input aria-label="Divanens bredd" type="number" min="1" max={selected.width} value={selected.chaiseWidth} onchange={(event) => inputNumber(event, 'chaiseWidth')} required/></label><label>Totaldjup<input aria-label="Divanens totaldjup" type="number" min={selected.sofaDepth} max="5000" value={selected.depth} onchange={(event) => inputNumber(event, 'depth')} required/></label></div>
          <p class="library-note">Totaldjupet mäts från soffans bakkant. Soffdelens bredd är hela soffans bredd.</p>
          <label>Divanens sida, sedd framifrån<select value={selected.chaiseSide} onchange={(event) => updateFurniture({ chaiseSide: event.currentTarget.value })}><option value="right">Vänster</option><option value="left">Höger</option></select></label>
        </section>
        {:else}
        <section class="property-section"><h3>Mått <span>cm</span></h3>
          <div class="two-columns"><label>Bredd<div class="input-unit"><input aria-label="Objektets bredd" type="number" min="1" max="5000" step="1" value={current.width} onchange={(event) => inputNumber(event, 'width', !!opening)} required/><span>cm</span></div></label>{#if selected}<label>Djup<div class="input-unit"><input aria-label="Objektets djup" type="number" min="1" max="5000" step="1" value={selected.depth} onchange={(event) => inputNumber(event, 'depth')} required/><span>cm</span></div></label>{/if}</div>
        </section>
        {/if}
        {/if}
        {#if selected}
          <section class="property-section"><h3>Placering <span>centrum, cm</span></h3><div class="two-columns"><label>Från vänster<div class="input-unit"><input aria-label="Position från vänster" type="number" min="0" max={room.width} step="0.1" value={Number(selected.x.toFixed(1))} onchange={(event) => inputNumber(event, 'x')} required/><span>x</span></div></label><label>Uppifrån<div class="input-unit"><input aria-label="Position uppifrån" type="number" min="0" max={room.height} step="0.1" value={Number(selected.y.toFixed(1))} onchange={(event) => inputNumber(event, 'y')} required/><span>y</span></div></label></div></section>
          <section class="property-section"><h3>Rotation</h3><div class="rotation-row"><div class="input-unit"><input aria-label="Rotation i grader" type="number" min="-360" max="360" step="1" value={selected.angle} onchange={(event) => inputNumber(event, 'angle')} required/><span>°</span></div><button onclick={() => updateFurniture({ angle: (selected.angle + 90) % 360 })}>{@render icon('rotate', 16)}90°</button></div></section>
          <section class="property-section"><h3>Färg</h3><div class="swatches">{#each colors as color (color)}<button style:background={color} style:color={ink(color)} class:chosen={selected.color.toLowerCase() === color} aria-label={`Välj färg ${color}`} aria-pressed={selected.color.toLowerCase() === color} onclick={() => selected.color = color}>{selected.color.toLowerCase() === color ? '✓' : ''}</button>{/each}</div><label class="offset-label">Egen färg<input type="color" aria-label="Egen färg" value={selected.color} oninput={(event) => selected.color = event.currentTarget.value} /></label></section>
        {:else if opening}
          <section class="property-section"><h3>Placering</h3><label>Vägg<select value={opening.wall} onchange={(event) => updateOpening({ wall: event.currentTarget.value, offset: 0 })}>{#each walls as wall (wall.value)}<option value={wall.value}>{wall.name}</option>{/each}</select></label><label class="offset-label">Avstånd från {['top', 'bottom'].includes(opening.wall) ? 'vänster' : 'övre'} hörn<div class="input-unit"><input aria-label="Avstånd från väggens början" type="number" min="0" max={wallLength(opening.wall, room) - opening.width} step="1" value={opening.offset} onchange={(event) => inputNumber(event, 'offset', true)} required/><span>cm</span></div></label></section>
          {#if opening.kind === 'door'}
            <section class="property-section"><h3>Dörröppning</h3>
              <label>Gångjärn, sett inifrån<select value={opening.hinge ?? 'left'} onchange={(event) => updateOpening({ hinge: event.currentTarget.value })}><option value="left">Vänster</option><option value="right">Höger</option></select></label>
              <label class="offset-label">Öppnas<select value={opening.swing ?? 'inward'} onchange={(event) => updateOpening({ swing: event.currentTarget.value })}><option value="inward">Inåt</option><option value="outward">Utåt</option></select></label>
            </section>
          {/if}
        {/if}
        <div class="object-actions">{#if selected}<button onclick={duplicateSelected}>{@render icon('copy', 16)}Duplicera</button>{/if}<button class="delete-button" onclick={removeSelected}>{@render icon('trash', 16)}Ta bort</button></div>
      {:else}
        <div class="empty-selection">{@render icon('fit', 40)}<p>Klicka på ett objekt för att ändra mått eller placering.</p></div>
      {/if}
      <div class="tip"><span class="tip-star">✧</span><strong>Lite hjälp på vägen</strong><p>Flytta med piltangenterna, 1 cm i taget. Håll inne Shift för steg om 10 cm.</p><p>Möbler snäpper lätt mot väggar och varandra. Håll Alt när du drar för fri placering.</p><p>Objekt hålls inom rummets väggar. Möbler kan överlappa.</p></div>
    </aside>
  </div>
</div>

<dialog class="print-preview" aria-labelledby="print-title" {@attach (element) => { printDialog = element; }}>
  <div class="print-header"><div><h2 id="print-title">Utskriftsvy</h2><p>Svartvit skiss med alla objektmått, positioner och avstånd i cm.</p></div><div class="print-actions"><button class="export-button" onclick={() => window.print()}>{@render icon('print', 16)}Skriv ut</button><button class="export-button" onclick={() => exportDrawing(true)}>Ladda ner SVG</button><button class="export-button" onclick={() => enlargedPreview = !enlargedPreview}>{enlargedPreview ? 'Anpassa' : 'Förstora'}</button><button class="export-button" onclick={() => printDialog.close()}>Stäng</button></div></div>
  <div class="print-scroll" class:enlarged={enlargedPreview} {@attach (element) => { printPreview = element; }}></div>
</dialog>
<div class="print-area" aria-hidden="true" {@attach (element) => { printArea = element; }}></div>

<style>
  .print-area{display:none}.print-preview{width:calc(100vw - 32px);max-width:1200px;max-height:92vh;border:1px solid #dce2d9;border-radius:10px;padding:20px;background:#fff;color:#29392f}.print-preview::backdrop{background:#23312780}.print-header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:18px}.print-header h2{font-size:18px}.print-header p{font-size:11px;color:#748073;margin-top:8px}.print-actions{display:flex;flex-wrap:wrap;gap:8px;flex-shrink:0}.print-scroll{overflow:auto;max-height:72vh}.print-scroll :global(svg.plan-output){display:block;width:100%;min-width:0;height:auto}.print-scroll.enlarged :global(svg.plan-output){width:1120px;max-width:none}.header-actions{flex-wrap:wrap}.view-controls{flex-wrap:wrap}
  @media(max-width:520px){.header{height:auto;min-height:68px;flex-wrap:wrap;row-gap:10px;padding-top:12px;padding-bottom:12px}.header-actions{width:100%;justify-content:flex-end}}
  @media(max-width:650px){.print-header{align-items:flex-start;flex-direction:column}.header-actions{gap:6px}.header-divider{display:none}.project-title{max-width:110px}}
  @media print{@page{size:A4 landscape;margin:10mm}:global(html),:global(body){margin:0!important;background:#fff!important;overflow:visible!important}.app,.print-preview{display:none!important}.print-preview::backdrop{display:none!important}.print-area{display:block!important}.print-area :global(svg.plan-output){display:block;width:100%;height:auto;max-height:185mm;overflow:visible}}
  :global(*){box-sizing:border-box} :global(body){margin:0;background:#f6f7f4;color:#29392f;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;-webkit-font-smoothing:antialiased} :global(button),:global(input),:global(select){font:inherit} :global(button){cursor:pointer} :global(button:disabled){opacity:.35;cursor:default} :global(button){transition:background .15s,border-color .15s,box-shadow .15s} :global(button:focus-visible),:global(a:focus-visible),:global(input:focus-visible),:global(select:focus-visible),:global(g[role=button]:focus-visible){outline:2px solid #508368;outline-offset:4px} :global(input),:global(select){width:100%;min-width:0;height:39px;border:1px solid #dce2d9;background:#fff;border-radius:6px;color:#354435;padding:0 11px;outline-offset:2px} :global(input[type=number]){appearance:textfield;-moz-appearance:textfield} :global(input::-webkit-inner-spin-button){appearance:none} :global(label){display:block;font-size:11px;color:#748073} :global(label>input),:global(label>select),:global(label>.input-unit){margin-top:8px} :global(h1),:global(h2),:global(h3),:global(p){margin:0} :global(button){color:inherit} :global(svg){flex-shrink:0}
  .room-manager{padding-bottom:20px;margin-bottom:20px;border-bottom:1px solid #ecede8}.project-title{min-width:0;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.canvas-heading h2{overflow-wrap:anywhere}
  .app{min-height:100vh}.header{height:78px;display:flex;align-items:center;padding:0 30px;background:#fff;border-bottom:1px solid #e2e6de;gap:27px}.brand{font-size:34px;letter-spacing:-2px;font-weight:650;color:#304f3c;text-decoration:none;display:flex;align-items:center}.brand-mark{display:grid;place-items:center;margin-right:9px;width:30px;height:30px;border:2px solid #446b50;border-radius:8px;font-size:35px;line-height:1;letter-spacing:0;font-weight:400}.brand-dot{color:#799778}.header-divider{width:1px;height:25px;background:#e1e6de}.project-title{font-size:13px;font-weight:500}.project-tag{font-size:10px;background:#f0f3ec;padding:4px 7px;border-radius:4px;margin-left:10px;color:#819078}.header-actions{margin-left:auto;display:flex;gap:25px;align-items:center}.save-status{font-size:11px;color:#879181;display:flex;align-items:center;gap:7px}i{display:inline-block;width:6px;height:6px;background:#7f9a77;border-radius:50%}.export-button{height:37px;display:flex;align-items:center;gap:9px;border:1px solid #dce3d7;background:#fff;border-radius:6px;padding:0 14px;font-size:11px}.export-button:hover{background:#f1f5ed}.workspace{display:grid;grid-template-columns:266px minmax(340px,1fr) 262px;min-height:calc(100vh - 78px)}.sidebar{background:#fff}.left-sidebar{padding:31px 23px 22px;border-right:1px solid #e2e6de;display:flex;flex-direction:column}.eyebrow{font-size:9px;letter-spacing:1.65px;font-weight:650;color:#8c9987}.intro h1{font-family:Georgia,"Times New Roman",serif;font-size:29px;font-weight:400;line-height:1.22;letter-spacing:-.8px;margin-top:12px}.intro p{font-size:11px;color:#85907f;margin-top:12px}.room-section{margin-top:32px;border-top:1px solid #ecede8;padding-top:23px}.section-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.section-heading h2{font-size:12px;font-weight:600}.unit-pill{font-size:10px;color:#929b8a;background:#f3f5ef;padding:3px 6px;border-radius:4px}.two-columns{display:grid;grid-template-columns:1fr 1fr;gap:10px}.input-unit{position:relative}.input-unit input{padding-right:31px}.input-unit>span{position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:10px;color:#97a08e;pointer-events:none}.apply-button{background:#eaf0e5;color:#526e48;width:100%;display:flex;align-items:center;justify-content:space-between;border:0;border-radius:5px;height:34px;margin-top:13px;font-size:10px;padding:0 12px}.apply-button:hover{background:#dfe9d7}.apply-button span{font-size:15px}.library{margin-top:28px;border-top:1px solid #ecede8;padding-top:23px}.small-plus{color:#97a38d;font-size:17px}.tabs{display:flex;overflow-x:auto;border-bottom:1px solid #e6eade;margin-bottom:16px;gap:17px}.tabs button{padding:0 0 11px;border:0;background:none;font-size:10px;white-space:nowrap;color:#87907d;border-bottom:2px solid transparent}.tabs button[aria-selected=true]{color:#3e6147;border-bottom-color:#58795a;font-weight:600}.catalog{display:grid;grid-template-columns:1fr 1fr;gap:10px}.catalog-card{position:relative;border:1px solid #e5e8df;background:#fcfdf9;border-radius:7px;min-height:108px;text-align:left;padding:13px 11px 11px;display:flex;flex-direction:column}.catalog-card:hover{border-color:#a4b79b;background:#f1f5ea}.catalog-icon{height:39px;display:flex;align-items:flex-start;color:#75856b}.catalog-name{font-size:11px;font-weight:500;margin-top:6px}.catalog-size{font-size:9px;color:#9a9f90;margin-top:5px;white-space:nowrap}.card-plus{position:absolute;right:8px;top:8px;font-size:14px;color:#a5b199}.library-note{font-size:10px;line-height:1.7;color:#909987;margin-top:14px}.scale-note{display:flex;align-items:center;gap:10px;margin-top:auto;padding-top:30px;color:#8d9d81}.scale-note strong{font-size:9px;font-weight:500;color:#7e8d73}.scale-note p{font-size:9px;color:#a6af9f;margin-top:5px}.canvas-panel{min-width:0;display:flex;flex-direction:column;position:relative;background:#f6f7f2;max-height:calc(100vh - 78px);min-height:650px}.canvas-heading{padding:28px 29px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.canvas-heading h2{font-size:15px;font-weight:550;letter-spacing:-.3px}.canvas-heading h2 span{font-size:9px;font-weight:400;background:#e9ede2;color:#7b8c70;padding:4px 7px;border-radius:4px;margin-left:10px;letter-spacing:0}.canvas-heading p{font-size:10px;color:#8c9782;margin-top:9px}.canvas-heading p span{padding:0 5px}.scale-badge{display:flex;align-items:center;gap:7px;border:1px solid #e0e7d7;padding:7px 9px;border-radius:20px;color:#829476;font-size:9px;background:#fafbf6;white-space:nowrap}.scale-badge i{width:5px;height:5px;background:#8ca57b}.drawing-scroll{overflow:auto;flex:1;min-height:0;padding:10px 16px 0;display:flex;align-items:safe center}.drawing-wrap{flex-shrink:0;min-width:0;max-width:none;margin:auto;line-height:0}.floorplan{width:100%;height:calc((100vh - 300px) * var(--zoom));min-height:calc(340px * var(--zoom));display:block;overflow:visible;user-select:none}.canvas-toolbar{display:flex;justify-content:space-between;gap:10px;margin:10px 28px 19px;padding:9px 11px;border:1px solid #e0e5d7;border-radius:8px;background:#fdfefa;box-shadow:0 3px 7px #394a2010}.view-controls,.zoom-controls{display:flex;align-items:center;gap:9px}.canvas-toolbar button{display:grid;place-items:center;border:0;background:none;border-radius:4px;min-width:27px;height:27px;font-size:18px;padding:0 4px;color:#89937e}.canvas-toolbar button:hover,.canvas-toolbar button.active{background:#ecf1e5;color:#4e6c43}.toolbar-separator{width:1px;height:17px;background:#e3e8da;margin:0 3px}.snap-label{display:flex;align-items:center;gap:6px;font-size:10px;white-space:nowrap}.snap-label input{appearance:auto;margin:0;width:12px;height:12px;accent-color:#567a51}.zoom-controls>span:not(.toolbar-separator){font-size:10px;min-width:33px;text-align:center;color:#6e7b62}.canvas-footer{height:43px;border-top:1px solid #e3e7dc;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 24px;font-size:9px;color:#98a28e;background:#f5f7ef}.canvas-footer>span{display:flex;align-items:center;gap:5px;white-space:nowrap}.canvas-footer i{background:#b3c1a3;width:5px;height:5px;margin-right:2px}.canvas-footer b{font-weight:400;padding:0 2px}kbd{font-family:inherit;font-size:9px;border:1px solid #dfe5d5;border-radius:3px;padding:1px 4px;background:#fafcf6;color:#7d8a70}.right-sidebar{border-left:1px solid #e2e6de;padding:31px 22px 22px;display:flex;flex-direction:column}.properties-header h2{font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:23px;letter-spacing:-.7px;margin-top:13px}.properties-header p{font-size:10px;color:#8d9784;margin-top:8px}.selected-object{display:flex;align-items:center;gap:11px;background:#f4f7ef;border:1px solid #e7ecdf;border-radius:6px;padding:12px 10px;margin-top:25px}.selected-icon{display:grid;place-items:center;color:#7b8d6c}.selected-object strong{font-size:11px;font-weight:550;display:block;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.selected-object div>span{display:block;font-size:9px;color:#99a18f;margin-top:4px}.selected-dot{width:5px;height:5px;background:#8ca67b;border-radius:50%;margin-left:auto}.name-field{margin-top:21px}.name-field input{height:36px;font-size:11px}.property-section{margin-top:22px}.property-section h3{display:flex;justify-content:space-between;font-size:11px;font-weight:550;margin-bottom:12px}.property-section h3 span{font-size:9px;font-weight:400;color:#9aa391}.property-section input,.property-section select{height:36px;font-size:11px}.property-section label{font-size:10px}.rotation-row{display:flex;gap:9px}.rotation-row>.input-unit{flex:1;min-width:0}.rotation-row button{display:flex;align-items:center;justify-content:center;gap:7px;width:83px;border:1px solid #e1e6d9;background:#fbfcf8;font-size:10px;border-radius:5px}.rotation-row button:hover{background:#edf3e7}.swatches{display:flex;flex-wrap:wrap;gap:12px;padding:2px}.swatches button{border-radius:50%;width:25px;height:25px;border:2px solid #fff;box-shadow:0 0 0 1px transparent;color:#fff;display:grid;place-items:center;font-size:12px}.swatches button.chosen{box-shadow:0 0 0 1px #82947b}.offset-label{margin-top:14px}.object-actions{display:flex;gap:10px;border-top:1px solid #e8ecdf;padding-top:19px;margin-top:24px}.object-actions button{display:flex;align-items:center;justify-content:center;gap:6px;background:#fff;border:1px solid #dfe5d6;font-size:10px;border-radius:5px;height:34px;flex:1}.object-actions button:hover{background:#f3f6ef}.object-actions .delete-button{color:#ac8071;border-color:#eaded4}.tip{margin-top:auto;background:#f7f7ef;border:1px solid #ececdd;border-radius:7px;padding:14px 13px;color:#869274;position:relative}.tip-star{position:absolute;right:13px;top:9px;color:#a7b58d;font-size:23px}.tip strong{display:block;color:#71815f;font-size:10px;font-weight:550}.tip p{font-size:9px;line-height:1.8;margin-top:8px;max-width:165px}.empty-selection{text-align:center;color:#a2b095;padding:40px 10px}.empty-selection>p{font-size:11px;line-height:1.9;color:#8e9b82;margin-top:18px}.message{margin:15px 25px 0;padding:12px;background:#f9efdb;border:1px solid #e7d4ae;color:#7a6943;font-size:11px;line-height:1.5;border-radius:5px;display:flex;align-items:center;gap:10px}.message button{margin-left:auto;border:0;background:none;font-size:19px;color:#8c7a54}
  @media(min-width:1450px){.workspace{grid-template-columns:285px minmax(340px,1fr) 280px}.left-sidebar,.right-sidebar{padding-left:28px;padding-right:28px}.drawing-scroll{padding-left:45px;padding-right:45px}.canvas-heading{padding:34px 42px 0}.canvas-toolbar{margin-left:42px;margin-right:42px}.floorplan{height:calc((100vh - 285px) * var(--zoom))}}
  @media(max-width:1100px){.workspace{grid-template-columns:230px minmax(300px,1fr) 225px}.left-sidebar,.right-sidebar{padding:25px 16px 20px}.header{padding:0 22px}.header-actions{gap:14px}.save-status{font-size:10px}.catalog-card{padding:12px 8px}.canvas-heading{padding:25px 20px 0}.scale-badge{display:none}.canvas-toolbar{margin-left:18px;margin-right:18px}.canvas-footer{padding:0 18px}.canvas-footer>span:last-child{display:none}.tip{margin-top:24px}.swatches{gap:10px}.intro h1{font-size:27px}.properties-header h2{font-size:21px}.selected-object strong{max-width:100px}}
  @media(max-width:820px){.workspace{grid-template-columns:220px minmax(0,1fr)}.right-sidebar{grid-column:1/-1;border-left:0;border-top:1px solid #e2e6de;display:grid;grid-template-columns:1fr 1fr;gap:18px 28px}.properties-header{grid-column:1/-1}.selected-object,.name-field,.property-section,.object-actions{margin-top:0}.tip{grid-column:1/-1;margin-top:0}.tip p{max-width:none}.canvas-panel{min-height:620px;max-height:750px}.header{height:68px;gap:17px}.save-status{display:none}.project-title{font-size:11px}.floorplan{min-height:calc(280px * var(--zoom));height:calc(450px * var(--zoom))}.selected-object strong{max-width:none}.scale-note{padding-top:25px}.canvas-toolbar{flex-wrap:wrap;justify-content:center}.view-controls{margin-right:auto}.zoom-controls{margin-left:auto}}
  @media(max-width:520px){.header{padding:0 16px;gap:12px}.brand{font-size:29px}.brand-mark{height:26px;width:26px;font-size:29px}.header-divider,.project-tag{display:none}.export-button{padding:0 9px;font-size:10px;height:33px;gap:6px}.workspace{grid-template-columns:1fr}.left-sidebar{display:block;padding:24px 19px;border-right:0}.intro h1{font-size:28px}.intro h1 br{display:none}.intro p{margin-top:8px}.room-section{margin-top:20px;padding-top:18px}.room-section form{display:flex;align-items:flex-end;gap:10px}.room-section .two-columns{flex:1}.apply-button{width:110px;height:39px;margin:0}.apply-button span{display:none}.library{margin-top:20px;padding-top:18px}.catalog{grid-template-columns:repeat(3,1fr);gap:8px}.catalog-card{min-height:97px}.catalog-icon{height:32px}.library-note{margin-top:10px}.scale-note{display:none}.canvas-panel{min-height:510px;max-height:650px;border-top:1px solid #e0e5d7}.drawing-scroll{padding:0 8px}.canvas-heading{padding:22px 20px 0}.floorplan{min-height:calc(300px * var(--zoom))}.canvas-toolbar{margin:0 18px 15px}.canvas-footer{height:37px}.right-sidebar{padding:25px 20px;gap:20px}.properties-header h2{font-size:24px}.properties-header p{font-size:11px}.tip{padding:16px}.tip p{font-size:10px}.message{margin:15px 18px 0}}
</style>
