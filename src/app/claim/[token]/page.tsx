import { notFound } from "next/navigation";

import { ClaimForm } from "@/components/hub/claim-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "your page - injury time.", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A player's claim link, from their manager. Before sign-in it shows a first
 * name and a club, nothing else; the link is the only credential.
 */
export default async function ClaimPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  if (!UUID.test(token)) notFound();
  const supabase = await createClient();
  const [{ data }, { data: auth }] = await Promise.all([supabase.rpc("claim_status", { token }), supabase.auth.getUser()]);
  const status = data?.[0];
  if (!status) notFound();

  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-5 py-12">
      <p className="annot">{`// ${status.club_name.toLowerCase()} · your page`}</p>
      <h1 className="display mt-3 text-5xl">
        {status.first_name.toLowerCase()}
        <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
      </h1>
      {status.claimed ? (
        <p className="mt-6 text-[15px] text-ink-dim">This page has been claimed. If that was you, sign in and it is on the squad page. If not, tell your manager: they can make a new link.</p>
      ) : (
        <>
          <p className="mt-6 max-w-[48ch] text-[16px] leading-relaxed text-ink">
            {`Your manager at ${status.club_name} has handed you your page: your season, your goals, your moments on film, and yours to fill in. The nickname, the name on the shirt, the walk-out song, the clubs before this one.`}
          </p>
          <ul className="mt-6 flex flex-col gap-2 text-[13.5px] text-ink-dim">
            <li className="flex gap-3"><span aria-hidden className="num text-mint">01</span>Sign in with your email. No password.</li>
            <li className="flex gap-3"><span aria-hidden className="num text-mint">02</span>Say it&apos;s you. The page is yours from then on.</li>
            <li className="flex gap-3"><span aria-hidden className="num text-mint">03</span>Nothing about injuries goes on it. That stays with the club&apos;s physio.</li>
          </ul>
          <div className="mt-8">
            <ClaimForm token={token} signedInAs={auth.user?.email ?? null} firstName={status.first_name} />
          </div>
        </>
      )}
    </main>
  );
}
