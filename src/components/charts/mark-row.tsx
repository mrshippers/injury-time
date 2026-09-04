/**
 * Form as marks: one glyph per game, oldest on the left, so six results read
 * in a glance and the score is a hover away. Text carries the meaning; the
 * tone only echoes it.
 */
export type Mark = { result: "W" | "D" | "L"; title: string };

const TONE: Record<Mark["result"], string> = {
  W: "text-fit border-fit/40",
  D: "text-ink-dim border-line-strong",
  L: "text-out border-out/40",
};

export function MarkRow({ marks, label, className = "" }: { marks: Mark[]; label: string; className?: string }) {
  if (marks.length === 0) {
    return <p className={`text-[12.5px] text-ink-dim ${className}`}>no games yet</p>;
  }
  return (
    <ol className={`flex gap-1.5 ${className}`} aria-label={label}>
      {marks.map((m, i) => (
        <li
          key={i}
          title={m.title}
          className={`num flex h-7 w-7 items-center justify-center rounded-[2px] border bg-pitch text-[12px] font-semibold ${TONE[m.result]} chart-pop`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {m.result}
          <span className="sr-only">{` ${m.title}`}</span>
        </li>
      ))}
    </ol>
  );
}
