// Serves public/ and nothing else, for the service-worker test (tests/sw).
// No Next, no database: the worker is plain JS and is tested as such.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "public");
const port = Number(process.env.PORT ?? 3101);
const types = { ".js": "text/javascript", ".png": "image/png", ".html": "text/html", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  if (path === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end("<!doctype html><title>sw test</title><p>sw test</p>");
  }
  const file = normalize(join(root, path));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, () => console.log(`public/ on ${port}`));
