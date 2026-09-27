import type { Folder, TimerPreset } from "../timer-model.ts";
import type { SequencePreset } from "../sequence-model.ts";
import { sequenceItems } from "../sequence-model.ts";

export type Library = {
  schema: 1;
  folders: Record<string, Folder | null>;
  timers: Record<string, TimerPreset | null>;
  sequences: Record<string, SequencePreset | null>;
};
export const collections = ["folders", "timers", "sequences"] as const;
export type Collection = (typeof collections)[number];
export const emptyLibrary = (): Library => ({ schema: 1, folders: {}, timers: {}, sequences: {} });
export function equal(a: unknown, b: unknown): boolean {
  const canonical = (v: unknown): string => {
    if (v === undefined) return "undefined";
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
    return `{${Object.entries(v)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  };
  return canonical(a) === canonical(b);
}
export type Conflict = {
  collection: Collection;
  id: string;
  name: string;
  local: unknown;
  remote: unknown;
};
export function mergeLibraries(base: Library, local: Library, remote: Library) {
  const merged = emptyLibrary();
  const conflicts: Conflict[] = [];
  for (const collection of collections) {
    const ids = new Set([
      ...Object.keys(base[collection]),
      ...Object.keys(local[collection]),
      ...Object.keys(remote[collection]),
    ]);
    for (const id of ids) {
      const b = base[collection][id],
        l = local[collection][id],
        r = remote[collection][id];
      let value;
      if (equal(l, r) || equal(r, b)) value = l;
      else if (equal(l, b)) value = r;
      else {
        conflicts.push({ collection, id, name: l?.name ?? r?.name ?? id, local: l, remote: r });
        value = l;
      }
      if (value !== undefined) Object.assign(merged[collection], { [id]: structuredClone(value) });
    }
  }
  return { merged, conflicts };
}
export function relationshipIssues(lib: Library): string[] {
  const issues: string[] = [];
  for (const f of Object.values(lib.folders))
    if (f?.parentId) {
      const parent = lib.folders[f.parentId];
      if (!parent || parent.parentId || parent.id === f.id)
        issues.push(`Carpeta «${f.name}»: ubicación incompatible.`);
    }
  for (const t of Object.values(lib.timers))
    if (t?.folderId && !lib.folders[t.folderId])
      issues.push(`Temporizador «${t.name}»: su carpeta fue eliminada.`);
  for (const s of Object.values(lib.sequences))
    if (s && sequenceItems(s).some((i) => i.kind === "timer" && !lib.timers[i.timerId]))
      issues.push(`Secuencia «${s.name}»: un temporizador fue eliminado.`);
  return issues;
}
export function possibleDuplicates(a: Library, b: Library): string[] {
  return collections.flatMap((c) =>
    Object.values(a[c]).flatMap((item) =>
      item &&
      Object.values(b[c]).some(
        (other) =>
          other &&
          other.id !== item.id &&
          other.name.trim().toLocaleLowerCase() === item.name.trim().toLocaleLowerCase(),
      )
        ? [item.name]
        : [],
    ),
  );
}
/** Preserve the entire local graph as separate records, including references. */
export function keepBoth(local: Library, remote: Library, makeId: () => string): Library {
  const result = structuredClone(remote);
  const ids = Object.fromEntries(
    collections.map((c) => [
      c,
      Object.fromEntries(
        Object.values(local[c])
          .filter((x) => x !== null)
          .map((x) => [x.id, makeId()]),
      ),
    ]),
  ) as Record<Collection, Record<string, string>>;
  for (const f of Object.values(local.folders))
    if (f) {
      const id = ids.folders[f.id]!;
      result.folders[id] = {
        ...f,
        id,
        name: f.name + " (copia local)",
        parentId: f.parentId ? (ids.folders[f.parentId] ?? null) : null,
      };
    }
  for (const t of Object.values(local.timers))
    if (t) {
      const id = ids.timers[t.id]!;
      result.timers[id] = {
        ...structuredClone(t),
        id,
        name: t.name + " (copia local)",
        folderId: t.folderId ? (ids.folders[t.folderId] ?? null) : null,
      };
    }
  for (const s of Object.values(local.sequences))
    if (s) {
      const id = ids.sequences[s.id]!;
      const copy = structuredClone(s);
      for (const i of sequenceItems(copy))
        if (i.kind === "timer") i.timerId = ids.timers[i.timerId] ?? i.timerId;
      result.sequences[id] = { ...copy, id, name: s.name + " (copia local)" };
    }
  return result;
}
export function assertLibrary(value: unknown): asserts value is Library {
  if (!value || typeof value !== "object" || (value as Library).schema !== 1)
    throw Error("Formato de biblioteca no compatible. Los datos locales se conservan.");
  const lib = value as Library;
  for (const c of collections) {
    if (!lib[c] || typeof lib[c] !== "object" || Array.isArray(lib[c]))
      throw Error("Biblioteca inválida.");
    for (const [id, item] of Object.entries(lib[c]))
      if (
        item !== null &&
        (!item ||
          item.id !== id ||
          typeof item.name !== "string" ||
          (c === "timers" && !Array.isArray((item as TimerPreset).blocks)) ||
          (c === "sequences" && !Array.isArray((item as SequencePreset).nodes)))
      )
        throw Error("Registro de biblioteca inválido.");
  }
}
