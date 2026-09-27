import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = ".output/public";
async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) files.push(...(await walk(`${dir}/${e.name}`)));
    else files.push(`${dir}/${e.name}`);
  }
  return files;
}
const files = (await walk(root)).filter(
  (f) => f.includes("/assets/") || f.endsWith("/_shell.html") || f.endsWith("/favicon.ico"),
);
if (!files.some((f) => f.endsWith("/_shell.html"))) throw Error("Missing offline SPA shell");
const urls = files.map((f) => f.slice(root.length));
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile(file));
const cache = "intervalos-shell-" + hash.digest("hex").slice(0, 16);
await writeFile(
  `${root}/sw.js`,
  `const CACHE=${JSON.stringify(cache)},FILES=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('intervalos-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/_shell.html'))));return;}
if(FILES.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(event.request)));
});`,
);
console.log(
  `Offline shell: ${urls.length} resources cached; no account data or auth requests cached.`,
);
