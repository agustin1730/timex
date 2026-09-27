import {
  assertLibrary,
  collections,
  emptyLibrary,
  equal,
  type Library,
  type Collection,
} from "./library.ts";
export type Identity = { id: string; email: string };
export type Envelope = {
  library: Library;
  base: Library;
  revision: number;
  generation: number;
  importDecided: boolean;
  extras: Record<string, string>;
  reviewRequired?: boolean;
};
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const IDENTITY_KEY = "intervalos.account.v1";
const keys: Record<string, Collection> = {
  "interval-timers.v1": "timers",
  "interval-timers.folders.v1": "folders",
  "interval-timers.sequences.v1": "sequences",
};
export const accountKey = (id: string) => `intervalos.library.v1:${id}`;
export const newEnvelope = (): Envelope => ({
  library: emptyLibrary(),
  base: emptyLibrary(),
  revision: 0,
  generation: 0,
  importDecided: false,
  extras: {},
});
export class LocalLibraries {
  constructor(readonly storage: StoragePort) {}
  read(id: string): Envelope {
    const raw = this.storage.getItem(accountKey(id));
    if (!raw) return newEnvelope();
    const result = JSON.parse(raw) as Envelope;
    assertLibrary(result.library);
    assertLibrary(result.base);
    return result;
  }
  write(id: string, next: Envelope, expected?: number) {
    if (expected !== undefined && this.read(id).generation !== expected)
      throw Error("Los datos cambiaron en otra pestaña. Reintentá.");
    this.storage.setItem(
      accountKey(id),
      JSON.stringify({ ...next, generation: next.generation + 1 }),
    );
  }
  backup(id: string, library: Library) {
    this.storage.setItem(
      `${accountKey(id)}:backup:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      JSON.stringify(library),
    );
  }
  guest(): Library {
    const lib = emptyLibrary();
    for (const [key, c] of Object.entries(keys)) {
      const rows = JSON.parse(this.storage.getItem(key) ?? "[]");
      if (!Array.isArray(rows))
        throw Error("Los datos locales necesitan revisión antes de importarlos.");
      Object.assign(lib[c], Object.fromEntries(rows.map((item) => [item.id, item])));
    }
    assertLibrary(lib);
    return lib;
  }
  pending(id: string) {
    const e = this.read(id);
    return !e.importDecided || !!e.reviewRequired || !equal(e.library, e.base);
  }
  get(id: string | null, key: string): string | null {
    if (!id) return this.storage.getItem(key);
    const e = this.read(id),
      c = keys[key];
    if (c) return JSON.stringify(Object.values(e.library[c]).filter((x) => x !== null));
    if (key === "interval-timers.example.v2" || key === "interval-timers.sequence-example.v1")
      return "1";
    return e.extras[key] ?? null;
  }
  set(id: string | null, key: string, value: string) {
    if (!id) {
      this.storage.setItem(key, value);
      return;
    }
    const e = this.read(id),
      c = keys[key];
    if (!c) {
      e.extras[key] = value;
      this.write(id, e);
      return;
    }
    const rows = JSON.parse(value) as { id: string }[];
    const next = Object.fromEntries(rows.map((item) => [item.id, item]));
    for (const oldId of Object.keys(e.library[c]))
      if (!(oldId in next)) next[oldId] = null as never;
    if (equal(e.library[c], next)) return;
    Object.assign(e.library, { [c]: next });
    this.write(id, e);
  }
}
let scope: Identity | null = null;
export function identity(): Identity | null {
  return scope;
}
export const localLibraries = () => new LocalLibraries(window.localStorage);
export function restoreIdentity() {
  const raw = window.localStorage.getItem(IDENTITY_KEY);
  scope = raw ? (JSON.parse(raw) as Identity) : null;
  return scope;
}
export function selectIdentity(next: Identity | null) {
  window.localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
  scope = next;
  window.dispatchEvent(new Event("intervalos-account"));
}
function assertScope() {
  const stored = JSON.parse(window.localStorage.getItem(IDENTITY_KEY) ?? "null") as Identity | null;
  if (stored?.id !== scope?.id)
    throw Error("La cuenta cambió en otra pestaña. Volvé a abrir el editor antes de guardar.");
}
export const libraryStorage = {
  getItem(key: string) {
    return localLibraries().get(scope?.id ?? null, key);
  },
  setItem(key: string, value: string) {
    assertScope();
    localLibraries().set(scope?.id ?? null, key, value);
    if (typeof window.dispatchEvent === "function")
      window.dispatchEvent(new Event("intervalos-local-change"));
  },
};
