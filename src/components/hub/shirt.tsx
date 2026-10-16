/**
 * The kit, drawn properly: a shirt with real shoulders and a curved hem, light falling across the fabric,
 * the collar and cuffs in the club's trim, the shorts underneath. The back carries the name the player
 * chose and their number. Text colour is picked for contrast off the fill, never assumed.
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

export function Shirt({ name, number, colours, captain = false }: { name: string; number: number | null; colours: KitColours; captain?: boolean }) {
  const fill = colours?.home ?? "#1d2a22";
  const L = luminance(fill);
  const accent = colours?.accent && contrast(luminance(colours.accent), L) >= 3 ? colours.accent : null;
  const ink = accent ?? (contrast(1, L) >= contrast(0, L) ? "#ffffff" : "#0a0d0b");
  const trim = colours?.trim ?? ink;
  const shorts = colours?.shorts ?? "#141816";
  const size = name.length > 10 ? 15 : name.length > 7 ? 18 : 21;
  const id = `kit-${fill.replace("#", "")}`;
  // shoulders, curved sleeves, a gently waisted body and a curved hem
  const body =
    "M70 14 C78 20 122 20 130 14 L170 30 C178 34 184 42 188 52 L198 82 C190 88 178 92 168 93 L160 76 C158 110 159 150 162 196 C130 204 70 204 38 196 C41 150 42 110 40 76 L32 93 C22 92 10 88 2 82 L12 52 C16 42 22 34 30 30 Z";
  return (
    <figure className="mx-auto w-[220px] md:mx-0" aria-label={`kit: ${name}${number !== null ? `, number ${number}` : ""}`}>
      <svg viewBox="0 0 200 268" role="img" aria-hidden className="block h-auto w-full drop-shadow-[0_22px_34px_rgba(0,0,0,0.5)]">
        <defs>
          {/* light from the top left, a fold down the middle, the sides falling into shadow */}
          <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.16" />
          </linearGradient>
          <linearGradient id={`${id}-sides`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity="0.16" />
            <stop offset="0.18" stopColor="#000" stopOpacity="0" />
            <stop offset="0.82" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.18" />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <path d={body} />
          </clipPath>
        </defs>

        {/* shorts, tucked under the hem */}
        <path d="M46 194 C80 200 120 200 154 194 L160 254 C140 258 116 258 104 256 L100 228 L96 256 C84 258 60 258 40 254 Z" fill={shorts} />
        <path d="M46 194 C80 200 120 200 154 194 L160 254 C140 258 116 258 104 256 L100 228 L96 256 C84 258 60 258 40 254 Z" fill={`url(#${id}-light)`} />

        {/* the shirt */}
        <path d={body} fill={fill} />
        <g clipPath={`url(#${id}-clip)`}>
          <rect x="0" y="0" width="200" height="210" fill={`url(#${id}-light)`} />
          <rect x="0" y="0" width="200" height="210" fill={`url(#${id}-sides)`} />
          {/* a soft vertical fold and the sleeve seams */}
          <path d="M100 30 C98 90 102 150 100 200" stroke="#000" strokeOpacity="0.08" strokeWidth="6" fill="none" />
          <path d="M40 76 C46 60 50 44 60 22 M160 76 C154 60 150 44 140 22" stroke="#000" strokeOpacity="0.18" strokeWidth="1.2" fill="none" />
          {/* cuffs in the trim */}
          <path d="M4 79 C14 85 24 89 33 90" stroke={trim} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M196 79 C186 85 176 89 167 90" stroke={trim} strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>
        {/* the collar: a ribbed crew neck in the trim */}
        <path d="M70 14 C80 24 120 24 130 14" stroke={trim} strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M74 17 C84 25 116 25 126 17" stroke="#000" strokeOpacity="0.25" strokeWidth="1" fill="none" />
        <path d={body} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />

        {/* a long name is squeezed to fit between the sleeves, never cut off */}
        <text
          x="100"
          y="64"
          textAnchor="middle"
          fill={ink}
          fontSize={size}
          fontWeight="800"
          letterSpacing="2"
          textLength={name.length > 7 ? 116 : undefined}
          lengthAdjust={name.length > 7 ? "spacingAndGlyphs" : undefined}
          style={{ fontFamily: "var(--font-display, inherit)" }}
        >
          {name}
        </text>
        {number !== null ? (
          <text x="100" y="160" textAnchor="middle" fill={ink} fontSize="84" fontWeight="800" style={{ fontFamily: "var(--font-display, inherit)" }}>
            {number}
          </text>
        ) : null}
        {captain ? (
          // the armband on the left sleeve
          <g transform="rotate(-22 20 74)">
            <rect x="8" y="69" width="24" height="10" fill="#e8c547" />
            <text x="20" y="77" textAnchor="middle" fontSize="8.5" fontWeight="900" fill="#0a0d0b">C</text>
          </g>
        ) : null}
      </svg>
    </figure>
  );
}
