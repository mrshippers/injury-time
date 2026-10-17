/**
 * The home shirt, built the way FM kit makers build theirs: a template taken from a real 3D-kit render
 * (its silhouette, its sublimated pattern, its fabric shading, all in /public/kit), recoloured per club.
 * Three masks say where the body, the sleeves and the checked collar and cuffs are; each is filled with
 * the club's colour, then the shading map goes over the top in hard-light, which darkens below mid-grey
 * and lightens above it, so the pattern and folds come through in any colour. The crest is the only
 * thing on the chest. The name and number sit underneath as a caption so a long name never runs off.
 */
export type KitColours = { home?: string; accent?: string; shorts?: string; socks?: string; trim?: string } | null;

const SIZE = 414;
// bump when the template files in /public/kit change, so no browser keeps the old ones
const V = "4";

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
  const body = colours?.home ?? "#1d2a22";
  // contrast sleeves in the club's second colour, the checked bands in the first
  const sleeve = colours?.trim && colours.trim !== body ? colours.trim : colours?.accent ?? body;
  const id = `kit-${body.replace("#", "")}-${sleeve.replace("#", "")}`;
  const region = (r: "body" | "sleeve" | "trim", fill: string) => (
    <>
      <mask id={`${id}-${r}`} maskUnits="userSpaceOnUse" x="0" y="0" width={SIZE} height={SIZE}>
        <image href={`/kit/kit-${r}.png?v=${V}`} width={SIZE} height={SIZE} />
      </mask>
      <rect width={SIZE} height={SIZE} fill={fill} mask={`url(#${id}-${r})`} />
    </>
  );
  return (
    <figure className="mx-auto w-[300px] md:mx-0" aria-label={`home kit: ${name}${number !== null ? `, number ${number}` : ""}${captain ? ", captain" : ""}`}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-hidden className="block h-auto w-full drop-shadow-[0_22px_30px_rgba(0,0,0,0.5)]">
        <g style={{ isolation: "isolate" }}>
          {region("body", body)}
          {region("sleeve", sleeve)}
          {region("trim", body)}
          <image href={`/kit/kit-shade.png?v=${V}`} width={SIZE} height={SIZE} style={{ mixBlendMode: "hard-light" }} />
        </g>
        {crest ? <image href={crest} x="239" y="86" width="44" height="44" preserveAspectRatio="xMidYMid meet" style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.45))" }} /> : null}
        {captain ? (
          // the armband on his left arm, the viewer's right
          <g transform="rotate(24 352 112)">
            <rect x="334" y="104" width="38" height="15" fill="#e8c547" />
            <text x="353" y="116" textAnchor="middle" fontSize="12" fontWeight="900" fill="#0a0d0b">C</text>
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
