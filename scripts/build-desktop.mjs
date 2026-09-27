import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
const source = new URL("../.output/public/", import.meta.url);
const target = new URL("../dist-desktop/", import.meta.url);
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, filter: (path) => !path.endsWith("sw.js") });
const shell = await readFile(new URL("_shell.html", source), "utf8");
if (!shell.includes('type="module"')) throw new Error("Falta el shell SPA compilado.");
await writeFile(new URL("index.html", target), shell);
console.log("Frontend Tauri preparado en dist-desktop (sin servidor Node).");
