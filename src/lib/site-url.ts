import { headers } from "next/headers";

/** An absolute link to this site, to send on WhatsApp. Server only. */
export async function siteUrl(path: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "injury-time.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}${path}`;
}
