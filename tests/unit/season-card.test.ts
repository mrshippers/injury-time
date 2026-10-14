import { ImageResponse } from "next/og";
import { describe, expect, it } from "vitest";

import { CARD, fitStats, fitText, measure, NAME_LINES, NAME_SIZES } from "@/lib/card/fit";
import { seasonCard, type CardData } from "@/lib/card/season-card";

const base: CardData = {
  name: "Kushan Thomaj",
  club: "Kilburn Athletic",
  season: "2026/27",
  number: 9,
  accent: "#95ecc8",
  stats: [
    { label: "apps", value: 14 },
    { label: "goals", value: 11 },
    { label: "assists", value: 4 },
    { label: "minutes", value: 1176 },
  ],
};

async function png(d: CardData) {
  const t0 = performance.now();
  const res = new ImageResponse(seasonCard(d).element, { width: CARD.width, height: CARD.height });
  const buf = Buffer.from(await res.arrayBuffer());
  const ms = performance.now() - t0;
  // PNG IHDR: width and height are the first two big-endian u32s after the 8-byte signature and the chunk header
  return { buf, ms, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("measuring with the font's own metrics", () => {
  it("W is wider than i, and size scales width", () => {
    expect(measure("W", 100)).toBeGreaterThan(measure("i", 100) * 3);
    expect(measure("Thomaj", 200)).toBeCloseTo(measure("Thomaj", 100) * 2, 5);
  });
  it("a long name steps down or breaks, never overflows", () => {
    const f = fitText("Marcus Wolverhampton-Ashworth Jnr", CARD.width - CARD.pad * 2, NAME_SIZES, NAME_LINES, -0.02)!;
    expect(f.stepped || f.lines.length > 1).toBe(true);
    for (const l of f.lines) expect(measure(l, f.size, -0.02)).toBeLessThanOrEqual(CARD.width - CARD.pad * 2);
  });
  it("refuses what cannot fit rather than clipping it", () => {
    expect(fitText("W".repeat(40), 920, NAME_SIZES, NAME_LINES)).toBeNull();
    expect(fitStats(["99999999", "1", "1", "1"])).toBeNull();
  });
});

describe("the season card, rendered", () => {
  it("is 1080 x 1350, under 300 kB, and renders under 1500 ms (p95 of 12)", async () => {
    await png(base); // warm the wasm once; a server process pays this once, not per card
    const runs = [];
    for (let i = 0; i < 12; i += 1) runs.push(await png({ ...base, stats: base.stats.map((s) => ({ ...s, value: s.value + i })) }));
    const ms = runs.map((r) => r.ms).sort((a, b) => a - b);
    const p95 = ms[Math.floor(ms.length * 0.95)];
    const kb = Math.max(...runs.map((r) => r.buf.length)) / 1024;
    console.log(`card: ${runs[0].width} x ${runs[0].height}, largest ${kb.toFixed(1)} kB, render p95 ${p95.toFixed(0)} ms`);
    expect(runs.every((r) => r.width === 1080 && r.height === 1350)).toBe(true);
    expect(kb).toBeLessThanOrEqual(300);
    expect(p95).toBeLessThan(1500);
  }, 60_000);

  it("the longest name and the widest numbers still fit, and render", async () => {
    const worst = { ...base, name: "Maximilian Wolverhampton-Ashworth", stats: base.stats.map((s) => ({ ...s, value: 9999 })) };
    expect(seasonCard(worst).fitted).toBe(true);
    const r = await png(worst);
    expect(r.width).toBe(1080);
    if (process.env.CARD_OUT) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(`${process.env.CARD_OUT}/card-worst.png`, r.buf);
      writeFileSync(`${process.env.CARD_OUT}/card-typical.png`, (await png(base)).buf);
    }
  }, 30_000);

  it("carries no health data: no injury, availability or load word anywhere on it", () => {
    // the wordmark is the one place "injury" may appear
    const text = JSON.stringify(seasonCard(base).element.props).replace(/injury time/g, "");
    for (const word of ["injur", "availab", "fit", "load", "acwr", "doubt", "out for"]) expect(text.toLowerCase()).not.toContain(word);
  });
});
