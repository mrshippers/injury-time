"use client";

/**
 * The board's own forms: the club as it names itself, the season it is in,
 * and the staff on its books. Each one is a plain form that posts to a server
 * action and says in a line what happened. Disabled with a reason for anyone
 * who may not write it.
 */
import { useState, useTransition } from "react";

import type { ActionState } from "@/lib/club/actions";
import { removeStaffAction, saveStaffAction, updateClubProfileAction, updateSeasonSetupAction } from "@/lib/club/board";
import type { MemberRow } from "@/lib/club/members";
import { FORMATIONS } from "@/lib/lineup";
import { STAFF_ROLES, type ClubStaff } from "@/lib/types";

import { shortDate } from "@/components/squad/format";

const FIELD =
  "num h-10 border border-line-strong bg-panel px-2 text-[13px] text-ink [color-scheme:dark] placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-mint disabled:opacity-50";
const LABEL = "text-[11px] tracking-[0.12em] uppercase text-ink-dim";
const PRIMARY =
  "pressable h-10 rounded-[2px] bg-mint px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
const GHOST =
  "pressable h-10 rounded-[2px] border border-line-strong bg-pitch px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim hover:text-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint";

function Outcome({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={`mt-3 text-[13px] ${state.ok ? "text-ink" : "text-doubt"}`}>
      <span className="num mr-2 text-[11px] tracking-[0.12em] uppercase">{state.ok ? "done" : "not done"}</span>
      {state.message}
    </p>
  );
}

const field = (form: HTMLFormElement, name: string) => String(new FormData(form).get(name) ?? "");

export type ProfileValues = { name: string; league: string; division: string; ground: string; founded: string; home: string; away: string };

export function ClubProfileForm({ values, allowed, reason }: { values: ProfileValues; allowed: boolean; reason: string | null }) {
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = e.currentTarget;
        start(async () => setState(await updateClubProfileAction({ name: field(f, "name"), league: field(f, "league"), division: field(f, "division"), ground: field(f, "ground"), founded: field(f, "founded"), home: field(f, "home"), away: field(f, "away") })));
      }}
    >
      <fieldset disabled={!allowed || pending} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="col-span-2 flex flex-col gap-1.5">
          <span className={LABEL}>club</span>
          <input name="name" defaultValue={values.name} required maxLength={60} className={FIELD} />
        </label>
        <label className="col-span-2 flex flex-col gap-1.5">
          <span className={LABEL}>league</span>
          <input name="league" defaultValue={values.league} required maxLength={80} className={FIELD} />
        </label>
        <label className="col-span-2 flex flex-col gap-1.5">
          <span className={LABEL}>division</span>
          <input name="division" defaultValue={values.division} maxLength={80} placeholder="Premier Division" className={FIELD} />
        </label>
        <label className="col-span-2 flex flex-col gap-1.5">
          <span className={LABEL}>ground</span>
          <input name="ground" defaultValue={values.ground} maxLength={80} placeholder="the name of the ground" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>founded</span>
          <input name="founded" defaultValue={values.founded} inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="1921" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>home colour</span>
          <span className="flex items-center gap-2">
            <input type="color" name="home" defaultValue={values.home || "#1b5e20"} aria-label="home colour" className="h-10 w-12 border border-line-strong bg-panel p-0.5" />
            <span className="num text-[12px] text-ink-dim">{values.home || "unset"}</span>
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>away colour</span>
          <span className="flex items-center gap-2">
            <input type="color" name="away" defaultValue={values.away || "#eeeeee"} aria-label="away colour" className="h-10 w-12 border border-line-strong bg-panel p-0.5" />
            <span className="num text-[12px] text-ink-dim">{values.away || "unset"}</span>
          </span>
        </label>
        <div className="flex items-end">
          <button type="submit" className={PRIMARY}>
            {pending ? "saving" : "save"}
          </button>
        </div>
      </fieldset>
      {!allowed && reason ? <p className="mt-3 text-[13px] text-ink-dim">{reason}</p> : null}
      <Outcome state={state} />
    </form>
  );
}

