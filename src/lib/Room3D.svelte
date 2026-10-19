<script>
  import { furnitureElevation, furnitureHeights, openingBounds, orbitView, surfaceShade, wallSections } from './room-3d.js';

  /** @type {{room: {width: number, height: number, ceilingHeight: number}, items: any[], openings: any[], selectedId: string, onselect: (id: string) => void}} */
  let { room, items, openings, selectedId, onselect } = $props();
  let rotation = $state(-30);
  let tilt = $state(55);
  let width = $state(600);
  let height = $state(420);
  let orbiting = $state(false);
  /** @type {{pointerId: number, x: number, y: number, rotation: number, tilt: number, itemId: string | null} | null} */
  let orbit = null;

  function startOrbit(event) {
    if (event.button !== 0 || !event.isPrimary || orbit) return;
    orbit = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, rotation, tilt, itemId: event.target.closest('[data-item-id]')?.getAttribute('data-item-id') ?? null };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveOrbit(event) {
    if (!orbit || event.pointerId !== orbit.pointerId) return;
    const dx = event.clientX - orbit.x, dy = event.clientY - orbit.y;
    if (!orbiting && Math.hypot(dx, dy) < 4) return;
    orbiting = true;
    ({ rotation, tilt } = orbitView(orbit.rotation, orbit.tilt, dx, dy));
  }

  function endOrbit(event) {
    if (!orbit || event.pointerId !== orbit.pointerId) return;
    if (!orbiting && event.type === 'pointerup' && orbit.itemId) onselect(orbit.itemId);
    orbit = null;
    orbiting = false;
  }
  let tallest = $derived(Math.max(room.ceilingHeight, ...items.map((item) => (item.height ?? furnitureHeights[item.kind] ?? 60) + furnitureElevation(item.kind, room.ceilingHeight, item.height ?? furnitureHeights[item.kind] ?? 60, item.elevation))));
  let diagonal = $derived(Math.hypot(room.width, room.height));
  let scale = $derived(Math.max(0.001, Math.min((width - 36) / diagonal, (height - 36) / (diagonal * Math.cos(tilt * Math.PI / 180) + tallest * Math.sin(tilt * Math.PI / 180)))));
  let walls = $derived([
    { id: 'top', x: 0, y: 0, angle: 0, length: room.width },
    { id: 'right', x: room.width, y: 0, angle: 90, length: room.height },
    { id: 'bottom', x: room.width, y: room.height, angle: 180, length: room.width },
    { id: 'left', x: 0, y: room.height, angle: 270, length: room.height }
  ]);
</script>

