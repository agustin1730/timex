import {
  emptyLibrary,
  equal,
  keepBoth,
  mergeLibraries,
  possibleDuplicates,
  relationshipIssues,
  type Library,
} from "./library.ts";
import {
  IDENTITY_KEY,
  identity,
  localLibraries,
  restoreIdentity,
  selectIdentity,
  type Identity,
} from "./local.ts";
import { resolveReview, synchronize, type Review } from "./engine.ts";
import { authConfigured, supabase, transport } from "./supabase.ts";
export type AccountState = {
  ready: boolean;
  user: Identity | null;
  status: "Sincronizado" | "Cambios pendientes" | "Error de sincronización";
  error: string;
  busy: boolean;
  review: Review | null;
  importNeeded: boolean;
  duplicates: string[];
};
let state: AccountState = {
  ready: false,
  user: null,
  status: "Cambios pendientes",
  error: "",
  busy: false,
  review: null,
  importNeeded: false,
  duplicates: [],
};
const listeners = new Set<() => void>();
export const accountSnapshot = () => state;
export const watchAccount = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
function update(patch: Partial<AccountState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}
function libraryChanged() {
  window.dispatchEvent(new Event("intervalos-library"));
}
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let started = false;
let suppressAuth = false;
let epoch = 0;
function refreshIdentity(next: Identity | null) {
  const changed = identity()?.id !== next?.id;
  if (changed) epoch++;
  selectIdentity(next);
  update({
    ready: true,
    user: next,
    review: null,
    duplicates: [],
    error: "",
    busy: false,
    importNeeded: next ? !localLibraries().read(next.id).importDecided : false,
    status: next && !localLibraries().pending(next.id) ? "Sincronizado" : "Cambios pendientes",
  });
  libraryChanged();
  if (changed) schedule();
}
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), 1000);
}
export function startAccounts() {
  if (started) return;
  started = true;
  try {
    const cached = restoreIdentity();
    update({
      ready: true,
      user: cached,
      importNeeded: cached ? !localLibraries().read(cached.id).importDecided : false,
    });
  } catch {
    selectIdentity(null);
    update({
      ready: true,
      user: null,
      error: "No se pudo abrir la copia de cuenta. Los archivos locales se conservan.",
    });
  }
  window.addEventListener("intervalos-local-change", () => {
    if (identity()) {
      update({ status: "Cambios pendientes", review: null });
      schedule();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === IDENTITY_KEY) {
      const next = restoreIdentity();
      epoch++;
      update({
        user: next,
        review: null,
        error: "",
        importNeeded: next ? !localLibraries().read(next.id).importDecided : false,
      });
      libraryChanged();
    } else if (event.key?.startsWith("intervalos.library.v1:")) {
      libraryChanged();
      schedule();
    }
  });
  window.addEventListener("online", schedule);
  window.addEventListener("focus", schedule);
  window.setInterval(() => {
    if (!document.hidden) schedule();
  }, 30000);
  const client = supabase();
  if (!client) {
    if (identity()) refreshIdentity(null);
    return;
  }
  client.auth.onAuthStateChange((event, session) => {
    // Do not await auth or database calls inside Supabase's auth callback.
    setTimeout(() => {
      if (suppressAuth) return;
      if (session) {
        const next = { id: session.user.id, email: session.user.email ?? "Cuenta de Google" };
        if (identity()?.id !== next.id) refreshIdentity(next);
        else {
          update({ user: next });
          schedule();
        }
      } else if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") refreshIdentity(null);
    }, 0);
  });
  // Cached identity opens instantly, even while refreshToken waits for network.
  schedule();
}
export async function syncNow() {
  const user = identity();
  if (!user || running || !authConfigured() || state.review) return;
  if (!localLibraries().read(user.id).importDecided) {
    update({ importNeeded: true });
    return;
  }
  if (!navigator.onLine) {
    update({
      status: localLibraries().pending(user.id) ? "Cambios pendientes" : "Sincronizado",
      error: "",
    });
    return;
  }
  running = true;
  const generation = epoch;
  update({ busy: true, error: "" });
  try {
    const run = () => synchronize(localLibraries(), user.id, transport(user.id));
    const result = navigator.locks
      ? await navigator.locks.request(`intervalos-sync:${user.id}`, run)
      : await run();
    if (epoch !== generation || identity()?.id !== user.id) return;
    update({
      status: result.status === "synced" ? "Sincronizado" : "Cambios pendientes",
      review: result.review ?? null,
      duplicates: result.review
        ? possibleDuplicates(result.review.local, result.review.remote.library)
        : [],
    });
    libraryChanged();
    if (result.status === "pending") schedule();
  } catch {
    if (epoch === generation)
      update({
        status: "Error de sincronización",
        error:
          "No se pudo sincronizar. Revisá la conexión, la sesión y la configuración del servicio. Tus cambios siguen guardados en este dispositivo.",
      });
  } finally {
    running = false;
    if (epoch === generation) update({ busy: false });
  }
}
/** User explicitly chooses whether the guest graph joins this account. */
export async function importGuest(include: boolean) {
  const user = identity();
  if (!user || running) return;
  running = true;
  const generation = epoch;
  update({ busy: true, error: "" });
  try {
    const store = localLibraries(),
      before = store.read(user.id);
    const remote = await transport(user.id).pull();
    if (epoch !== generation || store.read(user.id).generation !== before.generation)
      throw Error("Los datos cambiaron. Volvé a revisar la importación.");
    const guest = include ? store.guest() : emptyLibrary();
    const local = mergeLibraries(emptyLibrary(), guest, before.library);
    const candidate = mergeLibraries(emptyLibrary(), local.merged, remote.library);
    const duplicates = possibleDuplicates(local.merged, remote.library);
    const issues = relationshipIssues(candidate.merged);
    store.backup(user.id, before.library);
    store.write(
      user.id,
      {
        ...before,
        library: local.merged,
        importDecided: true,
        reviewRequired: !!(
          candidate.conflicts.length ||
          local.conflicts.length ||
          duplicates.length ||
          issues.length
        ),
      },
      before.generation,
    );
    const current = store.read(user.id);
    update({ importNeeded: false, duplicates });
    if (
      candidate.conflicts.length ||
      local.conflicts.length ||
      duplicates.length ||
      issues.length
    ) {
      update({
        review: {
          local: local.merged,
          remote,
          conflicts: [...local.conflicts, ...candidate.conflicts],
          issues,
          generation: current.generation,
        },
        status: "Cambios pendientes",
      });
    } else {
      store.write(
        user.id,
        { ...current, library: candidate.merged, base: remote.library, revision: remote.revision },
        current.generation,
      );
      libraryChanged();
      schedule();
    }
  } catch (e) {
    if (epoch === generation)
      update({ status: "Error de sincronización", error: (e as Error).message });
  } finally {
    running = false;
    if (epoch === generation) update({ busy: false });
  }
}
export function decide(choice: "local" | "remote" | "both" | "merge") {
  const user = identity(),
    review = state.review;
  if (!user || !review) return;
  try {
    const store = localLibraries();
    if (choice === "merge") {
      if (review.conflicts.length || review.issues.length)
        throw Error("Primero resolvé los cambios incompatibles.");
      const current = store.read(user.id);
      if (current.generation !== review.generation)
        throw Error("Hay cambios nuevos. Volvé a revisar.");
      const merged = mergeLibraries(emptyLibrary(), review.local, review.remote.library).merged;
      store.backup(user.id, current.library);
      store.write(
        user.id,
        {
          ...current,
          library: merged,
          reviewRequired: false,
          base: review.remote.library,
          revision: review.remote.revision,
        },
        current.generation,
      );
    } else resolveReview(store, user.id, review, choice, () => crypto.randomUUID(), keepBoth);
    update({ review: null, duplicates: [], error: "", status: "Cambios pendientes" });
    libraryChanged();
    schedule();
  } catch (e) {
    update({ error: (e as Error).message });
  }
}
export function rereview() {
  update({ review: null, duplicates: [] });
  void syncNow();
}
export function hasPending() {
  return !!identity() && localLibraries().pending(identity()!.id);
}
export async function logout(keepPending = false) {
  if (hasPending() && !keepPending)
    throw Error(
      "Hay cambios pendientes. Sincronizá o elegí conservarlos en este dispositivo antes de cerrar sesión.",
    );
  suppressAuth = true;
  epoch++;
  try {
    // Retain account envelopes/outbox. Guest keys are never overwritten.
    const client = supabase();
    client?.auth.stopAutoRefresh();
    if (navigator.onLine && client) {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
    }
    window.localStorage.removeItem("intervalos.auth.v1");
    window.localStorage.removeItem("intervalos.auth.v1-code-verifier");
    refreshIdentity(null);
    window.location.assign("/account");
  } catch {
    suppressAuth = false;
    update({ error: "No se pudo cerrar la sesión. Tus cambios siguen guardados. Reintentá." });
  }
}
