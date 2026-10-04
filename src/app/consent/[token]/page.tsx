import { notFound } from "next/navigation";

import { ConsentForm } from "@/components/health/consent-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** the latest date of birth that is 18 today (the database checks it again) */
const adultBorn = () => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 18);
  return d.toISOString().slice(0, 10);
};
export const metadata = { title: "your health data - injury time.", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A player's consent, from the private link the staff sent. No account: the
 * link is the credential (the same one as their check-in link, 0009).
 */
export default async function ConsentPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  if (!UUID.test(token)) notFound();
  const { data } = await (await createClient()).rpc("health_consent_status", { token });
  const status = data?.[0];
  if (!status) notFound();

  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-5 py-10">
      <p className="annot">{`// ${status.club_name.toLowerCase()} · your health data`}</p>
      <h1 className="display mt-2 text-4xl">
        {status.first_name.toLowerCase()}
        <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
      </h1>
      <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-dim">
        Before your club records anything about an injury or your fitness, it needs your say-so. Read this, and agree only if you are happy to.
      </p>
      {/* no account here: deleting withdraws too; withdrawing alone (keeping the history) is on the player's signed-in page */}
      <ConsentForm route={{ kind: "link", token }} clubName={status.club_name} consented={status.consented} withdrawable={false}  maxDob={adultBorn()} />
    </main>
  );
}
