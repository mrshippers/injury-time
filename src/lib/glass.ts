/**
 * Liquid glass: the half of the material CSS cannot do on its own.
 *
 * The stylesheet owns the look (tint, filter, edge, ink; see "glass" in
 * globals.css). This module reads what is behind each glass surface and
 * tells the stylesheet how dense to be, bends the backdrop at the rim with
 * an SVG displacement map, and keeps the tint setting. One call, mountGlass(),
 * runs all of it; a surface opts in by wearing the glass class.
 *
 * Nothing here touches layout: it writes custom properties and one hidden
 * <svg> per lens, and reads the page with elementsFromPoint.
 */

/* ── the reading: pure, tested in tests/unit/glass.test.ts ──────────────── */

export type Rgb = readonly [number, number, number];
export type Ink = "light" | "dark";
export type Theme = "light" | "dark";
export type Reading = {
  /** mean brightness of the backdrop, 0 black to 1 white */
  luminance: number;
  /** brightest kept sample minus the darkest: how busy it is */
  texture: number;
  /** how far the mean colour is from grey */
  chroma: number;
  /** the brightest sample of all, dropped or not: what a label might be sitting on */
  peak: number;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export const luma = ([r, g, b]: Rgb) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** A 5 by 3 grid of samples in, one reading out. The two darkest and the two
 *  brightest are dropped before averaging, so one crest or one glyph cannot
 *  swing the mean. The peak keeps them: one bright button under a bar is
 *  exactly where a label goes missing. */
export function read(samples: readonly Rgb[]): Reading {
  const sorted = [...samples].sort((a, b) => luma(a) - luma(b));
  const kept = sorted.length > 4 ? sorted.slice(2, -2) : sorted;
  const mean = [0, 1, 2].map((i) => kept.reduce((sum, s) => sum + s[i], 0) / kept.length);
  return {
    luminance: luma([mean[0], mean[1], mean[2]]),
    texture: luma(kept[kept.length - 1]) - luma(kept[0]),
    chroma: (Math.max(...mean) - Math.min(...mean)) / 255,
    peak: luma(sorted[sorted.length - 1]),
  };
}

/** Light text under half brightness in a light theme, held inside 0.05 of the
 *  line so a surface never flickers at it. A dark theme is always light text. */
export function decideInk(luminance: number, previous: Ink | null, theme: Theme): Ink {
  if (theme === "dark") return "light";
  if (previous && Math.abs(luminance - 0.5) <= 0.05) return previous;
  return luminance < 0.5 ? "light" : "dark";
}

/** 0 thin to 1 dense. The first line is the material's own rule. The second
 *  is the floor for a theme whose ink cannot flip: when something bright
 *  slides under light text, the glass has to smoke over or the label is lost.
 *  The ramp is fitted to the contrast sweep in scripts/verify-glass.mjs: fully
 *  dense by a peak of 0.6, because the reading is an estimate and runs dark. */
export function density(reading: Reading, ink: Ink, theme: Theme): number {
  const inkBrightness = ink === "light" ? 0.94 : 0.14;
  const closeness = 1 - Math.abs(reading.luminance - inkBrightness);
  const material = 0.55 * closeness + 0.7 * reading.texture + 0.3 * reading.chroma;
  const floor = theme === "dark" ? Math.pow(clamp01((reading.peak - 0.2) / 0.4), 0.6) : 0;
  return clamp01(Math.max(material, floor));
}

/** How much of the backdrop's saturation the glass keeps, so a vivid
 *  background does not stain it. */
export const saturationKept = (reading: Reading) => Math.max(0.45, 1 - 0.75 * reading.chroma);

/* ── the rim: pure geometry ─────────────────────────────────────────────── */

export type Rim = { top: boolean; right: boolean; bottom: boolean; left: boolean };

/** About 44px on a card, a third and a bit of the short side on anything smaller. */
export const rimWidth = (width: number, height: number) => Math.max(4, Math.min(44, Math.min(width, height) / 3.5));

/** A thick slab: a point d from the edge looks inward by this much. Hard at
 *  the edge, where the scene folds back on itself, nothing at the rim's inner edge. */
export const bend = (d: number, rim: number) => (d >= rim ? 0 : 1.1 * rim * Math.pow(1 - Math.max(d, 0) / rim, 2.6));

/** The offset, in px, that the pixel at (x, y) looks through. Distances run
 *  along each axis to the corner the CSS actually draws, so the bend follows
 *  a rounded corner and never creases along its diagonal. */
export function lensOffset(x: number, y: number, width: number, height: number, radius: number, rim: number, sides: Rim): [number, number] {
  const inset = (along: number, length: number) => {
    const d = along < radius ? radius - along : along > length - radius ? along - (length - radius) : 0;
    return d > 0 ? radius - Math.sqrt(Math.max(0, radius * radius - d * d)) : 0;
  };
  const ix = inset(y, height);
  const iy = inset(x, width);
  const ox = (sides.left ? bend(x - ix, rim) : 0) - (sides.right ? bend(width - ix - x, rim) : 0);
  const oy = (sides.top ? bend(y - iy, rim) : 0) - (sides.bottom ? bend(height - iy - y, rim) : 0);
  return [ox, oy];
}

/* ── the tint setting ───────────────────────────────────────────────────── */

const TINT_KEY = (theme: Theme) => `glass.tint.${theme}`;
const currentTheme = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

/** 0 to 1.5; 1 is the material as designed. Each theme keeps its own. */
export function glassTint(of: Theme = currentTheme()): number {
  try {
    const stored = Number.parseFloat(localStorage.getItem(TINT_KEY(of)) ?? "");
    return Number.isFinite(stored) ? Math.min(1.5, Math.max(0, stored)) : 1;
  } catch {
    return 1;
  }
}

export function setGlassTint(value: number, of: Theme = currentTheme()): void {
  const v = Math.min(1.5, Math.max(0, value));
  try {
    localStorage.setItem(TINT_KEY(of), String(v));
  } catch {
    // storage is off (private mode): the setting holds for this visit only
  }
  if (of === currentTheme()) document.documentElement.style.setProperty("--glass-scale", String(v));
}

/* ── the browser half ───────────────────────────────────────────────────── */

type Rgba = readonly [number, number, number, number];
type Surface = {
  density: number;
  keep: number;
  ink: Ink | null;
  lens: Lens | null;
  lensKey: string;
  width: number;
  live: boolean;
  /** the value of `asked` this surface was last read at, and the reading in hand */
  read: number;
  points: (Rgb | null)[];
  at: number;
  since: number;
  /** where it is read, and the page shape those spots were found for */
  spots: [number, number][];
  shaped: number;
};
type Lens = { svg: SVGSVGElement; id: string; place: (width: number) => void };

/** Any CSS colour to rgba, by asking a canvas. Cached: a page has few colours. */
const parsed = new Map<string, Rgba>();
let pen: CanvasRenderingContext2D | null | undefined;
function colour(css: string): Rgba {
  const hit = parsed.get(css);
  if (hit) return hit;
  if (pen === undefined) pen = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  let out: Rgba = [0, 0, 0, 0];
  if (pen) {
    pen.clearRect(0, 0, 1, 1);
    pen.fillStyle = "#000";
    pen.fillStyle = css;
    pen.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = pen.getImageData(0, 0, 1, 1).data;
    out = [r, g, b, a / 255];
  }
  parsed.set(css, out);
  return out;
}

const COLOUR = /(?:rgba?|hsla?|oklab|oklch|lab|lch|color)\((?:[^()]|\([^()]*\))*\)|#[0-9a-f]{3,8}\b|\btransparent\b/gi;
const over = (top: Rgba, under: Rgba): Rgba => {
  const a = top[3] + under[3] * (1 - top[3]);
  if (!a) return [0, 0, 0, 0];
  const mix = (i: 0 | 1 | 2) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a;
  return [mix(0), mix(1), mix(2), a];
};

/** What one element paints behind its content: its colour (its fill, for a
 *  drawn shape), with each gradient layer flattened to the mean of its stops.
 *  An estimate, and enough of one. */
function paint(el: Element, cache: Map<Element, Rgba>): Rgba {
  const hit = cache.get(el);
  if (hit) return hit;
  const cs = getComputedStyle(el);
  // a drawn shape is its fill; everything else is its background
  const shape = el instanceof SVGGeometryElement;
  let out = shape ? (cs.fill === "none" ? ([0, 0, 0, 0] as const) : colour(cs.fill)) : colour(cs.backgroundColor);
  if (!shape && cs.backgroundImage.includes("gradient(")) {
    const layers: string[] = [];
    let depth = 0;
    let from = 0;
    const image = cs.backgroundImage;
    for (let i = 0; i <= image.length; i++) {
      const c = image[i];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (c === undefined || (c === "," && depth === 0)) {
        layers.push(image.slice(from, i));
        from = i + 1;
      }
    }
    for (const layer of layers.reverse()) {
      const stops = (layer.match(COLOUR) ?? []).map(colour);
      if (!stops.length) continue;
      // a layer that fades to nothing (a stain, a spotlight) covers part of the box, not all of it
      const fades = stops.some((c) => c[3] === 0);
      const alpha = (stops.reduce((s, c) => s + c[3], 0) / stops.length) * (fades ? 0.3 : 1);
      const weight = stops.reduce((s, c) => s + c[3], 0) || 1;
      const mean = (i: 0 | 1 | 2) => stops.reduce((s, c) => s + c[i] * c[3], 0) / weight;
      out = over([mean(0), mean(1), mean(2), alpha], out);
    }
  }
  const opacity = Number.parseFloat(cs.opacity);
  if (opacity < 1) out = [out[0], out[1], out[2], out[3] * opacity];
  cache.set(el, out);
  return out;
}

const UNREADABLE = new Set(["CANVAS", "VIDEO", "IFRAME"]);

/** A hit test skips whatever ignores the pointer, and decorations usually do:
 *  a knob, a marker, a badge. So the children of what was hit are looked at
 *  by hand, three levels down (far enough to reach the shapes of an icon),
 *  and any that sit on the point are painted in. Which children ignore the
 *  pointer is remembered until the page changes shape. */
let ignoring = new WeakMap<Element, Element[]>();
function unseen(el: Element, x: number, y: number, cache: Map<Element, Rgba>, depth = 0): Rgba {
  let acc: Rgba = [0, 0, 0, 0];
  let children = depth ? [...el.children] : ignoring.get(el);
  if (!children) {
    children = el.childElementCount > 16 ? [] : [...el.children].filter((c) => getComputedStyle(c).pointerEvents === "none");
    ignoring.set(el, children);
  }
  for (const child of children.slice(0, 16)) {
    const r = child.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
    if (depth < 2) acc = over(unseen(child, x, y, cache, depth + 1), acc);
    acc = over(acc, paint(child, cache));
  }
  return acc;
}

/** The colour under one point of a surface, or null where the page cannot be
 *  read (a 3D canvas, a video). Light text counts: a line of type under the
 *  glass is a third of its colour, which is roughly what its strokes cover. */
function under(surface: Element, x: number, y: number, cache: Map<Element, Rgba>): Rgb | null {
  const stack = document.elementsFromPoint(x, y);
  let acc: Rgba = [0, 0, 0, 0];
  let first = true;
  let looked = 0;
  for (const el of stack.slice(stack.indexOf(surface) + 1)) {
    if (surface.contains(el)) continue;
    if (UNREADABLE.has(el.tagName)) return acc[3] > 0.6 ? [acc[0], acc[1], acc[2]] : null;
    let layer = paint(el, cache);
    if (first && el.tagName !== "IMG") {
      first = false;
      const typed = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
      if (typed) {
        // only type lighter than its ground counts: dark words on a bright button leave it a bright button
        const ink = colour(getComputedStyle(el).color);
        if (luma([ink[0], ink[1], ink[2]]) > luma([layer[0], layer[1], layer[2]]) * layer[3]) layer = over([ink[0], ink[1], ink[2], ink[3] * 0.33], layer);
      }
    }
    if (looked++ < 3) acc = over(acc, unseen(el, x, y, cache));
    acc = over(acc, layer);
    if (acc[3] >= 0.99) break;
  }
  return [acc[0] * acc[3], acc[1] * acc[3], acc[2] * acc[3]];
}

/** Where a surface is read, as fractions of its box. It starts as a 5 by 3
 *  grid, each point at the centre of its cell so none sits on the rim. Then
 *  the grid is pulled to the labels: each run of text takes the nearest grid
 *  points, a quarter in from either end (a knob covering half a word is
 *  missed from its middle), because a label is where a bright thing slipping
 *  between grid points costs something. */
const GRID = 15;
function spots(surface: HTMLElement, box: DOMRect): [number, number][] {
  const grid: [number, number][] = Array.from({ length: GRID }, (_, i) => [((i % 5) + 0.5) / 5, (Math.floor(i / 5) + 0.5) / 3]);
  const labels: [number, number][] = [];
  const walk = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walk.nextNode(); node && labels.length < 48; node = walk.nextNode()) {
    if (!node.textContent?.trim()) continue;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    for (const f of r.width > 16 ? [0.25, 0.75] : [0.5]) labels.push([(r.left + r.width * f - box.left) / box.width, (r.top + r.height / 2 - box.top) / box.height]);
  }
  // three grid points always stay where they are, so the reading still sees the whole surface
  const taken = new Set<number>();
  const step = Math.max(1, labels.length / (GRID - 3));
  for (let k = 0; k < labels.length && taken.size < GRID - 3; k += step) {
    const [x, y] = labels[Math.floor(k)];
    let best = -1;
    for (let i = 0; i < GRID; i++) {
      if (taken.has(i)) continue;
      if (best < 0 || Math.hypot(grid[i][0] - x, grid[i][1] - y) < Math.hypot(grid[best][0] - x, grid[best][1] - y)) best = i;
    }
    taken.add(best);
    grid[best] = [x, y];
  }
  return grid;
}

