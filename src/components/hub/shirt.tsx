/**
 * The home shirt from the front, the way a kit render in Football Manager shows it: set-in sleeves angled
 * down, a crew collar and cuffs in the club's trim, a fine woven stripe in the fabric, light across the
 * chest, and the club's crest on the left breast. The name and number sit underneath as a caption, so a long
 * surname can never run off the shirt.
 */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

export type KitColours = { home?: string; accent?: string; shorts?: string; socks?: string; trim?: string } | null;

const BODY =
  "M90 20 C102 32 138 32 150 20 L188 32 C202 37 213 47 221 61 L236 94 C226 101 212 105 197 104 L189 91 C188 130 190 172 193 214 C152 223 88 223 47 214 C50 172 52 130 51 91 L43 104 C28 105 14 101 4 94 L19 61 C27 47 38 37 52 32 Z";

export function Shirt({
  name,
  number,
  colours,
  captain = false,
  crest = null,
}: {
  name: string;
  number: number | null;
  colours: KitColours;
  captain?: boolean;
  crest?: string | null;
}) {
  const fill = colours?.home ?? "#1d2a22";
  const L = luminance(fill);
  const trim = colours?.trim && colours.trim !== fill ? colours.trim : contrast(1, L) >= contrast(0, L) ? "#ffffff" : "#0a0d0b";
  const mark = contrast(1, L) >= contrast(0, L) ? "#ffffff" : "#0a0d0b";
  const id = `kit-${fill.replace("#", "")}`;
  return (
    <figure className="mx-auto w-[240px] md:mx-0" aria-label={`home kit: ${name}${number !== null ? `, number ${number}` : ""}${captain ? ", captain" : ""}`}>
      <svg viewBox="0 0 240 232" role="img" aria-hidden className="block h-auto w-full drop-shadow-[0_24px_36px_rgba(0,0,0,0.5)]">
        <defs>
          <clipPath id={`${id}-clip`}>
            <path d={BODY} />
          </clipPath>
          {/* a fine woven stripe, the texture every modern kit has */}
          <pattern id={`${id}-weave`} width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="2" height="5" fill="#ffffff" fillOpacity="0.045" />
          </pattern>
          <radialGradient id={`${id}-light`} cx="0.38" cy="0.22" r="0.9">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.22" />
          </radialGradient>
          <linearGradient id={`${id}-sides`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity="0.2" />
            <stop offset="0.2" stopColor="#000" stopOpacity="0" />
            <stop offset="0.8" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.22" />
          </linearGradient>
        </defs>

        <path d={BODY} fill={fill} />
        <g clipPath={`url(#${id}-clip)`}>
          <rect width="240" height="232" fill={`url(#${id}-weave)`} />
          <rect width="240" height="232" fill={`url(#${id}-light)`} />
          <rect width="240" height="232" fill={`url(#${id}-sides)`} />
          {/* darker side panels running from the armpit to the hem, the cut of a modern shirt */}
          <path d="M51 91 C56 130 54 172 50 214 L72 217 C76 172 76 128 70 96 Z" fill="#000" fillOpacity="0.14" />
          <path d="M189 91 C184 130 186 172 190 214 L168 217 C164 172 164 128 170 96 Z" fill="#000" fillOpacity="0.14" />
          {/* the sleeve seams and a soft fold under each arm */}
          <path d="M52 32 C58 54 56 76 51 91 M188 32 C182 54 184 76 189 91" stroke="#000" strokeOpacity="0.16" strokeWidth="1.2" fill="none" />
          <path d="M60 100 C70 140 66 180 62 214 M180 100 C170 140 174 180 178 214" stroke="#000" strokeOpacity="0.07" strokeWidth="7" fill="none" />
          {/* cuffs in the trim */}
          <path d="M5 92 C17 99 29 102 42 102" stroke={trim} strokeWidth="5.5" fill="none" />
          <path d="M235 92 C223 99 211 102 198 102" stroke={trim} strokeWidth="5.5" fill="none" />
          {/* hem tape */}
          <path d="M47 211 C88 220 152 220 193 211" stroke="#000" strokeOpacity="0.18" strokeWidth="2" fill="none" />
        </g>
        {/* the collar: a ribbed crew neck in the trim with the inside of the neck showing */}
        <path d="M95 22 C106 31 134 31 145 22 C138 27 102 27 95 22 Z" fill="#000" fillOpacity="0.45" />
        <path d="M90 20 C102 33 138 33 150 20" stroke={trim} strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d={BODY} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

        {/* left breast: the club's crest. right breast: a small maker's mark */}
        {crest ? <image href={crest} x="146" y="48" width="38" height="38" preserveAspectRatio="xMidYMid meet" style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.45))" }} /> : null}
        <text x="74" y="72" textAnchor="middle" fontSize="11" fontWeight="800" fill={mark} fillOpacity="0.85" letterSpacing="0.5" style={{ fontFamily: "var(--font-display, inherit)" }}>
          it.
        </text>
        {captain ? (
          // the armband on his left arm, which is the viewer's right
          <g transform="rotate(28 214 76)">
            <rect x="203" y="70" width="22" height="9" fill="#e8c547" />
            <text x="214" y="77.4" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#0a0d0b">C</text>
          </g>
        ) : null}
      </svg>
      <figcaption className="mt-3 flex items-center justify-center gap-2">
        <span className="plate plate-sm num max-w-full truncate bg-panel-2 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink">{name}</span>
        {number !== null ? <span className="plate plate-sm num bg-panel-2 py-1 text-[12px] font-semibold tabular-nums text-ink">{number}</span> : null}
      </figcaption>
    </figure>
  );
}
