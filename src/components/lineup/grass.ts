/**
 * The turf, grown in a canvas. A cylinder mower with a roller bends the
 * grass as it passes, so a stripe cut away from you reflects more light and
 * reads lighter, one cut toward you reads darker; a second pass at ninety
 * degrees puts the Emirates-style checker over the stripes. On top of that:
 * per-blade noise, low-frequency mottling, wear at the goalmouths and the
 * centre circle, a roughness map and a normal map from the same field.
 *
 * Pure canvas + typed arrays, no three; the scene wraps the results.
 */
export type TurfMaps = {
  color: HTMLCanvasElement;
  roughness: HTMLCanvasElement;
  normal: HTMLCanvasElement;
};

type RGB = [number, number, number];

function hex(css: string): RGB {
  const m = css.trim().match(/^#([0-9a-f]{6})/i);
  if (!m) return [22, 58, 38];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** deterministic hash noise in [0,1) */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** bilinear value noise at a given cell size */
function value(x: number, y: number, cell: number, seed: number): number {
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

export type TurfOptions = {
  /** texture size; the pitch is longer than it is wide so the canvas is too */
  width?: number;
  height?: number;
  /** the two greens the roller produces */
  light: string;
  dark: string;
  /** mow stripes along the length, and the cross pass */
  stripes?: number;
  crossStripes?: number;
  /** 0..1 strength of the cross pass against the main pass */
  cross?: number;
};

export function growTurf(opts: TurfOptions): TurfMaps {
  const W = opts.width ?? 1024;
  const H = opts.height ?? 1536;
  const stripes = opts.stripes ?? 16;
  const crossStripes = opts.crossStripes ?? 12;
  const cross = opts.cross ?? 0.45;
  const light = hex(opts.light);
  const dark = hex(opts.dark);

  const color = document.createElement("canvas");
  color.width = W;
  color.height = H;
  const rough = document.createElement("canvas");
  rough.width = W;
  rough.height = H;
  const normal = document.createElement("canvas");
  normal.width = W;
  normal.height = H;

  const cctx = color.getContext("2d")!;
  const rctx = rough.getContext("2d")!;
  const nctx = normal.getContext("2d")!;
  const cimg = cctx.createImageData(W, H);
  const rimg = rctx.createImageData(W, H);
  const nimg = nctx.createImageData(W, H);
  const cd = cimg.data;
  const rd = rimg.data;
  const nd = nimg.data;

  // height field for the normal map, from the blade noise
  const height = new Float32Array(W * H);

  const stripeH = H / stripes;
  const crossW = W / crossStripes;
  for (let y = 0; y < H; y += 1) {
    const stripeSign = Math.floor(y / stripeH) % 2 === 0 ? 1 : -1;
    // stripe edges are a little soft: the roller does not draw a hard line
    const inStripe = (y % stripeH) / stripeH;
    const edge = Math.min(inStripe, 1 - inStripe) * stripeH;
    const stripeSoft = Math.min(1, edge / 3);
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const crossSign = Math.floor(x / crossW) % 2 === 0 ? 1 : -1;
      const inCross = (x % crossW) / crossW;
      const cedge = Math.min(inCross, 1 - inCross) * crossW;
      const crossSoft = Math.min(1, cedge / 3);

      // reflectance from the two mowing passes
      const mow = 0.5 + 0.5 * stripeSign * stripeSoft * 0.42 + 0.5 * crossSign * crossSoft * 0.42 * cross;

      // blades: fine noise plus a slightly coarser one so it does not read as static
      const blade = value(x, y, 1.6, 1) * 0.55 + value(x, y, 3.2, 2) * 0.3 + hash(x, y, 3) * 0.15;
      // mottling: patches of thicker and thinner growth
      const mottle = value(x, y, 64, 4) * 0.6 + value(x, y, 200, 5) * 0.4;

      // wear: the goalmouths and the centre circle get brown
      const u = x / W - 0.5;
      const v = y / H - 0.5;
      const goalTop = Math.exp(-((u * u) / 0.02 + ((v + 0.44) * (v + 0.44)) / 0.0025));
      const goalBottom = Math.exp(-((u * u) / 0.02 + ((v - 0.44) * (v - 0.44)) / 0.0025));
      const centre = Math.exp(-((u * u) / 0.004 + (v * v) / 0.0022));
      const wear = Math.min(1, (goalTop + goalBottom) * 0.55 + centre * 0.35) * (0.5 + 0.5 * mottle);

      const t = Math.max(0, Math.min(1, mow + (blade - 0.5) * 0.28 + (mottle - 0.5) * 0.14));
      let r = dark[0] + (light[0] - dark[0]) * t;
      let g = dark[1] + (light[1] - dark[1]) * t;
      let b = dark[2] + (light[2] - dark[2]) * t;
      // wear pulls toward a dry earth tone
      r = r + (92 - r) * wear * 0.6;
      g = g + (74 - g) * wear * 0.6;
      b = b + (44 - b) * wear * 0.6;

      const o = i * 4;
      cd[o] = r;
      cd[o + 1] = g;
      cd[o + 2] = b;
      cd[o + 3] = 255;

      // roughness: worn and dark blades are rougher; the lit stripe has a sheen
      const rv = 0.78 + 0.16 * (1 - t) + 0.08 * wear - 0.06 * (blade - 0.5);
      const rb = Math.max(0, Math.min(255, rv * 255));
      rd[o] = rb;
      rd[o + 1] = rb;
      rd[o + 2] = rb;
      rd[o + 3] = 255;

      height[i] = blade * 0.7 + mottle * 0.3;
    }
  }

  // normal map from the height field (Sobel), tangent space, y up in the image
  const strength = 2.2;
  for (let y = 0; y < H; y += 1) {
    const ym = (y - 1 + H) % H;
    const yp = (y + 1) % H;
    for (let x = 0; x < W; x += 1) {
      const xm = (x - 1 + W) % W;
      const xp = (x + 1) % W;
      const tl = height[ym * W + xm];
      const t = height[ym * W + x];
      const tr = height[ym * W + xp];
      const l = height[y * W + xm];
      const rgt = height[y * W + xp];
      const bl = height[yp * W + xm];
      const bt = height[yp * W + x];
      const br = height[yp * W + xp];
      const dx = (tr + 2 * rgt + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * bt + br - (tl + 2 * t + tr)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const o = (y * W + x) * 4;
      nd[o] = ((-dx / len) * 0.5 + 0.5) * 255;
      nd[o + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      nd[o + 2] = (1 / len) * 255;
      nd[o + 3] = 255;
    }
  }

  cctx.putImageData(cimg, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  nctx.putImageData(nimg, 0, 0);
  return { color, roughness: rough, normal };
}
