#!/usr/bin/env node
/**
 * The glass, measured. Headless Chromium against a running app; every number
 * in the budget of docs/plans/2026-11-05-liquid-glass.md comes out of here.
 *
 *   BASE_URL=http://localhost:3100 node scripts/verify-glass.mjs
 *   node scripts/verify-glass.mjs --fingerprint before.json     # on main
 *   node scripts/verify-glass.mjs --compare before.json         # on the branch
 *
 * It reads real pixels, not the stylesheet: a label's contrast is the ink the
 * browser drew against the backdrop the browser drew, at every scroll stop.
 * Exit code 1 if any budget line fails.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

/* ── the app ────────────────────────────────────────────────────────────── */

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const APP = {
  name: "injury time",
  module: "src/lib/glass.ts",
  brightest: "#eef2ee", // the brightest thing the product can put under a bar: its own ink
  cookies: [{ name: "it.club", value: "kilburn-athletic", domain: new URL(BASE).hostname, path: "/" }],
  phone: { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  /** every screen in the layout fingerprint */
  screens: {
    hub: "/", squad: "/squad", team: "/team", stats: "/stats", review: "/review", club: "/club", film: "/film",
    log: "/log", matchday: "/matchday", player: "/player/0000000b-0000-4000-8000-000000000001", pilot: "/pilot/belstone", login: "/login",
  },
  open: async (page, path) => {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90_000 }).catch(() => {});
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.waitForTimeout(1200);
  },
  /** where the glass is swept for contrast: [view, screen, scroll stops, a step to take first, a name, context options] */
  sweeps: [
    ["phone", "squad", [0, 160, 320, 480, 640, 800, 960, 1120, 1280]],
    ["phone", "hub", [0, 200, 400, 600, 800, 1000, 1200]],
    ["phone", "log", [0, 150, 300, 450, 600]],
    ["phone", "team", [0, 250, 500, 750]],
    // the install prompt only shows on an iPhone that has not put the app on its home screen
    ["phone", "squad", [640], null, "install", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" }],
    ["desk", "squad", [0, 200, 400, 600, 800]],
    ["desk", "hub", [0, 300, 600, 900]],
  ],
  /** the surface and screen the lens, see-through, setting and fallback checks run on */
  probe: { view: "phone", screen: "squad", surface: "nav.tabbar", scroll: 640 },
};

/* ── pixels ─────────────────────────────────────────────────────────────── */

const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

/** A screenshot as RGBA. Chromium writes plain 8-bit PNGs, so this reads them without a dependency. */
function decodePng(buf) {
  let at = 8, width = 0, height = 0, type = 6;
  const idat = [];
  while (at < buf.length) {
    const size = buf.readUInt32BE(at);
    const name = buf.toString("ascii", at + 4, at + 8);
    if (name === "IHDR") [width, height, type] = [buf.readUInt32BE(at + 8), buf.readUInt32BE(at + 12), buf[at + 17]];
    if (name === "IDAT") idat.push(buf.subarray(at + 8, at + 8 + size));
    at += 12 + size;
  }
  const bpp = type === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const data = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const predict = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      out[i] = (row[i] + predict) & 255;
    }
    for (let x = 0; x < width; x++) {
      data[(y * width + x) * 4] = out[x * bpp];
      data[(y * width + x) * 4 + 1] = out[x * bpp + 1];
      data[(y * width + x) * 4 + 2] = out[x * bpp + 2];
      data[(y * width + x) * 4 + 3] = 255;
    }
    prev = out;
  }
  return { width, height, data };
}
const pixels = async (page, clip) => decodePng(await page.screenshot({ clip }));
const lums = (img, x0, y0, w, h) => {
  const out = [];
  for (let y = Math.max(0, y0); y < Math.min(img.height, y0 + h); y++)
    for (let x = Math.max(0, x0); x < Math.min(img.width, x0 + w); x++) {
      const o = (y * img.width + x) * 4;
      out.push(L(img.data[o], img.data[o + 1], img.data[o + 2]));
    }
  return out.sort((a, b) => a - b);
};
/** mean difference between two captures over a band, and how many of its pixels moved by more than rounding */
const meanDiff = (a, b, x0, y0, w, h) => {
  let sum = 0, n = 0, moved = 0;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const o = (y * a.width + x) * 4;
      const d = [0, 1, 2].map((i) => Math.abs(a.data[o + i] - b.data[o + i]));
      sum += (d[0] + d[1] + d[2]) / 3;
      if (Math.max(...d) > 2) moved++;
      n++;
    }
  return { mean: sum / n, moved: moved / n };
};

