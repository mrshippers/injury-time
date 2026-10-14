"use client";

/**
 * Sign-up in a minute. Four screens at most, three fields before the club
 * exists (name, league, your role) plus the adults-only tick, then the squad
 * pasted in, then where to go next. Every step can be skipped but the club.
 */
import Link from "next/link";
import { useState, useTransition } from "react";

import { sendMagicLink } from "@/app/login/actions";
import { addPastedSquadAction, createClubAction, type PasteOutcome } from "@/lib/signup/actions";
import { parseSquadPaste } from "@/lib/signup/paste";

const FIELD =
  "h-11 w-full border border-line-strong bg-panel px-3 text-[15px] text-ink [color-scheme:dark] placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-mint";
const LABEL = "text-[11px] uppercase tracking-[0.12em] text-ink-dim";
const PRIMARY =
  "pressable h-11 rounded-[2px] bg-mint px-5 text-[12.5px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
const GHOST =
  "pressable inline-flex h-11 items-center rounded-[2px] border border-line-strong bg-pitch px-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint";

// Steps 5 to 7 of the pyramid, the leagues a secretary is most likely to type
const LEAGUES = [
  "Combined Counties League", "Spartan South Midlands League", "Southern Combination League", "Hellenic League", "Essex Senior League",
  "Eastern Counties League", "United Counties League", "Wessex League", "Western League", "North West Counties League", "Northern League",
  "Northern Counties East League", "Midland League", "Thames Valley Premier League", "Middlesex County League", "Kent County League",
];

type Step = "email" | "club" | "squad" | "done";

function Steps({ at }: { at: Step }) {
  const order: Step[] = ["email", "club", "squad", "done"];
  const words = { email: "you", club: "the club", squad: "the squad", done: "next" };
  return (
    <ol className="flex gap-4 text-[11px] uppercase tracking-[0.12em]" aria-label="sign-up steps">
      {order.map((s, i) => (
        <li key={s} aria-current={s === at ? "step" : undefined} className={s === at ? "text-mint" : order.indexOf(at) > i ? "text-ink-dim" : "text-ink-faint"}>
          <span className="num mr-1">{String(i + 1).padStart(2, "0")}</span>
          {words[s]}
        </li>
      ))}
    </ol>
  );
}

