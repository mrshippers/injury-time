/**
 * The season card: a player's season as a 1080 x 1350 image for Instagram and
 * the group chat. Football only: appearances, goals, assists, minutes. Nothing
 * about injuries or availability, ever, not even a count (0014's rule: health
 * data stays with the staff and the player).
 */
import type { ReactElement } from "react";

import { CARD, NAME_LINES, NAME_SIZES, fitStats, fitText } from "./fit";

export type CardData = {
  name: string;
  club: string;
  season: string | null;
  number: number | null;
  accent: string | null;
  stats: { label: string; value: number }[];
};

const INK = "#eef2ee";
const DIM = "rgba(238,242,238,0.62)";
const PITCH = "#070b09";
const MINT = "#95ecc8";
const GOLD = "#d2b156";
const HEX = /^#[0-9a-f]{6}$/i;

export type CardLayout = { element: ReactElement; fitted: boolean };

export function seasonCard(d: CardData): CardLayout {
  const inner = CARD.width - CARD.pad * 2;
  const name = fitText(d.name, inner, NAME_SIZES, NAME_LINES, -0.02);
  const stats = fitStats(d.stats.map((s) => String(s.value)));
  const accent = d.accent && HEX.test(d.accent) ? d.accent : MINT;
  // if it cannot be fitted, render it at the floor and say so: the route answers 500 rather than a clipped card
  const nameSize = name?.size ?? NAME_SIZES[NAME_SIZES.length - 1];
  const nameLines = name?.lines ?? [d.name];
  const statSize = stats?.size ?? 80;

  const element = (
    <div style={{ width: CARD.width, height: CARD.height, display: "flex", flexDirection: "column", background: PITCH, color: INK, padding: CARD.pad }}>
      <div style={{ display: "flex", height: 10, width: 160, background: accent }} />
      <div style={{ display: "flex", marginTop: 40, fontSize: 30, color: GOLD, letterSpacing: "0.04em" }}>
        {`// ${d.club.toLowerCase()}${d.season ? ` · ${d.season}` : ""}`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
        {nameLines.map((l) => (
          <div key={l} style={{ display: "flex", fontSize: nameSize, lineHeight: 1.0, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            {l}
          </div>
        ))}
      </div>
      {/* the shirt number fills the middle, faint, the way a programme does it */}
      <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "flex-end", overflow: "hidden" }}>
        {d.number !== null ? (
          <div style={{ display: "flex", fontSize: 460, lineHeight: 0.78, letterSpacing: "-0.04em", color: accent, opacity: 0.16, marginBottom: 28 }}>{String(d.number)}</div>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 24, borderTop: `2px solid rgba(238,242,238,0.16)`, paddingTop: 36 }}>
        {d.stats.map((s) => (
          <div key={s.label} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: statSize, lineHeight: 1, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>{String(s.value)}</div>
            <div style={{ display: "flex", marginTop: 14, fontSize: 30, color: DIM, letterSpacing: "0.08em" }}>{s.label.toUpperCase()}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 56 }}>
        <div style={{ display: "flex", fontSize: 34, letterSpacing: "-0.01em" }}>
          injury time<span style={{ color: MINT }}>.</span>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: DIM }}>the non-league season, logged</div>
      </div>
    </div>
  );
  return { element, fitted: name !== null && stats !== null };
}
