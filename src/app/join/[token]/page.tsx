import { notFound } from "next/navigation";

import { JoinForm } from "@/components/club/join-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "join the staff - injury time.", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_WORDS: Record<string, { word: string; does: string }> = {
  coach: { word: "a coach", does: "You log sessions, pick the side with the manager, and post to the squad." },
  medical: { word: "medical staff", does: "You keep the injuries, the return-to-play steps and the notes. Only you and the player read a note; the manager sees the status and the date." },
};

/** A staff invite from the manager (0015). Before sign-in it shows the club and the role, nothing else. */
export default async function JoinPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  if (!UUID.test(token)) notFound();
  const supabase = await createClient();
  const [{ data }, { data: auth }] = await Promise.all([supabase.rpc("staff_invite_status", { token }), supabase.auth.getUser()]);
  const status = data?.[0];
  if (!status) notFound();
  const role = ROLE_WORDS[status.role];

  return (
    <main className="mx-auto w-full max-w-[560px] flex-1 px-5 py-12">
      <p className="annot">{`// ${status.club_name.toLowerCase()} · the staff`}</p>
      <h1 className="display mt-3 text-5xl">
        join as {status.role}
        <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
      </h1>
      {status.usable ? (
        <>
          <p className="mt-6 max-w-[48ch] text-[16px] leading-relaxed text-ink">{`The manager at ${status.club_name} has asked you in as ${role.word}. ${role.does}`}</p>
          <div className="mt-8">
            <JoinForm token={token} signedInAs={auth.user?.email ?? null} role={status.role} />
          </div>
        </>
      ) : (
        <p className="mt-6 text-[15px] text-ink-dim">This link has been used or has run out (they last seven days). Ask the manager for a new one.</p>
      )}
    </main>
  );
}
