import {
  exampleSequence,
  EXAMPLE_SEQUENCE_ID,
  sequenceItems,
  removeTimerReferences,
  flattenLegacyRepeats,
  type SequencePreset,
} from "./sequence-model.ts";
import { EXAMPLE_ID, exampleTimer, uid, type Folder, type TimerPreset } from "./timer-model.ts";

const KEY = "interval-timers.v1";
const FOLDERS_KEY = "interval-timers.folders.v1";
const EXAMPLE_KEY = "interval-timers.example.v2";

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
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
  // Se crea una única vez. Se conserva íntegro cualquier ejemplo existente.
  if (!window.localStorage.getItem(EXAMPLE_KEY)) {
    const idx = timers.findIndex((t) => t.id === EXAMPLE_ID);
    if (idx < 0) timers = [exampleTimer(), ...timers];
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
  deleteTimers([id]);
}

export function moveTimer(id: string, folderId: string | null) {
  if (folderId && !loadFolders().some((f) => f.id === folderId)) return;
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
  deleteTimers(
    loadTimers()
      .filter((t) => t.folderId && ids.includes(t.folderId))
      .map((t) => t.id),
  );
  saveFolders(folders.filter((f) => !ids.includes(f.id)));
}

const SEQUENCES_KEY = "interval-timers.sequences.v1";
const SEQUENCE_EXAMPLE_KEY = "interval-timers.sequence-example.v1";
export const SEQUENCE_BACKUP_KEY = "interval-timers.sequences.before-expansion.v1";
function convertSequences(sequences: SequencePreset[]) {
  const converted = sequences.map(flattenLegacyRepeats);
  if (converted.some((s, i) => s !== sequences[i])) {
    // Backup must succeed before the original value can be replaced.
    if (!window.localStorage.getItem(SEQUENCE_BACKUP_KEY))
      window.localStorage.setItem(SEQUENCE_BACKUP_KEY, JSON.stringify(sequences));
  }
  return converted;
}
export function loadSequences(): SequencePreset[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(SEQUENCES_KEY);
  const parsed = raw ? JSON.parse(raw) : [];
  let sequences: SequencePreset[] = Array.isArray(parsed) ? parsed : [];
  const converted = convertSequences(sequences);
  if (converted.some((s, i) => s !== sequences[i])) {
    window.localStorage.setItem(SEQUENCES_KEY, JSON.stringify(converted));
    sequences = converted;
  }
  if (!window.localStorage.getItem(SEQUENCE_EXAMPLE_KEY)) {
    if (
      loadTimers().some((t) => t.id === EXAMPLE_ID) &&
      !sequences.some((s) => s.id === EXAMPLE_SEQUENCE_ID)
    )
      sequences = [exampleSequence(), ...sequences];
    window.localStorage.setItem(SEQUENCES_KEY, JSON.stringify(sequences));
    window.localStorage.setItem(SEQUENCE_EXAMPLE_KEY, "1");
  }
  return sequences;
}
export function saveSequences(sequences: SequencePreset[]) {
  window.localStorage.setItem(SEQUENCES_KEY, JSON.stringify(convertSequences(sequences)));
  emit();
}
export function upsertSequence(sequence: SequencePreset) {
  // Un editor abierto antes de borrar un temporizador no debe restaurar referencias eliminadas.
  const valid = new Set(loadTimers().map((t) => t.id));
  const missing = sequenceItems(sequence).flatMap((i) =>
    i.kind === "timer" && !valid.has(i.timerId) ? [i.timerId] : [],
  );
  const next = removeTimerReferences(sequence, missing);
  const sequences = loadSequences();
  const index = sequences.findIndex((s) => s.id === sequence.id);
  if (index < 0) sequences.push(next);
  else sequences[index] = next;
  saveSequences(sequences);
}
export function deleteSequence(id: string) {
  saveSequences(loadSequences().filter((s) => s.id !== id));
}
export function affectedSequences(timerIds: string[]) {
  return loadSequences().filter((s) =>
    sequenceItems(s).some((i) => i.kind === "timer" && timerIds.includes(i.timerId)),
  );
}
function deleteTimers(ids: string[]) {
  const sequences = loadSequences().map((s) =>
    sequenceItems(s).some((i) => i.kind === "timer" && ids.includes(i.timerId))
      ? removeTimerReferences(s, ids)
      : s,
  );
  window.localStorage.setItem(SEQUENCES_KEY, JSON.stringify(sequences));
  saveTimers(loadTimers().filter((t) => !ids.includes(t.id)));
}
export function folderTimerIds(id: string) {
  const tree = folderTree(id);
  return loadTimers()
    .filter((t) => t.folderId && tree.includes(t.folderId))
    .map((t) => t.id);
}
export function sequenceDeletionWarning(ids: string[]) {
  const names = affectedSequences(ids).map((s) => "«" + s.name + "»");
  return names.length
    ? " Secuencias afectadas: " +
        names.join(", ") +
        ". Se quitarán todas las apariciones de estos temporizadores y se recalcularán sus duraciones."
    : "";
}
