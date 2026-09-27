import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve(".output/public");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const path = resolve(root, "." + pathname);
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    let data, type;
    try {
      data = await readFile(path);
      type = types[extname(path)] ?? "application/octet-stream";
    } catch {
      if (extname(path)) {
        res.writeHead(404).end();
        return;
      }
      data = await readFile(resolve(root, "_shell.html"));
      type = "text/html";
    }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" }).end(data);
  } catch {
    res.writeHead(500).end("No se pudo abrir la compilación. Ejecutá npm run build.");
  }
}).listen(Number(process.env.PORT ?? 4173), "127.0.0.1", () =>
  console.log("Intervalos preview: http://127.0.0.1:" + (process.env.PORT ?? 4173)),
);
