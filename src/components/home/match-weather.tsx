/** The kick-off forecast as one quiet line: what to expect and where it's for. Absent when there's no forecast. */
export function MatchWeatherLine({ weather, className = "" }: { weather: { line: string; ground: string } | null; className?: string }) {
  if (!weather) return null;
  return (
    <p className={`text-[12.5px] text-ink-dim ${className}`}>
      <span className="annot mr-2 text-[10px]">kick-off weather</span>
      <span className="num text-ink">{weather.line}</span>
      <span> · {weather.ground}</span>
    </p>
  );
}
