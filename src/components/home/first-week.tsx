import Link from "next/link";

/**
 * A new club's first week, read from the database (0015's first_week_check):
 * the squad is in, a member of staff has joined, and a player has answered a
 * call from the notification itself. Shown to staff until all three hold.
 */
export function FirstWeek({ check }: { check: { squad_in: boolean; staff_joined: boolean; push_answered: boolean } | null }) {
  if (!check) return null;
  const items: [boolean, string, string, string][] = [
    [check.squad_in, "the squad is in", "/start", "eleven or more players"],
    [check.staff_joined, "a coach or physio has joined", "/club#staff-h", "invite them from the club page"],
    [check.push_answered, "a player answered a call from their phone", "/team", "players turn notifications on from their page"],
  ];
  const done = items.filter((i) => i[0]).length;
  if (done === items.length) return null;
  return (
    <section aria-labelledby="first-week-h" className="mb-6 bg-panel/70 p-5">
      <p className="annot" id="first-week-h">{`// your first week · ${done} of ${items.length}`}</p>
      <ul className="mt-3 flex flex-col gap-2 text-[14px]">
        {items.map(([ok, label, href, how]) => (
          <li key={label} className="flex items-baseline gap-3">
            <span aria-hidden className={`inline-block h-2.5 w-2.5 shrink-0 ${ok ? "bg-mint" : "border border-ink-dim"}`} />
            <span className={ok ? "text-ink-dim line-through decoration-ink-faint" : "text-ink"}>{label}</span>
            {ok ? <span className="sr-only">(done)</span> : (
              <Link href={href} className="text-[12.5px] text-ink-dim underline underline-offset-4 hover:text-ink">
                {how}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
