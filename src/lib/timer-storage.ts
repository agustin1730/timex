import { EXAMPLE_ID, exampleTimer, uid, type Folder, type TimerPreset } from "./timer-model";

const KEY = "interval-timers.v1";
const FOLDERS_KEY = "interval-timers.folders.v1";
const EXAMPLE_KEY = "interval-timers.example.v2";

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Primera versión del ejemplo (sin editar): 3 bloques «Bloque 1..3». */
function isUntouchedOldExample(t: TimerPreset) {
  return (
    t.blocks.length === 3 &&
    t.blocks.map((b) => b.name).join("|") === "Bloque 1|Bloque 2|Bloque 3" &&
    t.blocks.map((b) => b.stages.map((s) => `${s.name}:${s.duration}`).join(",")).join("|") ===
      "Trabajo:20,Descanso:10|Pausa larga:180|Trabajo continuo:120"
  );
}

function readRaw(): TimerPreset[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TimerPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadTimers(): TimerPreset[] {
  if (typeof window === "undefined") return [];
  let timers = readRaw();
  // Se siembra/actualiza el ejemplo una única vez; nunca se pisa una copia editada.
  if (!window.localStorage.getItem(EXAMPLE_KEY)) {
    const idx = timers.findIndex((t) => t.id === EXAMPLE_ID);
    if (idx < 0) timers = [exampleTimer(), ...timers];
    else if (isUntouchedOldExample(timers[idx]!)) {
      timers[idx] = { ...exampleTimer(), folderId: timers[idx]!.folderId ?? null };
    }
    window.localStorage.setItem(KEY, JSON.stringify(timers));
    window.localStorage.setItem(EXAMPLE_KEY, "1");
  }
  return timers;
}

export function saveTimers(timers: TimerPreset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(timers));
  emit();
}

export function getTimer(id: string): TimerPreset | undefined {
  return loadTimers().find((t) => t.id === id);
}

export function upsertTimer(timer: TimerPreset) {
  const timers = loadTimers();
  const idx = timers.findIndex((t) => t.id === timer.id);
  const next = { ...timer, updatedAt: Date.now() };
  if (idx >= 0) timers[idx] = next;
  else timers.push(next);
  saveTimers(timers);
}

export function deleteTimer(id: string) {
  saveTimers(loadTimers().filter((t) => t.id !== id));
}

export function moveTimer(id: string, folderId: string | null) {
  saveTimers(loadTimers().map((t) => (t.id === id ? { ...t, folderId } : t)));
}

/* ---------- Carpetas (máximo dos niveles) ---------- */

export function loadFolders(): Folder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FOLDERS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Folder[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFolders(folders: Folder[]) {
  window.localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  emit();
}

export function createFolder(name: string, parentId: string | null): Folder | null {
  const folders = loadFolders();
  if (parentId) {
    const parent = folders.find((f) => f.id === parentId);
    // No se permiten subcarpetas dentro de subcarpetas.
    if (!parent || parent.parentId !== null) return null;
  }
  const folder: Folder = { id: uid(), name: name.trim() || "Carpeta", parentId };
  saveFolders([...folders, folder]);
  return folder;
}

export function renameFolder(id: string, name: string) {
  saveFolders(loadFolders().map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)));
}

/** Ids de la carpeta y sus subcarpetas. */
export function folderTree(id: string, folders = loadFolders()): string[] {
  return [id, ...folders.filter((f) => f.parentId === id).map((f) => f.id)];
}

export function folderContents(id: string) {
  const folders = loadFolders();
  const ids = folderTree(id, folders);
  return {
    subfolders: ids.length - 1,
    timers: loadTimers().filter((t) => t.folderId && ids.includes(t.folderId)).length,
  };
}

export function deleteFolder(id: string) {
  const folders = loadFolders();
  const ids = folderTree(id, folders);
  saveTimers(loadTimers().filter((t) => !(t.folderId && ids.includes(t.folderId))));
  saveFolders(folders.filter((f) => !ids.includes(f.id)));
}
