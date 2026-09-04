import type { Metadata } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/nav/site-nav";
import { getViewer, listPublicClubs } from "@/lib/viewer";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "injury time.",
  description:
    "Squad availability and load for non-league. Your best eleven on the park more often.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [viewer, clubs] = await Promise.all([getViewer(), listPublicClubs()]);
  const pick = (c: { id: string; name: string; slug: string | null }) => ({ id: c.id, name: c.name, slug: c.slug });
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-pitch text-ink">
        <SiteNav role={viewer.role} guest={viewer.guest} club={pick(viewer.club)} clubs={viewer.guest ? clubs.map(pick) : [pick(viewer.club)]} />
        {children}
      </body>
    </html>
  );
}
