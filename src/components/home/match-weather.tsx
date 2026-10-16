import type { MatchWeather } from "@/lib/weather/grounds";

/**
 * Kick-off weather as a small instrument: the sky drawn in the app's hairline, the temperature set large,
 * rain and wind underneath, and an arrow that points the way the wind is blowing across the pitch.
 * Absent when there's no forecast (too far out, or a ground nobody could confirm), never a guess.
 */
export function MatchWeatherCard({ weather, className = "" }: { weather: MatchWeather | null; className?: string }) {
  if (!weather) return null;
  const rain = weather.rainChance;
  return (
    <div className={`flex items-center gap-3 border border-line bg-pitch/40 px-3 py-2.5 ${className}`} aria-label={`kick-off weather at ${weather.ground}`}>
      <Sky sky={weather.sky} night={Number(weather.kickoff.slice(0, 2)) >= 18} />
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="num text-[26px] font-semibold leading-none text-ink tabular-nums">{weather.tempC}°</span>
          <span className="text-[13px] text-ink">{weather.sky}</span>
        </p>
        <p className="num mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-ink-dim">
          {rain !== null ? (
            <span>
              rain <span className={rain >= 60 ? "font-semibold text-ink" : "text-ink"}>{rain}%</span>
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            wind <span className="text-ink">{weather.windMph} mph</span>
            {weather.windFromDeg != null ? <WindArrow fromDeg={weather.windFromDeg} /> : null}
          </span>
        </p>
        <p className="mt-0.5 truncate text-[11px] text-ink-faint">
          {weather.kickoff} at {weather.ground}
        </p>
      </div>
    </div>
  );
}

/** Points where the wind is going (the feed says where it comes from). */
function WindArrow({ fromDeg }: { fromDeg: number }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" width="12" height="12" style={{ transform: `rotate(${(fromDeg + 180) % 360}deg)` }}>
      <path d="M6 1.5 V10.5 M6 1.5 L3.2 4.6 M6 1.5 L8.8 4.6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CLOUD = "M9 23.5h13.2a5.3 5.3 0 0 0 .6-10.56A7 7 0 0 0 9.6 14.3 4.6 4.6 0 0 0 9 23.5Z";

/** The sky, drawn: one stroke weight, ink for cloud and rain, gold for any sun. */
function Sky({ sky, night }: { sky: string; night: boolean }) {
  // an evening kick-off gets a moon, not a sun
  const moon = (cx: number, cy: number, r: number) => (
    <path d={`M${cx + r * 0.35} ${cy - r} a${r} ${r} 0 1 0 ${r * 0.65} ${r * 1.55} a${r * 0.8} ${r * 0.8} 0 0 1 ${-r * 0.65} ${-r * 1.55}Z`} fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinejoin="round" />
  );
  const day = (cx: number, cy: number, r: number) => (
    night ? moon(cx, cy, r) : sunRays(cx, cy, r)
  );
  const sunRays = (cx: number, cy: number, r: number) => (
    <g stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" fill="none">
      <circle cx={cx} cy={cy} r={r} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={cx + Math.cos(a) * (r + 2.4)} y1={cy + Math.sin(a) * (r + 2.4)} x2={cx + Math.cos(a) * (r + 4.6)} y2={cy + Math.sin(a) * (r + 4.6)} />;
      })}
    </g>
  );
  const cloud = <path d={CLOUD} fill="var(--panel)" stroke="var(--ink)" strokeWidth="1.5" strokeLinejoin="round" />;
  const drops = (n: number, slant: number, dash?: string) => (
    <g stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray={dash}>
      {Array.from({ length: n }, (_, i) => (
        <line key={i} x1={11 + i * 4.5} y1={26} x2={11 + i * 4.5 - slant} y2={30.5} />
      ))}
    </g>
  );
  let body;
  switch (sky) {
    case "clear":
      body = day(16, 16, 6);
      break;
    case "foggy":
      body = (
        <g stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round">
          <line x1="6" y1="11" x2="26" y2="11" />
          <line x1="4" y1="16" x2="24" y2="16" />
          <line x1="8" y1="21" x2="28" y2="21" />
        </g>
      );
      break;
    case "drizzle":
      body = (
        <>
          {cloud}
          {drops(3, 0.6, "1.2 2.4")}
        </>
      );
      break;
    case "rain":
      body = (
        <>
          {cloud}
          {drops(3, 1.6)}
        </>
      );
      break;
    case "showers":
      body = (
        <>
          {day(22, 10, 4)}
          {cloud}
          {drops(2, 1.6)}
        </>
      );
      break;
    case "snow":
      body = (
        <>
          {cloud}
          <g fill="var(--ink)">
            {[11.5, 16, 20.5].map((x) => (
              <circle key={x} cx={x} cy={28.5} r="1.1" />
            ))}
          </g>
        </>
      );
      break;
    case "thunderstorms":
      body = (
        <>
          {cloud}
          <path d="M16.5 24.5 L13.8 28.6 H17 L15 32" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </>
      );
      break;
    default:
      // cloudy: a little sun behind, the cloud in front
      body = (
        <>
          {day(22, 10, 4)}
          {cloud}
        </>
      );
  }
  return (
    <svg aria-hidden viewBox="0 0 32 34" width="40" height="42" className="shrink-0">
      {body}
    </svg>
  );
}