{#snippet box(x, y, w, d, h, z = 0)}
  <span class="box" style:width={`${w}px`} style:height={`${d}px`} style:--w={`${w}px`} style:--d={`${d}px`} style:--h={`${h}px`} style:transform={`translate3d(${x}px, ${y}px, ${z}px)`}>
    <span class="face top"></span><span class="face front"></span><span class="face back"></span><span class="face left"></span><span class="face right"></span>
  </span>
{/snippet}

{#snippet cylinder(x, y, diameter, h, z, angle)}
  <span class="box cylinder" style:width={`${diameter}px`} style:height={`${diameter}px`} style:--w={`${diameter}px`} style:--d={`${diameter}px`} style:--h={`${h}px`} style:transform={`translate3d(${x}px, ${y}px, ${z}px)`}>
    <span class="face top"></span>
    {#each Array.from({ length: 32 }, (_, i) => i) as side (side)}
      {@const degrees = side * 360 / 32}
      {@const radians = degrees * Math.PI / 180}
      {@const radius = diameter / 2}
      {@const insetRadius = radius * Math.cos(Math.PI / 32)}
      <span class="face cylinder-side" style:width={`${diameter * Math.sin(Math.PI / 32)}px`} style:height={`${h}px`} style:--shade={surfaceShade(angle + degrees)} style:transform={`translate(${radius + insetRadius * Math.cos(radians)}px, ${radius + insetRadius * Math.sin(radians)}px) rotateZ(${degrees + 90}deg) rotateX(90deg) translateX(-50%)`}></span>
    {/each}
  </span>
{/snippet}

<div class="preview">
  <div class="viewport" class:orbiting bind:clientWidth={width} bind:clientHeight={height} role="group" aria-label="3D-modell av rummet. Dra för att vrida och luta vyn. Klicka på en möbel för att ändra dess mått." onpointerdown={startOrbit} onpointermove={moveOrbit} onpointerup={endOrbit} onpointercancel={endOrbit} onlostpointercapture={endOrbit}>
    <div class="world" style:transform={`scale(${scale}) rotateX(${tilt}deg) rotateZ(${rotation}deg) translate3d(${-room.width / 2}px, ${-room.height / 2}px, ${-tallest / 2}px)`}>
      <div class="floor" style:width={`${room.width}px`} style:height={`${room.height}px`}></div>
      {#each walls as wall (wall.id)}
        <div class="wall-group" style:--shade={surfaceShade(wall.angle + 90)} style:transform={`translate(${wall.x}px, ${wall.y}px) rotateZ(${wall.angle}deg)`}>
          {#each wallSections(wall.length, openings.filter((opening) => opening.wall === wall.id).map((opening) => ({ ...opening, offset: wall.id === 'bottom' || wall.id === 'left' ? wall.length - opening.offset - opening.width : opening.offset })), room.ceilingHeight) as section, i (i)}
            <div class="wall" style:width={`${section.width}px`} style:height={`${section.height}px`} style:background-size={`100% ${room.ceilingHeight}px`} style:background-position={`0 ${section.z + section.height - room.ceilingHeight}px`} style:transform={`translate3d(${section.offset}px, 0, ${section.z + section.height}px) rotateX(-90deg)`}></div>
          {/each}
          {#each openings.filter((opening) => opening.wall === wall.id && opening.kind === 'window') as opening (opening.id)}
            {@const bounds = openingBounds(opening)}
            <div class="window" style:height={`${bounds.height}px`} style:width={`${opening.width}px`} style:transform={`translate3d(${wall.id === 'bottom' || wall.id === 'left' ? wall.length - opening.offset - opening.width : opening.offset}px, 0, ${bounds.top}px) rotateX(-90deg)`}></div>
          {/each}
        </div>
      {/each}
      {#each items as item (item.id)}
        {@const w = item.width || 8}
        {@const d = item.depth || 8}
        {@const h = item.height ?? furnitureHeights[item.kind] ?? 60}
        {@const elevation = furnitureElevation(item.kind, room.ceilingHeight, item.height ?? furnitureHeights[item.kind] ?? 60, item.elevation)}
        <button class="object" data-item-id={item.id} class:selected={selectedId === item.id} aria-label={`${item.name}, höjd ${h} cm`} aria-pressed={selectedId === item.id} onclick={() => onselect(item.id)} style:width={`${w}px`} style:height={`${d}px`} style:--color={item.color} style:--front-shade={surfaceShade(item.angle + 90)} style:--back-shade={surfaceShade(item.angle - 90)} style:--left-shade={surfaceShade(item.angle + 180)} style:--right-shade={surfaceShade(item.angle)} style:transform={`translate3d(${item.x}px, ${item.y}px, ${elevation}px) rotateZ(${item.angle}deg) translate(${-w / 2}px, ${-d / 2}px)`}>
          {#if item.kind === 'round-table'}
            {@const thickness = Math.min(6, h * .12)}
            {@render cylinder(w * .25, d * .25, w * .5, Math.min(3, h * .1), 0, item.angle)}
            {@render box(w * .4, d * .4, w * .2, d * .2, h - thickness)}
            {@render cylinder(0, 0, w, thickness, h - thickness, item.angle)}
          {:else if item.kind === 'person'}
            {@render box(w * .22, d * .3, w * .22, d * .7, h * .48)}
            {@render box(w * .56, d * .3, w * .22, d * .7, h * .48)}
            {@render box(w * .2, d * .175, w * .6, d * .65, h * .34, h * .48)}
            {@render box(0, d * .225, w * .18, d * .55, h * .4, h * .42)}
            {@render box(w * .82, d * .225, w * .18, d * .55, h * .4, h * .42)}
            {@render box(w * .41, d * .325, w * .18, d * .35, h * .04, h * .82)}
            {@render box(w * .3, d * .1, w * .4, d * .8, h * .14, h * .86)}
          {:else if item.kind === 'sofa' || item.kind === 'chair' || item.kind === 'chaise-sofa'}
            {@const seatDepth = item.kind === 'chaise-sofa' ? item.sofaDepth : d}
            {@render box(0, 0, w, seatDepth, h * 0.6)}
            {@render box(0, 0, w, Math.min(15, seatDepth / 4), h)}
            {@render box(0, 0, Math.min(12, w / 5), seatDepth, h * 0.8)}
            {@render box(w - Math.min(12, w / 5), 0, Math.min(12, w / 5), seatDepth, h * 0.8)}
            {#if item.kind === 'chaise-sofa' && d > seatDepth}
              {@render box(item.chaiseSide === 'left' ? 0 : w - item.chaiseWidth, seatDepth, item.chaiseWidth, d - seatDepth, h * 0.6)}
            {/if}
          {:else}
            {@render box(0, 0, w, d, h)}
          {/if}
        </button>
      {/each}
    </div>
  </div>
  <div class="controls">
    <label>Vrid <input aria-label="Vrid 3D-vyn" type="range" min="-180" max="180" bind:value={rotation} /></label>
    <label>Lutning <input aria-label="Luta 3D-vyn" type="range" min="25" max="75" bind:value={tilt} /></label>
    <button onclick={() => { rotation = -30; tilt = 55; }}>Återställ vy</button>
  </div>
  <p>Dra för att vrida och luta vyn. Klicka på en möbel för att ändra mått. Framväggar döljs för insyn.</p>
</div>

<style>
  .preview{flex:1;min-height:0;display:flex;flex-direction:column;padding:0 18px 12px;color:#6e7b62}
  .viewport{position:relative;flex:1;min-height:280px;overflow:hidden;touch-action:none;user-select:none;cursor:grab}
  .viewport.orbiting,.viewport.orbiting .object{cursor:grabbing}
  .world{position:absolute;left:50%;top:50%;transform-origin:0 0}
  .world,.wall-group,.object,.box{transform-style:preserve-3d}
  .floor,.wall-group,.wall,.window,.object,.box,.face{position:absolute;left:0;top:0;box-sizing:border-box}
  .floor{background:repeating-linear-gradient(90deg,transparent 0 39px,#b6a98f35 39px 40px),#e6ddca;border:3px solid #b4ab96;box-shadow:0 10px 30px #4c5b4e25}
  .wall,.window{transform-origin:0 0;backface-visibility:hidden}
  .wall{background:linear-gradient(to bottom,color-mix(in srgb,#eceee5,#000 calc(var(--shade) * .6)),color-mix(in srgb,#eceee5,#000 calc(var(--shade) * .6 + 6%)));background-repeat:no-repeat}
  .window{background:#b6d9df99;border:5px solid #f9fbf7;box-shadow:inset 0 0 0 1px #87a5aa}
  .object{padding:0;border:0;background:none;cursor:pointer;outline:none;transform-origin:0 0}
  .face{display:block;background:var(--color);border:1px solid #34453230}
  .top{width:var(--w);height:var(--d);transform:translateZ(var(--h));background:linear-gradient(135deg,color-mix(in srgb,var(--color),#fff 12%),var(--color))}
  .cylinder .top{border-radius:50%}
  .cylinder-side{transform-origin:0 0;border:0;background:linear-gradient(to bottom,color-mix(in srgb,var(--color),#000 calc(var(--shade) + 5%)),color-mix(in srgb,var(--color),#000 var(--shade)))}
  .front,.back,.left,.right{background:linear-gradient(to bottom,color-mix(in srgb,var(--color),#000 calc(var(--shade) + 5%)),color-mix(in srgb,var(--color),#000 var(--shade)))}
  .front,.back{width:var(--w);height:var(--h);transform-origin:0 0}
  .front{--shade:var(--front-shade);transform:translateY(var(--d)) rotateX(90deg)}
  .back{--shade:var(--back-shade);transform:rotateX(90deg)}
  .left,.right{width:var(--d);height:var(--h);transform-origin:0 0}
  .left{--shade:var(--left-shade);transform:rotateZ(90deg) rotateX(90deg)}
  .right{--shade:var(--right-shade);transform:translateX(var(--w)) rotateZ(90deg) rotateX(90deg)}
  .object.selected .top,.object:focus-visible .top{outline:3px solid #477864;outline-offset:-3px}
  .controls{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;font-size:11px}
  label{display:flex;align-items:center;gap:6px}
  input{width:95px;accent-color:#567a51}
  .controls button{border:1px solid #dfe5d6;border-radius:5px;padding:6px 10px;background:#fbfcf8;color:inherit;font:inherit;cursor:pointer}
  p{text-align:center;font-size:10px;line-height:1.6;margin:10px 0 0}
</style>
