/**
 * Both keys are public by design — the anon/publishable key is shipped to the
 * browser and RLS is what actually protects the data. What is not acceptable is
 * booting with them missing, because a client built from `undefined` fails at
 * the first query with an opaque network error instead of here, at startup,
 * naming the variable.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy it from the Supabase dashboard (Project Settings > API) into .env.local.`,
    )
  }
  return value
}

export const SUPABASE_URL = () =>
  required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)

export const SUPABASE_ANON_KEY = () =>
  required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
