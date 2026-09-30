import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "injury time.",
    short_name: "injury time",
    description: "Squad availability and load for non-league. Your best eleven on the park more often.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070b09",
    theme_color: "#070b09",
    categories: ["sports", "health"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "the team", short_name: "team", url: "/team", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "log a session", short_name: "log", url: "/log", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
