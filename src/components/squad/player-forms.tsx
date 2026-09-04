"use client";

/**
 * Squad management, inline. No modal: a square-cut panel opens under the
 * heading to add a player; a row expands to edit or retire one; a player the
 * league brought in without a position gets a quiet control to set it.
 */
import { useState, useTransition } from "react";

import { addPlayerAction, editPlayerAction, retirePlayerAction, setPositionAction } from "@/lib/squad/actions";
import { POSITIONS, type Player, type Position } from "@/lib/types";

const FIELD =
  "num h-8 border border-line-strong bg-panel px-2 text-[12.5px] text-ink [color-scheme:dark] placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-mint";
const BTN = "pressable h-8 px-3 text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint disabled:opacity-50";
const POSITION_WORD: Record<Position, string> = { GK: "keeper", DF: "defender", MF: "midfielder", FW: "forward" };

export function AddPlayerForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>("MF");
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await addPlayerAction({ name, position, number: number === "" ? null : number });
      if (res.ok) {
        setName("");
        setNumber("");
        setOpen(false);
      } else setError(res.error);
    });
  };

  return (
    <div className="mb-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${BTN} border border-line bg-panel-2 text-ink-dim hover:text-ink`}
      >
        {open ? "close" : "add a player"}
      </button>
      {open ? (
        <form onSubmit={submit} className="mt-2 flex flex-wrap items-end gap-2 border border-line bg-panel p-3" aria-label="add a player">
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] tracking-[0.12em] uppercase text-ink-dim">name</span>
            <input className={`${FIELD} w-44`} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} placeholder="first and last" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] tracking-[0.12em] uppercase text-ink-dim">position</span>
            <select className={`${FIELD} w-32`} value={position} onChange={(e) => setPosition(e.target.value as Position)}>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p} · {POSITION_WORD[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] tracking-[0.12em] uppercase text-ink-dim">number</span>
            <input className={`${FIELD} w-16`} inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))} placeholder="" />
          </label>
          <button type="submit" disabled={pending || name.trim().length < 2} className={`${BTN} bg-mint text-mint-ink`}>
            {pending ? "adding" : "add"}
          </button>
          {error ? <p className="w-full text-[12px] text-out">{error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

export function EditPlayerRow({ player, onDone }: { player: Player; onDone: () => void }) {
  const [name, setName] = useState(player.name);
  const [position, setPosition] = useState<Position>(player.position);
  const [number, setNumber] = useState(player.squad_number?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await editPlayerAction({ id: player.id, name, position, number: number === "" ? null : number });
      if (res.ok) onDone();
      else setError(res.error);
    });
  };
  const retire = () => {
    setError(null);
    start(async () => {
      const res = await retirePlayerAction({ id: player.id });
      if (res.ok) onDone();
      else setError(res.error);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 bg-panel-2 px-3 py-2.5" aria-label={`edit ${player.name}`}>
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] tracking-[0.12em] uppercase text-ink-dim">name</span>
        <input className={`${FIELD} w-44`} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] tracking-[0.12em] uppercase text-ink-dim">position</span>
        <select className={`${FIELD} w-32`} value={position} onChange={(e) => setPosition(e.target.value as Position)}>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p} · {POSITION_WORD[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] tracking-[0.12em] uppercase text-ink-dim">number</span>
        <input className={`${FIELD} w-16`} inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))} />
      </label>
      <button type="submit" disabled={pending} className={`${BTN} bg-mint text-mint-ink`}>
        {pending ? "saving" : "save"}
      </button>
      <button type="button" onClick={onDone} className={`${BTN} border border-line bg-panel text-ink-dim hover:text-ink`}>
        cancel
      </button>
      <span className="ml-auto flex items-center gap-2">
        {confirmRetire ? (
          <>
            <span className="text-[12px] text-ink-dim">retire {player.name.split(" ").at(-1)} today?</span>
            <button type="button" onClick={retire} disabled={pending} className={`${BTN} bg-out text-ink`}>
              yes, retire
            </button>
            <button type="button" onClick={() => setConfirmRetire(false)} className={`${BTN} border border-line bg-panel text-ink-dim`}>
              no
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmRetire(true)} className={`${BTN} border border-out/40 bg-panel text-out`}>
            retire
          </button>
        )}
      </span>
      {error ? <p className="w-full text-[12px] text-out">{error}</p> : null}
    </form>
  );
}

/** For a player the league feed brought in: position is a guess until somebody says. */
export function SetPositionControl({ player }: { player: Player }) {
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={`set position for ${player.name}`}
      defaultValue=""
      disabled={pending}
      onChange={(e) => {
        const position = e.target.value;
        if (!position) return;
        start(async () => {
          await setPositionAction({ id: player.id, position });
        });
      }}
      className="num h-6 w-[54px] appearance-none border border-gold-dim bg-panel px-1.5 text-[10.5px] tracking-[0.06em] text-gold [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-mint"
      title="the league feed does not carry positions; set his"
    >
      <option value="">pos?</option>
      {POSITIONS.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}
