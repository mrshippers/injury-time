/**
 * The back of the shirt: the club's home colour, the name the player chose,
 * their number. Text colour is picked for contrast off the fill, not assumed.
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

export function Shirt({ name, number, colours }: { name: string; number: number | null; colours: { home?: string; accent?: string } | null }) {
  const fill = colours?.home ?? "#1d2a22";
  const L = luminance(fill);
  // the club's accent when it reads on the shirt, else plain white or black
  const accent = colours?.accent && contrast(luminance(colours.accent), L) >= 3 ? colours.accent : null;
  const ink = accent ?? (contrast(1, L) >= contrast(0, L) ? "#ffffff" : "#0a0d0b");
  const size = name.length > 10 ? 15 : name.length > 7 ? 18 : 21;
  return (
    <figure className="mx-auto w-[200px] md:mx-0" aria-label={`shirt: ${name}${number !== null ? `, number ${number}` : ""}`}>
      <svg viewBox="0 0 200 212" role="img" aria-hidden className="block h-auto w-full drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]">
        <path
          d="M62 8 L22 26 L2 78 L32 92 L42 68 L42 206 L158 206 L158 68 L168 92 L198 78 L178 26 L138 8 Q100 24 62 8 Z"
          fill={fill}
          stroke="rgba(238,242,238,0.22)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M70 11 Q100 22 130 11" fill="none" stroke={ink} strokeOpacity="0.5" strokeWidth="2" />
        <text x="100" y="64" textAnchor="middle" fill={ink} fontSize={size} fontWeight="800" letterSpacing="2.5" style={{ fontFamily: "var(--font-display, inherit)" }}>
          {name}
        </text>
        {number !== null ? (
          <text x="100" y="164" textAnchor="middle" fill={ink} fontSize="84" fontWeight="800" style={{ fontFamily: "var(--font-display, inherit)" }}>
            {number}
          </text>
        ) : null}
      </svg>
    </figure>
  );
}
