/**
 * The home shirt from the front, drawn in the style of a modern kit render: a sublimated pattern of dark
 * angular shards, strongest at the hem, a checked band at the collar and cuffs, accent stripes at the hem,
 * the club's crest on the left breast, a maker's mark on the right, and a front-of-shirt wordmark. The
 * colours are the club's own; the name and number sit underneath as a caption so a long name never runs off.
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

// the sublimated pattern: a field of thin dark shards, seeded so server and browser draw the same shirt
const SHARDS = (() => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 90 }, () => {
    const x = 40 + rnd() * 160, y = 36 + rnd() * 182;
    const len = 8 + rnd() * 30, w = 1.4 + rnd() * 4.2;
    const a = ((rnd() - 0.5) * 70 * Math.PI) / 180;
    const dx = Math.sin(a) * len, dy = -Math.cos(a) * len;
    const px = Math.cos(a) * w, py = Math.sin(a) * w;
    const f = (n: number) => n.toFixed(1);
    return { d: `M${f(x)} ${f(y)} L${f(x + dx)} ${f(y + dy)} L${f(x + dx + px * 0.3)} ${f(y + dy + py * 0.3)} L${f(x + px)} ${f(y + py)} Z`, o: (0.18 + rnd() * 0.3).toFixed(2) };
  });
})();

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
  const light = contrast(1, L) >= contrast(0, L);
  const trim = colours?.trim && colours.trim !== fill ? colours.trim : light ? "#ffffff" : "#0a0d0b";
  const mark = light ? "#ffffff" : "#0a0d0b";
  const id = `kit-${fill.replace("#", "")}`;
  return (
    <figure className="mx-auto w-[248px] md:mx-0" aria-label={`home kit: ${name}${number !== null ? `, number ${number}` : ""}${captain ? ", captain" : ""}`}>
      <svg viewBox="0 0 240 232" role="img" aria-hidden className="block h-auto w-full drop-shadow-[0_24px_36px_rgba(0,0,0,0.5)]">
        <defs>
          <clipPath id={`${id}-clip`}>
            <path d={BODY} />
          </clipPath>
          {/* the checked band for collar and cuffs */}
          <pattern id={`${id}-check`} width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill={trim} />
            <rect width="2" height="2" fill={fill} />
            <rect x="2" y="2" width="2" height="2" fill={fill} />
          </pattern>
          <pattern id={`${id}-weave`} width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="2" height="5" fill="#ffffff" fillOpacity="0.04" />
          </pattern>
          <radialGradient id={`${id}-light`} cx="0.4" cy="0.22" r="0.95">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.2" />
          </radialGradient>
          <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.35" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="1" />
          </linearGradient>
          <mask id={`${id}-rise`}>
            <rect width="240" height="232" fill={`url(#${id}-fade)`} />
            <rect width="240" height="232" fill="#fff" fillOpacity="0.55" />
          </mask>
        </defs>

        <path d={BODY} fill={fill} />
        <g clipPath={`url(#${id}-clip)`}>
          {/* the pattern, strongest at the hem and fading as it climbs */}
          <g mask={`url(#${id}-rise)`} fill="#000">
            {SHARDS.map((sh) => (
              <path key={sh.d} d={sh.d} fillOpacity={sh.o} />
            ))}
          </g>
          {/* sleeves a shade deeper than the body, as a lit render reads them */}
          <path d="M52 32 L19 61 C27 47 38 37 52 32 Z M52 32 C38 37 27 47 19 61 L4 94 C14 101 28 105 43 104 L51 91 C56 76 58 54 52 32 Z" fill="#000" fillOpacity="0.16" />
          <path d="M188 32 C202 37 213 47 221 61 L236 94 C226 101 212 105 197 104 L189 91 C184 76 182 54 188 32 Z" fill="#000" fillOpacity="0.16" />
          <rect width="240" height="232" fill={`url(#${id}-weave)`} />
          <rect width="240" height="232" fill={`url(#${id}-light)`} />
          {/* sleeve seams */}
          <path d="M52 32 C58 54 56 76 51 91 M188 32 C182 54 184 76 189 91" stroke="#000" strokeOpacity="0.18" strokeWidth="1.2" fill="none" />
          {/* checked cuffs */}
          <path d="M5 92 C17 99 29 102 42 102" stroke={`url(#${id}-check)`} strokeWidth="7" fill="none" />
          <path d="M235 92 C223 99 211 102 198 102" stroke={`url(#${id}-check)`} strokeWidth="7" fill="none" />
          {/* accent stripes at the sides of the hem */}
          <path d="M52 178 L58 178 L57 206 L51 205 Z M182 178 L188 178 L189 205 L183 206 Z" fill={trim} fillOpacity="0.9" />
        </g>
        {/* checked crew collar with the inside of the neck */}
        <path d="M95 22 C106 31 134 31 145 22 C138 27 102 27 95 22 Z" fill="#000" fillOpacity="0.45" />
        <path d="M90 20 C102 33 138 33 150 20" stroke={`url(#${id}-check)`} strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d={BODY} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

        {/* maker's mark, crest, and the front-of-shirt wordmark */}
        <text x="78" y="68" textAnchor="middle" fontSize="12" fontWeight="900" fill={mark} letterSpacing="0.4" style={{ fontFamily: "var(--font-display, inherit)" }}>
          it.
        </text>
        {crest ? <image href={crest} x="146" y="48" width="36" height="36" preserveAspectRatio="xMidYMid meet" style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.45))" }} /> : null}
        <text x="120" y="122" textAnchor="middle" fontSize="23" fontWeight="900" fill={mark} letterSpacing="-0.5" style={{ fontFamily: "var(--font-display, inherit)" }}>
          injury time.
        </text>
        {/* the little gold tag at the hem */}
        <rect x="156" y="198" width="11" height="8" fill="#c9a24a" />
        <text x="72" y="204" fontSize="5" fontWeight="700" fill={mark} fillOpacity="0.75" letterSpacing="0.6">
          IT·DRY
        </text>
        {captain ? (
          // the armband on his left arm, the viewer's right
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
