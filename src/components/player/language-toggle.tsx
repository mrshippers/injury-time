"use client";

/**
 * plain / detailed. Two square-cut buttons, the way the figure's front/back
 * control works, so the page has one grammar for "pick one of two".
 */
import { HEALTH_LANGUAGES, HEALTH_LANGUAGE_META, type HealthLanguage } from "@/lib/config";
import { HealthDefaultContext, useHealthLanguage } from "@/lib/health/store";

export function HealthProvider({ defaultMode, children }: { defaultMode: HealthLanguage; children: React.ReactNode }) {
  return <HealthDefaultContext.Provider value={defaultMode}>{children}</HealthDefaultContext.Provider>;
}

export default function LanguageToggle() {
  const [mode, setMode] = useHealthLanguage();
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="health-language">
      <p className="annot">{"// health words"}</p>
      <div role="group" aria-label="how health is worded" className="flex overflow-hidden rounded-[3px] border border-line">
        {HEALTH_LANGUAGES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            title={HEALTH_LANGUAGE_META[m].blurb}
            className={`pressable h-7 px-3 text-[11px] font-semibold tracking-[0.1em] uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
              mode === m ? "bg-mint text-mint-ink" : "bg-panel-2 text-ink-dim hover:text-ink"
            }`}
          >
            {HEALTH_LANGUAGE_META[m].label}
          </button>
        ))}
      </div>
      <span className="text-[11.5px] text-ink-faint">{HEALTH_LANGUAGE_META[mode].blurb}</span>
    </div>
  );
}
