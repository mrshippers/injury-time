import { notFound } from "next/navigation";

import { CheckinForm } from "@/components/checkin/checkin-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "check in - injury time.", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A player's private check-in. No account, no app: a link from the staff, two
 * taps, done. Consent comes first and stays revocable on the same page.
 */
export default async function CheckinPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  if (!UUID.test(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("checkin_status", { token });
  const status = data?.[0];
  if (!status) notFound();

  return (
    <main className="mx-auto w-full max-w-[520px] flex-1 px-5 py-10">
      <p className="annot">{`// ${status.club_name.toLowerCase()} · check in`}</p>
      <h1 className="display mt-2 text-4xl">
        {status.first_name.toLowerCase()}
        <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
      </h1>
      <CheckinForm token={token} clubName={status.club_name} consented={status.consented} todayDone={status.today_done} />
    </main>
  );
}
