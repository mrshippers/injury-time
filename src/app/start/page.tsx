import { SignupFlow } from "@/components/signup/signup-flow";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "sign your club up - injury time." };

/** Sign-up: the link a league secretary forwards. */
export default async function StartPage() {
  const { data } = await (await createClient()).auth.getUser();
  return (
    <main className="mx-auto w-full max-w-[600px] flex-1 px-5 py-10 sm:py-14">
      <p className="annot">{"// sign your club up"}</p>
      <h1 className="display mt-3 text-5xl">
        your club, in a minute
        <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
      </h1>
      <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-dim">
        Who&apos;s in on Saturday, who&apos;s carrying a knock, and the season so far, in one place the whole squad uses from their phones. Free while we
        pilot with clubs at Steps 5 to 7.
      </p>
      <SignupFlow signedInAs={data.user?.email ?? null} />
    </main>
  );
}
