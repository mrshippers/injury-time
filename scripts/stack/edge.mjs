// The local stack's front door, standing in for a Supabase project URL:
//   /rest/v1/*  -> PostgREST     /auth/v1/* -> GoTrue (Supabase Auth)
//   /__mail?to=x -> the newest message the fake SMTP server caught for x
// plus that SMTP server itself, so the real magic-link email can be read by a test.
import { createServer as http, request } from "node:http";
import { createServer as tcp } from "node:net";

const PORT = Number(process.env.EDGE_PORT ?? 54321);
const REST = Number(process.env.REST_PORT ?? 54330);
const AUTH = Number(process.env.AUTH_PORT ?? 54331);
const SMTP = Number(process.env.SMTP_PORT ?? 2500);
const mail = []; // { to, body, at }

function decode(raw) {
  // quoted-printable bodies: soft line breaks and =XX escapes
  return raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

http((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__mail") {
    const to = (url.searchParams.get("to") ?? "").toLowerCase();
    const hit = [...mail].reverse().find((m) => m.to.includes(to));
    res.writeHead(hit ? 200 : 404, { "content-type": "application/json" });
    return res.end(JSON.stringify(hit ?? { error: "no mail" }));
  }
  const route = url.pathname.startsWith("/rest/v1") ? [REST, "/rest/v1"] : url.pathname.startsWith("/auth/v1") ? [AUTH, "/auth/v1"] : null;
  if (!route) {
    res.writeHead(404);
    return res.end();
  }
  const [port, prefix] = route;
  const upstream = request(
    { host: "127.0.0.1", port, method: req.method, path: url.pathname.slice(prefix.length) + url.search, headers: { ...req.headers, host: `127.0.0.1:${port}` } },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", (e) => {
    res.writeHead(502);
    res.end(String(e));
  });
  req.pipe(upstream);
}).listen(PORT, "127.0.0.1", () => console.log(`edge on ${PORT}`));

tcp((sock) => {
  let to = "";
  let data = null;
  sock.write("220 local ESMTP\r\n");
  let buf = "";
  sock.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    if (data !== null) {
      const end = buf.indexOf("\r\n.\r\n");
      if (end === -1) return;
      data += buf.slice(0, end);
      buf = buf.slice(end + 5);
      mail.push({ to, body: decode(data), at: Date.now() });
      data = null;
      sock.write("250 queued\r\n");
    }
    let i;
    while (data === null && (i = buf.indexOf("\r\n")) !== -1) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === "EHLO" || cmd === "HELO") sock.write("250 local\r\n");
      else if (cmd === "MAIL") sock.write("250 ok\r\n");
      else if (cmd === "RCPT") {
        to += line.toLowerCase();
        sock.write("250 ok\r\n");
      } else if (cmd === "DATA") {
        data = "";
        sock.write("354 go\r\n");
      } else if (cmd === "QUIT") {
        sock.end("221 bye\r\n");
      } else sock.write("250 ok\r\n");
    }
  });
  sock.on("error", () => {});
}).listen(SMTP, "127.0.0.1", () => console.log(`smtp on ${SMTP}`));