/* ── in-page helpers ────────────────────────────────────────────────────── */

const surfacesOf = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[class*="glass"]')]
      .filter((el) => getComputedStyle(el).getPropertyValue("--glass-on").trim() === "1" && el.getBoundingClientRect().height > 0)
      .map((el, i) => {
        el.setAttribute("data-verify", String(i));
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          i,
          name: `${(el.getAttribute("role") === "dialog" ? "dialog" : el.getAttribute("aria-label")) ?? el.className.split(" ").find((c) => c !== "glass") ?? el.tagName.toLowerCase()} ${r.top + r.height / 2 < innerHeight / 2 ? "top" : "foot"}`,
          box: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(innerWidth, r.right) - Math.max(0, r.x), height: Math.min(innerHeight, r.bottom) - Math.max(0, r.y) },
          size: [Math.round(r.width), Math.round(r.height)],
          backdrop: cs.backdropFilter,
          background: cs.backgroundColor,
          shadow: cs.boxShadow !== "none",
          lens: el.style.getPropertyValue("--glass-lens"),
          density: Number(el.style.getPropertyValue("--glass-density") || 1),
          moves: cs.willChange !== "auto" || cs.transform !== "none" || /transform|opacity|all/.test(cs.transitionProperty) && Number.parseFloat(cs.transitionDuration) > 0,
        };
      }),
  );

/** every visible run of text drawn on a surface, with the box of its glyphs */
const labelsOf = (page, i) =>
  page.evaluate((i) => {
    const el = document.querySelector(`[data-verify="${i}"]`);
    const host = el.getBoundingClientRect();
    const out = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const text = n.textContent.trim();
      const parent = n.parentElement;
      if (!text || !parent) continue;
      const cs = getComputedStyle(parent);
      // separators and bullets are not words, and a disabled control is not held to contrast
      if (!/[\p{L}\p{N}]/u.test(text) || cs.visibility === "hidden" || parent.closest(".sr-only,[disabled],option,select")) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      // a label under a sheet or a scrim is not being read through this glass
      if (!el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))) continue;
      out.push({ text: text.slice(0, 22), x: r.x - host.x, y: r.y - host.y, w: r.width, h: r.height, px: Number.parseFloat(cs.fontSize) });
    }
    return out;
  }, i);

const HIDE_INK = `[data-verify] *{color:transparent!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important}[data-verify] svg{visibility:hidden!important}`;

/** The settled state: every surface read since the page last moved, then the 320ms glide. A page that
 *  draws slowly (a 3D pitch in headless Chromium) takes longer to read, so this waits rather than guesses. */
