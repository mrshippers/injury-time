/**
 * The Veo partner API, as a typed contract. Veo issues a client id and secret
 * per application (created by the Veo team, developer.veo.co.uk); until those
 * are in the environment every call returns `notConfigured`, and the film room
 * keeps a Veo share link as a link card. Documented surface: videos (create,
 * upload, retrieve, transcripts), users, groups, comments. No public clips or
 * AI-events endpoint is documented, so tagged events stay ours.
 */
export const VEO = {
  production: "https://api.veo.co.uk/api",
  uat: "https://apiuat.veo.co.uk/api",
  docs: "https://developer.veo.co.uk/",
  envClientId: "VEO_CLIENT_ID",
  envClientSecret: "VEO_CLIENT_SECRET",
  envEnvironment: "VEO_ENV",
} as const;

export type VeoVideo = {
  id: string;
  title: string;
  recordedAt: string | null;
  durationSeconds: number | null;
  url: string | null;
};

export type VeoResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "not_configured" | "auth_failed" | "http"; detail: string };

type VeoConfig = { clientId: string; clientSecret: string; base: string };

function config(): VeoConfig | null {
  const clientId = process.env[VEO.envClientId];
  const clientSecret = process.env[VEO.envClientSecret];
  if (!clientId || !clientSecret) return null;
  const base = process.env[VEO.envEnvironment] === "uat" ? VEO.uat : VEO.production;
  return { clientId, clientSecret, base };
}

export function veoConfigured(): boolean {
  return config() !== null;
}

async function token(c: VeoConfig): Promise<VeoResult<string>> {
  const res = await fetch(`${c.base}/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId: c.clientId, clientSecret: c.clientSecret }),
  });
  if (!res.ok) return { ok: false, reason: "auth_failed", detail: `${res.status} from ${c.base}/auth/token` };
  const json = (await res.json()) as { token?: string; accessToken?: string };
  const t = json.token ?? json.accessToken;
  if (!t) return { ok: false, reason: "auth_failed", detail: "no token in response" };
  return { ok: true, data: t };
}

async function get<T>(path: string): Promise<VeoResult<T>> {
  const c = config();
  if (!c) return { ok: false, reason: "not_configured", detail: `set ${VEO.envClientId} and ${VEO.envClientSecret}` };
  const t = await token(c);
  if (!t.ok) return t;
  const res = await fetch(`${c.base}${path}`, { headers: { authorization: `Bearer ${t.data}` } });
  if (!res.ok) return { ok: false, reason: "http", detail: `${res.status} from ${path}` };
  return { ok: true, data: (await res.json()) as T };
}

type RawVideo = { id: string; title?: string; name?: string; recordedAt?: string; duration?: number; url?: string };

function normalise(v: RawVideo): VeoVideo {
  return {
    id: v.id,
    title: v.title ?? v.name ?? "untitled",
    recordedAt: v.recordedAt ?? null,
    durationSeconds: typeof v.duration === "number" ? v.duration : null,
    url: v.url ?? null,
  };
}

export async function listVideos(): Promise<VeoResult<VeoVideo[]>> {
  const r = await get<{ items?: RawVideo[] } | RawVideo[]>("/videos");
  if (!r.ok) return r;
  const items = Array.isArray(r.data) ? r.data : (r.data.items ?? []);
  return { ok: true, data: items.map(normalise) };
}

export async function getVideo(id: string): Promise<VeoResult<VeoVideo>> {
  const r = await get<RawVideo>(`/videos/${encodeURIComponent(id)}`);
  return r.ok ? { ok: true, data: normalise(r.data) } : r;
}

export async function listComments(videoId: string): Promise<VeoResult<{ id: string; text: string; at: number | null }[]>> {
  const r = await get<{ items?: { id: string; text?: string; body?: string; timestamp?: number }[] }>(
    `/videos/${encodeURIComponent(videoId)}/comments`,
  );
  if (!r.ok) return r;
  return {
    ok: true,
    data: (r.data.items ?? []).map((c) => ({ id: c.id, text: c.text ?? c.body ?? "", at: c.timestamp ?? null })),
  };
}