export function SeasonSetupForm({ season, defaultFormation, allowed, reason }: { season: string; defaultFormation: string; allowed: boolean; reason: string | null }) {
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = e.currentTarget;
        start(async () => setState(await updateSeasonSetupAction({ season: field(f, "season"), defaultFormation: field(f, "formation") })));
      }}
    >
      <fieldset disabled={!allowed || pending} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>season</span>
          <input name="season" defaultValue={season} pattern="\d{4}(-\d{2})?" placeholder="2026-27" className={`${FIELD} w-28`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>the side opens in</span>
          <select name="formation" defaultValue={defaultFormation} className={`${FIELD} pr-8`}>
            {FORMATIONS.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name} · {f.note}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={PRIMARY}>
          {pending ? "saving" : "save"}
        </button>
      </fieldset>
      {!allowed && reason ? <p className="mt-3 text-[13px] text-ink-dim">{reason}</p> : null}
      <Outcome state={state} />
    </form>
  );
}

const ROLE_WORD: Record<ClubStaff["role"], string> = { manager: "manager", coach: "coach", medical: "medical", other: "staff" };
const MEMBER_WORD: Record<string, string> = { manager: "manager", coach: "coach", medical: "medical" };

/**
 * The staff: everyone on the books, with the login they are if they have one, and the logins with
 * no name yet. A person is edited in place; leaving is a date, so the review still counts their season.
 */