async function settle(page) {
  await page.waitForFunction(() => window.__glass?.idle(), null, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(450);
}

/** every surface met during the sweep, for the checks that need all of them */
const seen = [];

/** contrast of every label on every surface, as drawn */
async function contrastHere(page) {
  const found = [];
  for (const s of await surfacesOf(page)) {
    seen.push(s);
    if (s.box.width < 8 || s.box.height < 8) continue;
    const labels = await labelsOf(page, s.i);
    if (!labels.length) continue;
    const inked = await pixels(page, s.box);
    const tag = await page.addStyleTag({ content: HIDE_INK });
    const bare = await pixels(page, s.box);
    await tag.evaluate((t) => t.remove());
    const k = inked.width / s.box.width;
    for (const l of labels) {
      const [x, y, w, h] = [Math.floor(l.x * k), Math.floor(l.y * k), Math.ceil(l.w * k), Math.ceil(l.h * k)];
      const back = lums(bare, x, y, w, h);
      const ink = lums(inked, x, y, w, h);
      if (back.length < 16) continue;
      const light = pct(ink, 0.99) - pct(back, 0.5) > pct(back, 0.5) - pct(ink, 0.01);
      // the glyph cores against the worst tenth of what is behind them
      const c = light ? ratio(pct(ink, 0.985), pct(back, 0.9)) : ratio(pct(ink, 0.015), pct(back, 0.1));
      found.push({ surface: s.name, text: l.text, contrast: c, density: s.density });
    }
  }
  return found;
}

/* ── the checks ─────────────────────────────────────────────────────────── */

const results = [];
const line = (metric, target, measured, ok) => results.push({ metric, target, measured, ok });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const context = async (view, extra = {}) => {
  const ctx = await browser.newContext({ ...APP[view], ...extra });
  if (APP.cookies) await ctx.addCookies(APP.cookies);
  return ctx;
};

const FREEZE = "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}";
async function fingerprint() {
  const out = {};
  for (const view of ["phone", "desk"]) {
    const ctx = await context(view, { deviceScaleFactor: 1 });
    for (const [name, path] of Object.entries(APP.screens)) {
      const page = await ctx.newPage();
      await APP.open(page, path);
      await page.addStyleTag({ content: FREEZE });
      await page.waitForTimeout(250);
      out[`${view}/${name}`] = await page.evaluate(() => {
        const rows = {};
        const skip = "[data-glass-setting],svg[data-glass-lens],nextjs-portal,script,style,link,next-route-announcer,body > label";
        const path = (el) => {
          const s = [];
          for (let e = el; e && e !== document.body; e = e.parentElement)
            s.push(e.tagName.toLowerCase() + ":" + [...e.parentElement.children].filter((c) => c.tagName === e.tagName && !c.matches("[data-glass-setting]")).indexOf(e));
          return s.reverse().join("/");
        };
        for (const el of document.body.querySelectorAll("*")) {
          if (el.closest(skip)) continue;
          const stage = el.closest("div:has(> div > canvas)");
          if (stage && stage !== el) continue;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("|");
          // an ancestor of the new setting is allowed to grow by it; everything else is held to its box
          const box = [r.x, r.y, r.width, el.querySelector("[data-glass-setting]") ? "grows" : r.height].map((v) => (typeof v === "number" ? Math.round(v * 2) / 2 : v));
          rows[path(el)] = box.concat(cs.fontFamily.slice(0, 40), cs.fontSize, cs.fontWeight, cs.borderRadius, cs.padding, own).join(";");
        }
        return rows;
      });
      await page.close();
    }
    await ctx.close();
  }
  return out;
}

const arg = (flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : null);
if (arg("--fingerprint")) {
  fs.writeFileSync(arg("--fingerprint"), JSON.stringify(await fingerprint()));
  console.log(`layout fingerprint written to ${arg("--fingerprint")}`);
  await browser.close();
  process.exit(0);
}

console.log(`\nglass · ${APP.name} · ${BASE}\n`);

/* 1. the contrast sweep: scroll stop by surface */
if (!process.argv.includes("--no-sweep")) {
  let worst = { contrast: Infinity };
  const columns = [];
  const rows = [];
  for (const [view, screen, stops, before, tag, extra] of APP.sweeps) {
    if (arg("--sweep") && arg("--sweep") !== (tag ?? screen)) continue;
    const ctx = await context(view, extra);
    const page = await ctx.newPage();
    await APP.open(page, APP.screens[screen]);
    for (const y of stops) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(250);
      if (before) await before(page);
      await settle(page);
      const cells = {};
      for (const f of await contrastHere(page)) {
        if (!columns.includes(f.surface)) columns.push(f.surface);
        if (!cells[f.surface] || f.contrast < cells[f.surface].contrast) cells[f.surface] = f;
        if (f.contrast < worst.contrast) worst = { ...f, where: `${view} ${tag ?? screen} @${y}` };
      }
      rows.push({ where: `${view} ${tag ?? screen} @${y}`, cells });
    }
    await ctx.close();
  }
  const mark = (c) => (c === undefined ? " ·  " : c >= 7 ? " ## " : c >= 4.5 ? " +  " : " !! ");
  console.log("contrast of the worst label on each surface, by scroll stop   (## 7:1 and up   + 4.5:1 and up   !! under   · not on screen)");
  console.log("".padEnd(24) + columns.map((c) => c.slice(0, 14).padEnd(16)).join(""));
  for (const r of rows)
    console.log(r.where.padEnd(24) + columns.map((c) => (mark(r.cells[c]?.contrast) + (r.cells[c] ? r.cells[c].contrast.toFixed(1).padStart(4) + ` d${r.cells[c].density.toFixed(2)}` : "")).padEnd(16)).join(""));
  line("text contrast on glass, worst label, scroll sweep", ">= 4.5:1", `${worst.contrast.toFixed(2)}:1  ("${worst.text}" on ${worst.surface}, ${worst.where})`, worst.contrast >= 4.5);
}