export function SignupFlow({ signedInAs }: { signedInAs: string | null }) {
  const [step, setStep] = useState<Step>(signedInAs ? "club" : "email");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clubName, setClubName] = useState("");
  const [paste, setPaste] = useState("");
  const [squad, setSquad] = useState<Extract<PasteOutcome, { ok: true }> | null>(null);
  const [pending, start] = useTransition();
  const preview = paste.trim() ? parseSquadPaste(paste) : null;

  return (
    <div className="mt-8">
      <Steps at={step} />
      {error ? <p role="alert" className="mt-4 text-[13px] text-doubt">{error}</p> : null}

      {step === "email" ? (
        sent ? (
          <div className="mt-6 border border-line bg-panel p-5" role="status">
            <p className="text-[14px] text-ink">
              Link sent to <span className="num text-mint">{sent}</span>.
            </p>
            <p className="mt-2 text-[13px] text-ink-dim">Open it on this device. It brings you back here to name the club.</p>
          </div>
        ) : (
          <form
            className="mt-6 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
              if (!email) return;
              start(async () => {
                setError(null);
                const r = await sendMagicLink(email, "/start");
                if (r.ok) setSent(email);
                else setError(r.error);
              });
            }}
          >
            <label htmlFor="start-email" className={LABEL}>your email</label>
            <input id="start-email" name="email" type="email" autoComplete="email" required className={FIELD} placeholder="gaffer@yourclub.co.uk" />
            <button type="submit" className={PRIMARY} disabled={pending}>{pending ? "sending" : "send me a sign-in link"}</button>
            <p className="text-[12.5px] text-ink-faint">No password. The link is the key.</p>
          </form>
        )
      ) : null}

      {step === "club" ? (
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = String(fd.get("name") ?? "");
            start(async () => {
              setError(null);
              const r = await createClubAction({ name, league: String(fd.get("league") ?? ""), role: String(fd.get("role") ?? ""), adultSide: fd.get("adult") === "on" });
              if (r.ok) {
                setClubName(name.trim());
                setStep("squad");
              } else setError(r.error);
            });
          }}
        >
          <p className="text-[13px] text-ink-dim">
            signed in as <span className="num text-ink">{signedInAs}</span>
          </p>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>club name</span>
            <input name="name" required minLength={2} maxLength={60} className={FIELD} placeholder="Belstone FC" autoComplete="organization" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>league</span>
            <input name="league" required minLength={2} maxLength={80} className={FIELD} list="leagues" placeholder="Combined Counties League" />
            <datalist id="leagues">{LEAGUES.map((l) => <option key={l} value={l} />)}</datalist>
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className={LABEL}>you are</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(["manager", "coach", "medical"] as const).map((r) => (
                <label key={r} className="flex h-11 cursor-pointer items-center gap-2 border border-line-strong bg-panel px-3 text-[14px] text-ink has-[:checked]:border-mint">
                  <input type="radio" name="role" value={r} required defaultChecked={r === "manager"} className="accent-mint" />
                  {r}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-3 text-[14px] leading-snug text-ink">
            <input type="checkbox" name="adult" required className="mt-1 h-4 w-4 accent-mint" />
            <span>
              This is an adult side: every player is 18 or over.
              <span className="block text-[12.5px] text-ink-dim">Under-18 sides need parental consent and safeguarding we have not built yet.</span>
            </span>
          </label>
          <button type="submit" className={PRIMARY} disabled={pending}>{pending ? "making the club" : "make the club"}</button>
        </form>
      ) : null}

      {step === "squad" ? (
        <div className="mt-6">
          <h2 className="text-[20px] font-semibold text-ink">{clubName}: paste the squad</h2>
          <p className="mt-2 max-w-[56ch] text-[14px] leading-relaxed text-ink-dim">
            One player a line, from WhatsApp or a spreadsheet. Numbers and positions if you have them, in any order: <span className="num text-ink">7 Jordan Mcnally MF</span>.
            Got the league feed? Skip this and the squad comes from the league&apos;s list when you connect it on the club page.
          </p>
          <label htmlFor="squad-paste" className={`${LABEL} mt-4 block`}>the squad</label>
          <textarea
            id="squad-paste"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={10}
            className="mt-1.5 w-full border border-line-strong bg-panel p-3 font-mono text-[13.5px] text-ink placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-mint"
            placeholder={"1 Danny Flynn GK\n7 Jordan Mcnally MF\n9 Kushan Thomaj ST"}
          />
          {preview ? (
            <p className="num mt-2 text-[12px] text-ink-dim" aria-live="polite">
              {preview.players.length} players read{preview.skipped.length ? `, ${preview.skipped.length} line${preview.skipped.length === 1 ? "" : "s"} to look at` : ""}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className={PRIMARY}
              disabled={pending || !preview?.players.length}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await addPastedSquadAction(paste);
                  if (r.ok) {
                    setSquad(r);
                    setStep("done");
                  } else setError(r.error);
                })
              }
            >
              {pending ? "adding" : `add ${preview?.players.length ?? 0} players`}
            </button>
            <button type="button" className={GHOST} onClick={() => setStep("done")}>skip for now</button>
          </div>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="mt-6">
          {squad ? (
            <p role="status" className="text-[15px] text-ink">
              {squad.added} players in.
              {squad.skipped.length ? <span className="text-ink-dim"> Left out or changed:</span> : null}
            </p>
          ) : null}
          {squad?.skipped.length ? (
            <ul className="mt-2 text-[13px] text-ink-dim">
              {squad.skipped.map((s) => (
                <li key={s.line + s.reason}>
                  <span className="num text-ink">{s.line}</span> · {s.reason}
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="mt-6 flex flex-col gap-3 text-[14px]">
            <li><Link className="text-ink underline decoration-mint underline-offset-4" href="/club#staff-h">Invite your coach and physio</Link> <span className="text-ink-dim">· a link each</span></li>
            <li><Link className="text-ink underline decoration-mint underline-offset-4" href="/club#feed-h">Connect the league feed</Link> <span className="text-ink-dim">· fixtures, results and the squad list</span></li>
            <li><Link className="text-ink underline decoration-mint underline-offset-4" href="/squad">Hand each player their page</Link> <span className="text-ink-dim">· they call in or out from their phone</span></li>
          </ul>
          <Link href="/" className={`${PRIMARY} mt-8 inline-flex items-center`}>to the club hub</Link>
        </div>
      ) : null}
    </div>
  );
}
