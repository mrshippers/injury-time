"use client";

/**
 * A player's consent to health data, and the way back out. Two routes in: the
 * private link the staff sent (no account) or the player's own signed-in page.
 * Both end in the same database rule (0014): only the player gives it, adults
 * only, withdrawable, erasable.
 */
import { useState, useTransition } from "react";

import {
  eraseHealthAction,
  eraseHealthByLinkAction,
  giveConsentAction,
  giveConsentByLinkAction,
  withdrawConsentAction,
} from "@/lib/health/consent-actions";
import { CONSENT_VERSION, consentWording } from "@/lib/health/consent";

const FIELD =
  "num h-11 border border-line-strong bg-panel px-3 text-[15px] text-ink [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-mint";
const PRIMARY =
  "pressable h-11 rounded-[2px] bg-mint px-5 text-[12.5px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
const GHOST =
  "pressable h-10 rounded-[2px] border border-line-strong bg-pitch px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim hover:text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint";

type Route = { kind: "link"; token: string } | { kind: "account"; playerId: string };

export function ConsentForm({ route, clubName, consented: initial, withdrawable = true, maxDob }: { route: Route; clubName: string; consented: boolean; withdrawable?: boolean; maxDob: string }) {
  const [consented, setConsented] = useState(initial);
  const [dob, setDob] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [pending, start] = useTransition();
  const words = consentWording(clubName);

  return (
    <div className="mt-6">
      <h2 className="text-[18px] font-semibold text-ink">{words.heading}</h2>
      <ul className="mt-3 flex flex-col gap-2.5 text-[14.5px] leading-relaxed text-ink">
        {words.points.map((p) => (
          <li key={p} className="flex gap-3">
            <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 bg-mint" />
            {p}
          </li>
        ))}
      </ul>
      <p className="num mt-3 text-[11px] uppercase tracking-[0.12em] text-ink-faint">wording {CONSENT_VERSION}</p>

      {consented ? (
        <div className="mt-6 border border-line bg-panel p-4" role="status">
          <p className="text-[14px] text-ink">You have given consent. Your club&apos;s staff can record your fitness.</p>
          {withdrawable && route.kind === "account" ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className={GHOST}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await withdrawConsentAction(route.playerId);
                    if (r.ok) {
                      setConsented(false);
                      setNote({ ok: true, text: "Withdrawn. Nothing new about your health will be recorded." });
                    } else setNote({ ok: false, text: r.error });
                  })
                }
              >
                withdraw consent
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <form
          className="mt-6 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = route.kind === "link" ? await giveConsentByLinkAction(route.token, dob) : await giveConsentAction(route.playerId, dob);
              if (r.ok) {
                setConsented(true);
                setNote({ ok: true, text: "Thank you. Consent recorded." });
              } else setNote({ ok: false, text: r.error });
            });
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">your date of birth</span>
            <input type="date" required max={maxDob} value={dob} onChange={(e) => setDob(e.target.value)} className={FIELD} />
          </label>
          <button type="submit" className={PRIMARY} disabled={pending || !dob}>
            {pending ? "saving" : "I agree"}
          </button>
        </form>
      )}

      <div className="mt-8 border-t border-line pt-5">
        <h3 className="text-[14px] font-semibold text-ink">Delete everything</h3>
        <p className="mt-1 max-w-[52ch] text-[13.5px] text-ink-dim">
          Every injury, note, check-in and load about you, gone for good, and your consent withdrawn. Your name stays on the squad.
        </p>
        {confirmErase ? (
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              className={`${GHOST} border-out text-out`}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = route.kind === "link" ? await eraseHealthByLinkAction(route.token) : await eraseHealthAction(route.playerId);
                  setConfirmErase(false);
                  if (r.ok) {
                    setConsented(false);
                    setNote({ ok: true, text: `Deleted: ${r.removed} record${r.removed === 1 ? "" : "s"}. Consent withdrawn.` });
                  } else setNote({ ok: false, text: r.error });
                })
              }
            >
              yes, delete it all
            </button>
            <button type="button" className={GHOST} onClick={() => setConfirmErase(false)}>
              keep it
            </button>
          </div>
        ) : (
          <button type="button" className={`${GHOST} mt-3`} onClick={() => setConfirmErase(true)}>
            delete my health data
          </button>
        )}
      </div>
      {note ? (
        <p role={note.ok ? "status" : "alert"} className={`mt-4 text-[13.5px] ${note.ok ? "text-ink" : "text-doubt"}`}>
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