/* 2. the probe surface: material, lens, see-through, setting, fallbacks, cost */
{
  const { view, screen, surface, scroll } = APP.probe;
  const ctx = await context(view);
  const page = await ctx.newPage();
  await APP.open(page, APP.screens[screen]);
  await page.evaluate((v) => window.scrollTo(0, v), scroll);
  await page.waitForTimeout(150);
  await settle(page);
  const all = await surfacesOf(page);
  const at = await page.evaluate((sel) => Number(document.querySelector(sel)?.getAttribute("data-verify")), surface);
  const probe = all.find((x) => x.i === at);

  const material = all.every((x) => /blur\(.+saturate\(.+brightness\(/.test(x.backdrop) && x.shadow && /\/ 0\.\d+\)|rgba\(.+, 0\.\d+\)/.test(x.background));
  line("surfaces wearing the material (tint, filter, edge, ink)", "all", `${all.filter((x) => /blur/.test(x.backdrop)).length} of ${all.length} on ${view} ${screen}`, material);

  // lens: only the rim bends. Stripes go under the surface, the glass is held thin, and the surface is
  // compared with its lens on and with it taken away.
  const supported = await page.evaluate(() => CSS.supports("backdrop-filter", "url(#a)"));
  const slide = (background) =>
    page.evaluate(([sel, background]) => {
      document.getElementById("verify-slab")?.remove();
      if (!background) return;
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      const slab = document.createElement("div");
      slab.id = "verify-slab";
      slab.style.cssText = `position:fixed;left:0;top:${r.top - 40}px;width:100vw;height:${r.height + 80}px;background:${background};z-index:${(Number(getComputedStyle(el).zIndex) || 1) - 1}`;
      document.body.appendChild(slab);
      window.dispatchEvent(new Event("scroll"));
    }, [surface, background]);
  const hold = (d) => page.addStyleTag({ content: `${surface}{--glass-density:${d}!important}` });
  const inkOff = await page.addStyleTag({ content: HIDE_INK });
  const thin = await hold(0);
  await slide(`repeating-linear-gradient(60deg, ${APP.brightest} 0 22px, #000 22px 44px)`);
  await page.waitForTimeout(500);
  const on = await pixels(page, probe.box);
  await page.evaluate((sel) => document.querySelector(sel).style.setProperty("--glass-lens", " "), surface);
  await page.waitForTimeout(150);
  const off = await pixels(page, probe.box);
  await page.evaluate(([sel, v]) => document.querySelector(sel).style.setProperty("--glass-lens", v), [surface, probe.lens]);
  await thin.evaluate((t) => t.remove());
  const k = on.width / probe.box.width;
  const rim = Math.max(4, Math.min(44, Math.min(...probe.size) / 3.5));
  const rimShift = meanDiff(on, off, 0, 1, on.width, Math.round(rim * 0.5 * k));
  const centreShift = meanDiff(on, off, 0, Math.round(on.height / 2 - 2 * k), on.width, Math.round(4 * k));
  line("lens, rim band over a striped backdrop, on vs off", ">= 8/255 mean shift", `${rimShift.mean.toFixed(1)}/255`, supported && rimShift.mean >= 8);
  // "128 is none" is 0.2% short of none, so the middle sits about a tenth of a pixel off; over hard stripes
  // that shows as a fraction of a level
  line("lens, centre of surface, on vs off", "<= 0.5/255", `${centreShift.mean.toFixed(2)}/255 (${(centreShift.moved * 100).toFixed(1)}% of pixels by more than 2 levels)`, centreShift.mean <= 0.5);
  const lensless = seen.filter((x) => x.moves || x.size[0] < 32 || x.size[1] < 32);
  const lensed = new Set(seen.filter((x) => x.lens).map((x) => x.name));
  line("lens kept off animated and small surfaces", "0 with a lens", `${lensless.filter((x) => x.lens).length} of ${new Set(lensless.map((x) => x.name)).size} such; ${lensed.size} surfaces lensed`, lensless.every((x) => !x.lens));

  // a width change moves the map and never redraws it
  const before = await page.evaluate(() => window.__glass.lensBuilds());
  for (const w of [360, 412, 430, APP.phone.viewport.width]) {
    await page.setViewportSize({ width: w, height: APP[view].viewport.height });
    await page.waitForTimeout(350);
  }
  const after = await page.evaluate(() => window.__glass.lensBuilds());
  line("lens map tiles drawn across four width changes", "0", String(after - before), after === before);

  // see-through and contrast with the brightest thing the product has slid under the surface, then black
  // with the density held where the brightest put it, so the pair spans the dense end
  const through = async (colour) => {
    await slide(colour);
    await page.waitForTimeout(150);
    await settle(page);
    // the whole surface is captured and the middle band read from it: a capture that cuts
    // through a surface drops its backdrop filter, which is the capture's doing and not the page's
    const img = await pixels(page, probe.box);
    let v = 0, n = 0;
    for (let y = Math.round(img.height * 0.4); y < img.height * 0.6; y++)
      for (let x = 0; x < img.width; x++, n++) {
        const o = (y * img.width + x) * 4;
        v += (img.data[o] + img.data[o + 1] + img.data[o + 2]) / 3;
      }
    return v / n;
  };
  const raw = (hex) => [1, 3, 5].reduce((sum, i) => sum + Number.parseInt(hex.slice(i, i + 2), 16), 0) / 3;
  const bright = await through(APP.brightest);
  await inkOff.evaluate((t) => t.remove());
  await page.waitForTimeout(100);
  const overBright = Math.min(...(await contrastHere(page)).filter((f) => f.surface === probe.name).map((f) => f.contrast));
  const dense = (await surfacesOf(page)).find((x) => x.name === probe.name).density;
  const inkOffAgain = await page.addStyleTag({ content: HIDE_INK });
  const held = await hold(dense);
  const dark = await through("#000000");
  await held.evaluate((t) => t.remove());
  await inkOffAgain.evaluate((t) => t.remove());
  await slide(null);
  const seeThrough = (bright - dark) / raw(APP.brightest);
  line(`contrast with ${APP.brightest} slid under the bar`, ">= 4.5:1", `${overBright.toFixed(2)}:1 at density ${dense.toFixed(2)}`, overBright >= 4.5);
  line("see-through left at the dense end", ">= 20% of backdrop range", `${(seeThrough * 100).toFixed(1)}%`, seeThrough >= 0.2);

  // the setting
  const style = (sel) => page.evaluate((sel) => { const cs = getComputedStyle(document.querySelector(sel)); return { bg: cs.backgroundColor, bf: cs.backdropFilter }; }, sel);
  const alpha = (bg) => Number(/\/ ([\d.]+)\)$/.exec(bg)?.[1] ?? /^rgba\(.+, ([\d.]+)\)$/.exec(bg)?.[1] ?? 1);
  const set = async (v) => {
    await page.evaluate((v) => { localStorage.setItem("glass.tint.dark", String(v)); document.documentElement.style.setProperty("--glass-scale", String(v)); }, v);
    await page.waitForTimeout(500);
    return style(surface);
  };
  // the density is held still, so the three readings differ by the setting alone
  const steady = await hold(1);
  const one = await set(1);
  const zero = await set(0);
  const more = await set(1.5);
  await steady.evaluate((t) => t.remove());
  const zeroOk = alpha(zero.bg) === 0 && /brightness\(1\)/.test(zero.bf) && /blur\(\d+px\)/.test(zero.bf);
  line("tint setting at 0", "tint 0, dim off, blur and rim left", `tint ${alpha(zero.bg)}, ${/brightness\([\d.]+\)/.exec(zero.bf)?.[0]}`, zeroOk);
  line("tint setting at 1.5", "1.5x the tint", `${(alpha(more.bg) / alpha(one.bg)).toFixed(2)}x`, Math.abs(alpha(more.bg) / alpha(one.bg) - 1.5) < 0.03);
  await page.evaluate(() => localStorage.setItem("glass.tint.dark", "0.6"));
  await APP.open(page, APP.screens[screen]);
  const kept = await page.evaluate(() => document.documentElement.style.getPropertyValue("--glass-scale"));
  line("tint setting after a reload", "0.6", kept, kept === "0.6");
  await page.evaluate(() => localStorage.removeItem("glass.tint.dark"));

  // sampler cost, warm, across a scroll
  await APP.open(page, APP.screens[screen]);
  for (let round = 0; round < 2; round++) {
    await page.evaluate(() => { window.__glass.cost.length = 0; });
    for (let y = 0; y < 2400; y += 40) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(40);
    }
  }
  const cost = await page.evaluate(() => [...window.__glass.cost].sort((a, b) => a - b));
  line("backdrop sampler, p95 per pass", "<= 1.5 ms", `${pct(cost, 0.95).toFixed(2)} ms (p50 ${pct(cost, 0.5).toFixed(2)}, ${cost.length} passes)`, pct(cost, 0.95) <= 1.5);
  await ctx.close();

  // fallbacks: asked for less transparency, and a forced palette
  for (const [label, extra, media] of [["reduced transparency", {}, [{ name: "prefers-reduced-transparency", value: "reduce" }]], ["forced colours", { forcedColors: "active" }, null]]) {
    const c = await context(view, extra);
    const p = await c.newPage();
    if (media) await (await c.newCDPSession(p)).send("Emulation.setEmulatedMedia", { features: media });
    await APP.open(p, APP.screens[screen]);
    const got = await p.evaluate((sel) => { const el = document.querySelector(sel); const cs = getComputedStyle(el); return { bf: cs.backdropFilter, bg: cs.backgroundColor, lens: el.style.getPropertyValue("--glass-lens") }; }, surface);
    line(`${label}: the surface is solid`, "no backdrop-filter, alpha 1.0", `${got.bf}, alpha ${alpha(got.bg)}${got.lens ? ", lens set" : ""}`, got.bf === "none" && alpha(got.bg) === 1 && !got.lens);
    await c.close();
  }
}

