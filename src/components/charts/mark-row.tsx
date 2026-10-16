/**
 * Form as marks: one glyph per game, oldest on the left, so six results read
 * in a glance and the score is a hover away. Text carries the meaning; the
 * tone only echoes it.
 */
export type Mark = { result: "W" | "D" | "L"; title: string };

const TONE: Record<Mark["result"], string> = {
  W: "text-[var(--win)] bg-[var(--win)]/14",
  D: "text-ink bg-panel-2",
  L: "text-out bg-out/14",
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
          className={`plate plate-sm num flex h-7 min-w-9 items-center justify-center text-[12px] font-semibold ${TONE[m.result]} chart-pop`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {m.result}
          <span className="sr-only">{` ${m.title}`}</span>
        </li>
      ))}
    </ol>
  );
}