/** A hit test is the dear part of a reading and a scroll empties the
 *  browser's cache of them, so a pass takes a few points and a reading takes
 *  several passes. A point off the screen is left out. */
function samplePoints(surface: Element, box: DOMRect, at: readonly [number, number][], from: number, count: number, cache: Map<Element, Rgba>): (Rgb | null)[] {
  const points: (Rgb | null)[] = [];
  for (const [fx, fy] of at.slice(from, from + count)) {
    const x = box.left + box.width * fx;
    const y = box.top + box.height * fy;
    if (x >= 0 && y >= 0 && x < innerWidth && y < innerHeight) points.push(under(surface, x, y, cache));
  }
  return points;
}

/* the lens */

const SVG = "http://www.w3.org/2000/svg";
const tiles = new Map<string, Promise<string>>();
let lensCount = 0;
/** how many map tiles have been drawn; the verify script watches it across a resize */
export const lensBuilds = () => tiles.size;

/** One slice of the displacement map: red is the sideways bend, green the
 *  vertical one, 128 is none. Drawn once per shape and reused. */
function tile(key: string, width: number, height: number, radius: number, rim: number, sides: Rim, x0: number, tileWidth: number): Promise<string> {
  const id = `${key}|${x0 < 0 ? "mid" : x0}|${tileWidth}`;
  let made = tiles.get(id);
  if (!made) {
    const canvas = document.createElement("canvas");
    canvas.width = tileWidth;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    const image = ctx.createImageData(tileWidth, height);
    const max = 1.1 * rim;
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < tileWidth; i++) {
        // the middle slice is one column of the surface's centre line, stretched
        const x = x0 < 0 ? width / 2 : x0 + i + 0.5;
        const [ox, oy] = lensOffset(x, j + 0.5, width, height, radius, rim, x0 < 0 ? { ...sides, left: false, right: false } : sides);
        const o = (j * tileWidth + i) * 4;
        image.data[o] = Math.round(128 + (127 * ox) / max);
        image.data[o + 1] = Math.round(128 + (127 * oy) / max);
        image.data[o + 2] = 128;
        image.data[o + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const url = canvas.toDataURL("image/png");
    // a surface must not be pointed at the filter before its map has decoded, or it draws without its blur
    const probe = new Image();
    probe.src = url;
    made = probe.decode().then(
      () => url,
      () => url,
    );
    tiles.set(id, made);
  }
  return made;
}

/** The filter for one surface: the map in up to three slices (left cap, a
 *  stretched middle, right cap), then the backdrop bent through it three
 *  times, red a little further and blue a little less. A width change moves
 *  the slices; it never redraws them. */
async function buildLens(width: number, height: number, radius: number, sides: Rim, split: number): Promise<Lens> {
  const rim = rimWidth(width, height);
  const max = 1.1 * rim;
  const capped = sides.left || sides.right;
  const cap = capped ? Math.ceil(rim + radius) : 0;
  const key = `${height}|${radius}|${Object.values(sides).map(Number).join("")}|${capped ? width : 0}`;
  const [mid, left, right] = await Promise.all([
    tile(key, width, height, radius, rim, sides, -1, 4),
    capped ? tile(key, width, height, radius, rim, sides, 0, cap) : null,
    capped ? tile(key, width, height, radius, rim, sides, width - cap, cap) : null,
  ]);
  const id = `glass-lens-${++lensCount}`;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("data-glass-lens", "");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;width:0;height:0;pointer-events:none";
  const image = (href: string | null, name: string) => (href ? `<feImage href="${href}" y="0" height="${height}" preserveAspectRatio="none" result="${name}"/>` : "");
  const pass = (scale: number, name: string, keep: string) =>
    `<feDisplacementMap in="SourceGraphic" in2="map" scale="${(2 * max * scale).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="bent${name}"/>` +
    `<feColorMatrix in="bent${name}" type="matrix" values="${keep}" result="${name}"/>`;
  svg.innerHTML =
    `<filter id="${id}" x="0" y="0" height="${height}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
    `<feFlood flood-color="rgb(128,128,128)" result="flat"/>` +
    image(mid, "mid") +
    image(left, "left") +
    image(right, "right") +
    `<feMerge result="map"><feMergeNode in="flat"/><feMergeNode in="mid"/>${left ? '<feMergeNode in="left"/><feMergeNode in="right"/>' : ""}</feMerge>` +
    (split > 0
      ? pass(1 + split, "r", "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0") +
        pass(1, "g", "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0") +
        pass(1 - split, "b", "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0") +
        `<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>`
      : `<feDisplacementMap in="SourceGraphic" in2="map" scale="${(2 * max).toFixed(2)}" xChannelSelector="R" yChannelSelector="G"/>`) +
    `</filter>`;
  const filter = svg.firstElementChild!;
  const [midImage, leftImage, rightImage] = [...filter.querySelectorAll("feImage")];
  const place = (w: number) => {
    filter.setAttribute("width", String(w));
    midImage.setAttribute("x", String(cap));
    midImage.setAttribute("width", String(Math.max(1, w - 2 * cap)));
    leftImage?.setAttribute("x", "0");
    leftImage?.setAttribute("width", String(cap));
    rightImage?.setAttribute("x", String(w - cap));
    rightImage?.setAttribute("width", String(cap));
  };
  place(width);
  document.body.appendChild(svg);
  return { svg, id, place };
}

/** Only Chromium draws url() in backdrop-filter. Firefox parses it and draws nothing. */
const lensSupported = () =>
  typeof CSS !== "undefined" && CSS.supports("backdrop-filter", "url(#a)") && !/firefox/i.test(navigator.userAgent);

/** Menus and animated panels keep the plain glass: on a layer of its own
 *  Chrome can draw the map instead of the bent backdrop. */
function moves(cs: CSSStyleDeclaration): boolean {
  if (cs.willChange !== "auto" || cs.transform !== "none" || cs.animationName !== "none") return true;
  const props = cs.transitionProperty.split(",").map((p) => p.trim());
  const times = cs.transitionDuration.split(",").map((t) => Number.parseFloat(t));
  return props.some((p, i) => (p === "all" || p === "transform" || p === "opacity") && (times[i % times.length] ?? 0) > 0);
}

/** Which edges carry a rim. data-rim says so ("t", "b", "tb"); without it,
 *  an edge that runs off the viewport has none, because the slab carries on. */
function rimSides(el: HTMLElement, box: DOMRect): Rim {
  const said = el.dataset.rim;
  if (said) return { top: said.includes("t"), right: said.includes("r"), bottom: said.includes("b"), left: said.includes("l") };
  const w = document.documentElement.clientWidth;
  return { top: box.top > 0.5, right: box.right < w - 0.5, bottom: box.bottom < innerHeight - 0.5, left: box.left > 0.5 };
}

/**
 * Start the glass. Finds every surface wearing the material, reads what is
 * behind each on scroll, resize and page change, and gives the eligible ones
 * their lens. Returns the function that stops it.
 *
 * `ready` lets the host hold a surface back: a server-rendered element must
 * not be written to before its framework has hydrated it.
 */
export function mountGlass(ready: (surface: HTMLElement) => boolean = () => true): () => void {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof matchMedia !== "function") return () => {};
  const surfaces = new Map<HTMLElement, Surface>();
  const solid = matchMedia("(prefers-reduced-transparency: reduce), (forced-colors: active)");
  const root = document.documentElement;
  root.style.setProperty("--glass-scale", String(glassTint()));

  let frame = 0;
  let asked = 1; // bumped whenever the page may have changed under a surface
  let shape = 1; // bumped when the page itself changed: nodes came or went, or the window was resized
  let pointCost = 0.5; // ms a point has been costing here; a slow page or a slow phone takes fewer a pass
  let timer: ReturnType<typeof setTimeout> | undefined;
  // for scripts/verify-glass.mjs, read-only: what each pass cost, how many map tiles exist, and whether
  // every surface has been read since the page last changed
  const cost: number[] = [];
  const idle = () => ![...surfaces.values()].some((s) => s.read < asked || s.at > 0);
  (window as unknown as { __glass?: object }).__glass = { cost, surfaces, lensBuilds, idle };

  const drop = (el: HTMLElement, s: Surface) => {
    s.lens?.svg.remove();
    el.style.removeProperty("--glass-lens");
    el.style.removeProperty("--glass-density");
    el.style.removeProperty("--glass-keep");
    el.removeAttribute("data-glass-live");
    surfaces.delete(el);
  };

  /** Give a surface its lens, or move the one it has. Cheap unless its shape changed. */
  const lens = (el: HTMLElement, s: Surface, cs: CSSStyleDeclaration, box: DOMRect) => {
    if (!lensSupported() || moves(cs) || box.width < 32 || box.height < 32) return;
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    const radius = Math.min(Number.parseFloat(cs.borderTopLeftRadius) || 0, height / 2, width / 2);
    const sides = rimSides(el, box);
    const key = `${height}|${radius}|${Object.values(sides).map(Number).join("")}|${sides.left || sides.right ? width : 0}`;
    if (key === s.lensKey) {
      // a width change moves the map; it is never redrawn
      if (width !== s.width) s.lens?.place((s.width = width));
      return;
    }
    s.lensKey = key;
    s.width = width;
    const split = Number.parseFloat(cs.getPropertyValue("--glass-split")) || 0;
    void buildLens(width, height, radius, sides, split).then((made) => {
      if (s.lensKey !== key || !surfaces.has(el)) return made.svg.remove();
      s.lens?.svg.remove();
      s.lens = made;
      el.style.setProperty("--glass-lens", `url(#${made.id})`);
    });
  };

  /**
   * One pass: find the surfaces, then read a few points of the backdrop of
   * the one that has waited longest. Every read comes before any write.
   */
  const pass = () => {
    frame = 0;
    const found = new Map<HTMLElement, { cs: CSSStyleDeclaration; box: DOMRect }>();
    let waiting = false;
    for (const el of document.querySelectorAll<HTMLElement>('[class*="glass"]')) {
      const cs = getComputedStyle(el);
      if (cs.getPropertyValue("--glass-on").trim() !== "1") continue;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      if (!ready(el)) waiting = true;
      else found.set(el, { cs, box });
    }
    for (const [el, s] of surfaces) if (!found.has(el) || solid.matches) drop(el, s);
    if (solid.matches) return;
    // the scan above settles the frame's own style and layout, which it owed anyway; what follows is the glass's cost
    const started = performance.now();

    let due: HTMLElement | undefined;
    for (const el of found.keys()) {
      if (!surfaces.has(el)) surfaces.set(el, { density: -1, keep: -1, ink: null, lens: null, lensKey: "", width: 0, live: false, read: 0, points: [], at: 0, since: 0, spots: [], shaped: 0 });
      const s = surfaces.get(el)!;
      // a reading already under way is finished before another surface starts
      if (s.at > 0) due = el;
      else if (s.read < asked && !(due && surfaces.get(due)!.at > 0) && (!due || s.read < surfaces.get(due)!.read)) due = el;
    }
    for (const [el, { cs, box }] of found) lens(el, surfaces.get(el)!, cs, box);
    if (due) {
      const s = surfaces.get(due)!;
      const { cs, box } = found.get(due)!;
      if (s.at === 0) {
        s.since = asked;
        if (s.shaped !== shape) {
          s.spots = spots(due, box);
          s.shaped = shape;
        }
      }
      // about a millisecond of reading a pass: three points where they are cheap, one where they are not
      const take = Math.max(1, Math.min(3, Math.floor(1 / pointCost)));
      const before = performance.now();
      s.points.push(...samplePoints(due, box, s.spots, s.at, take, new Map()));
      pointCost = pointCost * 0.8 + ((performance.now() - before) / take) * 0.2;
      if ((s.at += take) >= GRID) {
        const seen = s.points.filter((c): c is Rgb => c !== null);
        // a backdrop that cannot be read takes the ink from the theme and the dense tint
        const reading = seen.length < 5 || s.points.length - seen.length > 4 ? null : read(seen);
        const still = !moves(cs);
        s.read = s.since;
        s.points = [];
        s.at = 0;
        s.ink = decideInk(reading?.luminance ?? 0, s.ink, currentTheme());
        const d = reading ? density(reading, s.ink, currentTheme()) : 1;
        const keep = reading ? saturationKept(reading) : 1;
        if (Math.abs(d - s.density) > 0.01) due.style.setProperty("--glass-density", (s.density = d).toFixed(3));
        if (Math.abs(keep - s.keep) > 0.01) due.style.setProperty("--glass-keep", (s.keep = keep).toFixed(3));
        // the first reading lands as it is; later ones glide
        if (!s.live && still) {
          s.live = true;
          const el = due;
          requestAnimationFrame(() => el.setAttribute("data-glass-live", ""));
        }
      }
    }
    cost.push(performance.now() - started);
    if (cost.length > 240) cost.shift();
    if ([...surfaces.values()].some((s) => s.read < asked || s.at > 0)) again();
    else if (waiting) timer = setTimeout(again, 100);
  };

  /** a pass a frame, until every surface has been read since the page last changed */
  function again() {
    if (!frame) frame = requestAnimationFrame(pass);
  }
  function schedule() {
    asked++;
    again();
  }
  function reshape() {
    shape++;
    ignoring = new WeakMap();
    schedule();
  }

  const pages = new MutationObserver(reshape);
  pages.observe(document.body, { childList: true, subtree: true });
  const themes = new MutationObserver(() => {
    root.style.setProperty("--glass-scale", String(glassTint()));
    schedule();
  });
  themes.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  addEventListener("scroll", schedule, { passive: true, capture: true });
  addEventListener("resize", reshape, { passive: true });
  solid.addEventListener("change", schedule);
  schedule();

  return () => {
    pages.disconnect();
    themes.disconnect();
    removeEventListener("scroll", schedule, { capture: true });
    removeEventListener("resize", reshape);
    solid.removeEventListener("change", schedule);
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    for (const [el, s] of surfaces) drop(el, s);
  };
}