/* 3. layout */
if (arg("--compare")) {
  const was = JSON.parse(fs.readFileSync(arg("--compare"), "utf8"));
  const now = await fingerprint();
  let nodes = 0, changed = 0, removed = 0;
  const examples = [];
  for (const [screen, rows] of Object.entries(was))
    for (const [path, value] of Object.entries(rows)) {
      nodes++;
      const after = now[screen]?.[path];
      // "3 hours ago" moves on between two runs, and a box that holds the new setting may grow
      const calm = (row, grows) => row.replace(/\d+ (second|minute|hour|day)s? ago/g, "a while ago").split(";").map((v, i) => (i === 3 && grows ? "grows" : v));
      // box values are held to half a pixel: a word's measured width wobbles by that much between two loads of the same page
      const settle = (row, grows) => calm(row, grows).slice(4).join(";");
      const near = (a, b, grows) => calm(a, grows).slice(0, 4).every((v, i) => v === calm(b, grows)[i] || Math.abs(Number(v) - Number(calm(b, grows)[i])) <= 0.5);
      const grows = after?.split(";")[3] === "grows";
      if (after === undefined) {
        removed++;
        examples.push(`${screen} removed ${path}`);
      } else if (settle(after, grows) !== settle(value, grows) || !near(after, value, grows)) {
        changed++;
        examples.push(`${screen} changed ${path}\n      was ${value}\n      now ${after}`);
      }
    }
  line(`layout fingerprint, ${Object.keys(was).length} screens, ${nodes} nodes`, "0 changed, 0 removed", `${changed} changed, ${removed} removed`, changed + removed === 0);
  if (examples.length) console.log("\n" + examples.slice(0, 12).join("\n"));
}

/* 4. what ships */
try {
  const esbuild = require.resolve("esbuild/bin/esbuild");
  const min = execFileSync(esbuild, [APP.module, "--bundle", "--minify", "--format=esm", "--target=es2022"], { maxBuffer: 1 << 24 });
  const gz = zlib.gzipSync(min).length;
  line("glass JS shipped, minified + gzip", "<= 4 kB", `${(gz / 1024).toFixed(2)} kB`, gz <= 4096);
} catch {
  line("glass JS shipped, minified + gzip", "<= 4 kB", "not measured (esbuild not found)", true);
}

await browser.close();
console.log("\n" + "metric".padEnd(58) + "target".padEnd(36) + "measured");
for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.metric.padEnd(53)} ${r.target.padEnd(35)} ${r.measured}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} line${failed === 1 ? "" : "s"} over budget` : "\nevery line inside the budget");
process.exit(failed ? 1 : 0);
