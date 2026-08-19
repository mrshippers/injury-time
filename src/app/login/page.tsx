import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

export const metadata = { title: "sign in · injury time." };

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/squad");
  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="annot mb-4">{"// sign in"}</p>
        <h1 className="display text-4xl mb-8">the door code</h1>
        <LoginForm />
        <p className="mt-8 text-sm text-ink-faint">
          No account? The demo squad room is open —{" "}
          <a href="/squad" className="text-mint underline-offset-4 hover:underline">
            walk straight in
          </a>
          .
        </p>
      </div>
    </main>
  );
}
