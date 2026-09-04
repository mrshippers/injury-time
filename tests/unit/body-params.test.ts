import { describe, expect, it } from "vitest";

import { DEFAULT_ATHLETE, MORPHS, figureScale, influencesFor, rangeCm, resolveParams } from "../../src/lib/body/params";

describe("body measurements to morph influences", () => {
  it("the model's own defaults give zero influence on every morph", () => {
    const params = Object.fromEntries(MORPHS.map((m) => [m.key, rangeCm(m).default]));
    for (const v of influencesFor(params)) expect(Math.abs(v)).toBeLessThan(1e-9);
  });

  it("uses the model's formula: (value - default) / (high - low)", () => {
    const i = MORPHS.findIndex((m) => m.key === "height");
    const m = MORPHS[i];
    expect(influencesFor({ height: 190 })[i]).toBeCloseTo((190 - m.default) / (m.high - m.low), 6);
  });

  it("converts inch morphs from cm before mapping", () => {
    const i = MORPHS.findIndex((m) => m.key === "arm_length");
    const m = MORPHS[i];
    expect(m.unit).toBe("in");
    expect(influencesFor({ arm_length: 30 * 2.54 })[i]).toBeCloseTo((30 - m.default) / (m.high - m.low), 6);
  });

  it("clamps to the model's range so a typo cannot tear the mesh, with headroom for a tall keeper", () => {
    const i = MORPHS.findIndex((m) => m.key === "waist");
    const m = MORPHS[i];
    expect(resolveParams({ waist: 400 }).waist).toBe(m.high);
    expect(resolveParams({ waist: 1 }).waist).toBe(m.low);
    expect(resolveParams({ height: 260 }).height).toBe(205);
    expect(resolveParams({ height: 198 }).height).toBe(198);
  });

  it("the default athlete stands 1.80 m and an unset player is the default athlete", () => {
    expect(resolveParams(null).height).toBe(DEFAULT_ATHLETE.height);
    expect(resolveParams(null)).toEqual(resolveParams({}));
    // figureScale times the morphed crown height must equal the requested height
    const inf = influencesFor(null);
    let top = 1.6;
    MORPHS.forEach((m, k) => {
      top += inf[k] * m.topDelta;
    });
    expect(figureScale(null) * top).toBeCloseTo(1.8, 6);
    expect(figureScale({ height: 170 }) * (1.6 + influencesFor({ height: 170 })[0] * MORPHS[0].topDelta)).toBeCloseTo(1.7, 4);
  });
});
