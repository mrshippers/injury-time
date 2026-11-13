import { describe, expect, it } from "vitest";

import { bend, decideInk, density, lensOffset, luma, read, rimWidth, saturationKept, type Rgb, type Rim } from "../../src/lib/glass";

const grey = (v: number): Rgb => [v, v, v];
const all: Rim = { top: true, right: true, bottom: true, left: true };

describe("reading the backdrop", () => {
  it("weighs brightness the way the eye does", () => {
    expect(luma([255, 255, 255])).toBeCloseTo(1);
    expect(luma([0, 0, 0])).toBe(0);
    expect(luma([0, 255, 0])).toBeCloseTo(0.587);
    expect(luma([255, 0, 0])).toBeCloseTo(0.299);
  });

  it("drops the two darkest and the two brightest of fifteen before averaging", () => {
    const samples = [grey(0), grey(0), ...Array.from({ length: 11 }, () => grey(100)), grey(255), grey(255)];
    const r = read(samples);
    expect(r.luminance).toBeCloseTo(100 / 255);
    expect(r.texture).toBe(0);
    expect(r.chroma).toBe(0);
  });

  it("keeps the brightest sample as the peak even when the mean drops it", () => {
    const samples = [...Array.from({ length: 14 }, () => grey(10)), grey(240)];
    expect(read(samples).peak).toBeCloseTo(240 / 255);
    expect(read(samples).luminance).toBeCloseTo(10 / 255);
  });

  it("calls a busy backdrop textured and a coloured one chromatic", () => {
    const busy = read([...Array.from({ length: 8 }, () => grey(20)), ...Array.from({ length: 7 }, () => grey(220))]);
    expect(busy.texture).toBeCloseTo(200 / 255);
    const mint = read(Array.from({ length: 15 }, (): Rgb => [149, 236, 200]));
    expect(mint.chroma).toBeCloseTo((236 - 149) / 255);
    expect(mint.texture).toBe(0);
  });

  it("averages what it is given when there are too few samples to trim", () => {
    expect(read([grey(50), grey(150)]).luminance).toBeCloseTo(100 / 255);
  });
});

describe("choosing the ink", () => {
  it("is always light text in a dark theme", () => {
    expect(decideInk(0.9, null, "dark")).toBe("light");
    expect(decideInk(0.9, "dark", "dark")).toBe("light");
  });
  it("flips at half brightness in a light theme", () => {
    expect(decideInk(0.3, null, "light")).toBe("light");
    expect(decideInk(0.7, null, "light")).toBe("dark");
  });
  it("holds the ink it has within 0.05 of the line, so a surface never flickers", () => {
    expect(decideInk(0.53, "light", "light")).toBe("light");
    expect(decideInk(0.47, "dark", "light")).toBe("dark");
    expect(decideInk(0.56, "light", "light")).toBe("dark");
    expect(decideInk(0.44, "dark", "light")).toBe("light");
  });
});

describe("density", () => {
  const flat = (v: number) => read(Array.from({ length: 15 }, () => grey(v)));

  it("is the material's own rule in a theme whose ink can flip", () => {
    const r = { luminance: 0.3, texture: 0.2, chroma: 0.1, peak: 0.9 };
    expect(density(r, "light", "light")).toBeCloseTo(0.55 * (1 - Math.abs(0.3 - 0.94)) + 0.7 * 0.2 + 0.3 * 0.1);
  });
  it("stays thin over the dark ground and goes dense when something bright slides under light text", () => {
    expect(density(flat(9), "light", "dark")).toBeLessThan(0.15);
    expect(density(flat(236), "light", "dark")).toBe(1);
  });
  it("rises with the peak and never falls as the backdrop brightens", () => {
    let last = 0;
    for (let v = 0; v <= 255; v += 5) {
      const d = density(flat(v), "light", "dark");
      expect(d).toBeGreaterThanOrEqual(last - 1e-9);
      expect(d).toBeLessThanOrEqual(1);
      last = d;
    }
  });
  it("goes dense for one bright button under an otherwise dark bar", () => {
    const r = read([...Array.from({ length: 14 }, () => grey(9)), [149, 236, 200] as Rgb]);
    expect(density(r, "light", "dark")).toBeGreaterThan(0.9);
  });
  it("keeps less of a vivid backdrop's saturation, down to 0.45", () => {
    expect(saturationKept({ luminance: 0, texture: 0, chroma: 0, peak: 0 })).toBe(1);
    expect(saturationKept({ luminance: 0, texture: 0, chroma: 0.4, peak: 0 })).toBeCloseTo(0.7);
    expect(saturationKept({ luminance: 0, texture: 0, chroma: 1, peak: 0 })).toBe(0.45);
  });
});

describe("the rim lens", () => {
  it("is 44px on a card and a third and a bit of the short side below that, never under 4", () => {
    expect(rimWidth(400, 300)).toBe(44);
    expect(rimWidth(393, 60)).toBeCloseTo(60 / 3.5);
    expect(rimWidth(8, 8)).toBe(4);
  });
  it("bends hardest at the edge and not at all at the rim's inner edge", () => {
    expect(bend(0, 44)).toBeCloseTo(1.1 * 44);
    expect(bend(44, 44)).toBe(0);
    expect(bend(60, 44)).toBe(0);
    expect(bend(22, 44)).toBeCloseTo(1.1 * 44 * 0.5 ** 2.6);
    expect(bend(10, 44)).toBeGreaterThan(bend(20, 44));
  });
  it("leaves the middle of a surface flat", () => {
    expect(lensOffset(150, 75, 300, 150, 20, 42, all)).toEqual([0, 0]);
  });
  it("looks inward from every edge", () => {
    expect(lensOffset(1, 75, 300, 150, 0, 42, all)[0]).toBeGreaterThan(0);
    expect(lensOffset(299, 75, 300, 150, 0, 42, all)[0]).toBeLessThan(0);
    expect(lensOffset(150, 1, 300, 150, 0, 42, all)[1]).toBeGreaterThan(0);
    expect(lensOffset(150, 149, 300, 150, 0, 42, all)[1]).toBeLessThan(0);
  });
  it("gives an edge that runs off the screen no rim", () => {
    const topOnly: Rim = { top: true, right: false, bottom: false, left: false };
    expect(lensOffset(1, 30, 393, 60, 0, 17, topOnly)).toEqual([0, 0]);
    expect(lensOffset(200, 59, 393, 60, 0, 17, topOnly)).toEqual([0, 0]);
    expect(lensOffset(200, 1, 393, 60, 0, 17, topOnly)[1]).toBeGreaterThan(0);
  });
  it("follows the corner the CSS draws: the edge sits further in beside a rounded corner", () => {
    const square = lensOffset(10, 5, 300, 150, 0, 42, all)[0];
    const round = lensOffset(10, 5, 300, 150, 20, 42, all)[0];
    expect(round).toBeGreaterThan(square);
  });
  it("never asks for more than the map can carry", () => {
    const rim = rimWidth(300, 150);
    for (let x = 0; x <= 300; x += 7) {
      for (let y = 0; y <= 150; y += 7) {
        const [ox, oy] = lensOffset(x, y, 300, 150, 20, rim, all);
        expect(Math.abs(ox)).toBeLessThanOrEqual(1.1 * rim + 1e-9);
        expect(Math.abs(oy)).toBeLessThanOrEqual(1.1 * rim + 1e-9);
      }
    }
  });
});