export function StaffBooks({ staff, members, allowed, reason, today }: { staff: ClubStaff[]; members: MemberRow[]; allowed: boolean; reason: string | null; today: string }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const unnamed = members.filter((m) => !m.staff);
  const current = staff.filter((s) => !s.left_on);
  const gone = staff.filter((s) => s.left_on);
  const emailOf = (s: ClubStaff) => members.find((m) => m.user_id === s.user_id)?.email ?? null;

  const remove = (s: ClubStaff) =>
    start(async () => {
      if (!confirm(`Take ${s.name} off the books entirely? If they have left, set the date instead.`)) return;
      setState(await removeStaffAction(s.id));
    });

  return (
    <div className="mt-4">
      {current.length === 0 && unnamed.length === 0 ? <p className="text-[13.5px] text-ink-dim">Nobody on the books yet.</p> : null}
      {current.length > 0 ? (
        <ul className="border-t border-line" aria-label="the staff">
          {current.map((s) => (
            <li key={s.id} className="border-b border-line py-2.5">
              {editing === s.id ? (
                <StaffForm initial={s} today={today} onDone={(st) => { setState(st); if (st?.ok) setEditing(null); }} onCancel={() => setEditing(null)} />
              ) : (
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[14px]">
                  <span className="font-semibold text-ink">{s.name}</span>
                  <span className="text-ink-dim">{s.title}</span>
                  <span className="num text-[11px] uppercase tracking-[0.1em] text-ink-dim">{ROLE_WORD[s.role]}</span>
                  <span className="num text-[12px] text-ink-dim">since {shortDate(s.joined_on)}</span>
                  {s.user_id ? <span className="num truncate text-[12px] text-ink-faint">{emailOf(s) ?? "signed in"}</span> : <span className="num text-[11px] uppercase tracking-[0.1em] text-ink-faint">no login</span>}
                  {allowed ? (
                    <span className="ml-auto flex gap-3">
                      <button type="button" className="pressable text-[12px] font-semibold text-mint underline-offset-4 hover:underline" onClick={() => setEditing(s.id)}>
                        edit
                      </button>
                      <button type="button" disabled={pending} className="pressable text-[12px] text-ink-dim underline-offset-4 hover:text-ink hover:underline" onClick={() => remove(s)}>
                        remove
                      </button>
                    </span>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {unnamed.length > 0 ? (
        <div className="mt-4">
          <p className="text-[13px] text-ink-dim">Signed in but not on the books yet. Put a name to them so the review can count their season.</p>
          <ul className="mt-2 border-t border-line" aria-label="logins with no name">
            {unnamed.map((m) => (
              <li key={m.user_id} className="border-b border-line py-2.5">
                {editing === m.user_id ? (
                  <StaffForm initial={{ user_id: m.user_id, role: m.role === "medical" ? "medical" : m.role === "coach" ? "coach" : "manager", joined_on: m.created_at.slice(0, 10) }} today={today} onDone={(st) => { setState(st); if (st?.ok) setEditing(null); }} onCancel={() => setEditing(null)} />
                ) : (
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[14px]">
                    <span className="num text-ink">{m.email ?? "a login"}</span>
                    <span className="num text-[11px] uppercase tracking-[0.1em] text-ink-dim">{MEMBER_WORD[m.role] ?? m.role}</span>
                    <span className="num text-[12px] text-ink-dim">joined {shortDate(m.created_at.slice(0, 10))}</span>
                    {allowed ? (
                      <button type="button" className="pressable ml-auto text-[12px] font-semibold text-mint underline-offset-4 hover:underline" onClick={() => setEditing(m.user_id)}>
                        put a name to them
                      </button>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {editing === "new" ? (
        <div className="mt-4 border-t border-line pt-3">
          <StaffForm initial={{ joined_on: today }} today={today} onDone={(st) => { setState(st); if (st?.ok) setEditing(null); }} onCancel={() => setEditing(null)} />
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={PRIMARY} disabled={!allowed || pending} onClick={() => setEditing("new")}>
            add someone
          </button>
          {!allowed && reason ? <p className="text-[13px] text-ink-dim">{reason}</p> : null}
        </div>
      )}
      {gone.length > 0 ? (
        <details className="mt-4">
          <summary className="pressable cursor-pointer text-[12.5px] text-ink-dim">
            {gone.length} who have left
          </summary>
          <ul className="mt-2 border-t border-line">
            {gone.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-2 text-[13px] text-ink-dim">
                <span className="text-ink">{s.name}</span>
                <span>{s.title}</span>
                <span className="num text-[12px]">
                  {shortDate(s.joined_on)} to {shortDate(s.left_on!)}
                </span>
                {allowed ? (
                  <button type="button" className="pressable ml-auto text-[12px] text-mint underline-offset-4 hover:underline" onClick={() => setEditing(s.id)}>
                    edit
                  </button>
                ) : null}
                {editing === s.id ? (
                  <div className="basis-full">
                    <StaffForm initial={s} today={today} onDone={(st) => { setState(st); if (st?.ok) setEditing(null); }} onCancel={() => setEditing(null)} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <Outcome state={state} />
    </div>
  );
}

function StaffForm({ initial, today, onDone, onCancel }: { initial: Partial<ClubStaff>; today: string; onDone: (s: ActionState) => void; onCancel: () => void }) {
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = e.currentTarget;
        start(async () =>
          onDone(
            await saveStaffAction({
              id: initial.id,
              user_id: initial.user_id ?? undefined,
              name: field(f, "name"),
              title: field(f, "title"),
              role: field(f, "role"),
              joined_on: field(f, "joined_on"),
              left_on: field(f, "left_on"),
            }),
          ),
        );
      }}
    >
      <fieldset disabled={pending} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <label className="col-span-2 flex flex-col gap-1.5">
          <span className={LABEL}>name</span>
          <input name="name" defaultValue={initial.name ?? ""} required maxLength={80} autoFocus className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>title</span>
          <input name="title" defaultValue={initial.title ?? ""} required maxLength={40} placeholder="assistant" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>role</span>
          <select name="role" defaultValue={initial.role ?? "coach"} className={`${FIELD} pr-8`}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_WORD[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>came</span>
          <input type="date" name="joined_on" defaultValue={initial.joined_on ?? today} max={today} required className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>left</span>
          <input type="date" name="left_on" defaultValue={initial.left_on ?? ""} max={today} className={FIELD} />
        </label>
      </fieldset>
      <div className="mt-3 flex gap-3">
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "saving" : "save"}
        </button>
        <button type="button" onClick={onCancel} className={GHOST}>
          cancel
        </button>
      </div>
    </form>
  );
}
