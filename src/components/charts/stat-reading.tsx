/**
 * A number the way an instrument shows it: big, tabular, the unit beside it
 * in the label voice, one line underneath saying what it means.
 */
export function StatReading({
  value,
  unit,
  label,
  note,
  tone = "ink",
  size = "md",
  glow = false,
  className = "",
}: {
  value: string;
  unit?: string;
  label: string;
  note?: string;
  tone?: "ink" | "good" | "warn" | "bad" | "cold";
  size?: "sm" | "md" | "xl";
  glow?: boolean;
  className?: string;
}) {
  const colour = { ink: "text-ink", good: "text-fit", warn: "text-doubt", bad: "text-out", cold: "text-cold" }[tone];
  const scale = { sm: "text-[26px]", md: "text-[38px]", xl: "text-[clamp(72px,14vw,168px)]" }[size];
  return (
    <div className={className}>
      <p className="text-[10.5px] tracking-[0.14em] uppercase text-ink-dim">{label}</p>
      <p className={`display mt-1 ${scale} leading-[0.95] ${colour}`} style={glow ? { textShadow: "0 0 18px color-mix(in oklab, var(--mint) 45%, transparent)" } : undefined}>
        <span className="num" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {unit ? <span className="ml-2 text-[0.32em] font-semibold tracking-[0.08em] text-ink-dim">{unit}</span> : null}
      </p>
      {note ? <p className="mt-1.5 max-w-[34ch] text-[12.5px] leading-snug text-ink-dim">{note}</p> : null}
    </div>
  );
}
