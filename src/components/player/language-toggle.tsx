"use client";

/**
 * plain / detailed. Two square-cut buttons, the way the figure's front/back
 * control works, so the page has one grammar for "pick one of two". On a
 * phone the pair runs the full width under the back link and each half is a
 * thumb-sized target.
 */
import { HEALTH_LANGUAGES, HEALTH_LANGUAGE_META, type HealthLanguage } from "@/lib/config";
import { HealthDefaultContext, useHealthLanguage } from "@/lib/health/store";

export function HealthProvider({ defaultMode, children }: { defaultMode: HealthLanguage; children: React.ReactNode }) {
  return <HealthDefaultContext.Provider value={defaultMode}>{children}</HealthDefaultContext.Provider>;
}

export default function LanguageToggle() {
  const [mode, setMode] = useHealthLanguage();
  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 sm:w-auto" data-testid="health-language">
      <p className="annot">{"// health words"}</p>
      <div role="group" aria-label="how health is worded" className="flex w-full overflow-hidden rounded-[3px] border border-line sm:w-auto">
        {HEALTH_LANGUAGES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            title={HEALTH_LANGUAGE_META[m].blurb}
            className={`pressable h-11 flex-1 px-3 text-[12px] font-semibold uppercase tracking-[0.1em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint sm:h-7 sm:flex-none sm:text-[11px] ${
              mode === m ? "bg-mint text-mint-ink" : "bg-panel-2 text-ink-dim hover:text-ink"
            }`}
          >
            {HEALTH_LANGUAGE_META[m].label}
          </button>
        ))}
      </div>
      <span className="text-[12px] text-ink-faint sm:text-[11.5px]">{HEALTH_LANGUAGE_META[mode].blurb}</span>
    </div>
  );
}
