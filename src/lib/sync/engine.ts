import {
  assertLibrary,
  emptyLibrary,
  equal,
  mergeLibraries,
  relationshipIssues,
  type Library,
  type Conflict,
} from "./library.ts";
import { LocalLibraries } from "./local.ts";
export type Remote = { revision: number; library: Library };
export interface SyncTransport {
  pull(): Promise<Remote>;
  push(expected: number, library: Library): Promise<Remote | null>;
}
export type Review = {
  local: Library;
  remote: Remote;
  conflicts: Conflict[];
  issues: string[];
  generation: number;
};
export type SyncResult = { status: "synced" | "pending" | "review"; review?: Review };
export async function synchronize(
  store: LocalLibraries,
  id: string,
  transport: SyncTransport,
): Promise<SyncResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const start = store.read(id);
    if (!start.importDecided) return { status: "pending" };
    const remote = await transport.pull();
    assertLibrary(remote.library);
    if (store.read(id).generation !== start.generation) continue;
    const { merged, conflicts } = mergeLibraries(start.base, start.library, remote.library);
    const issues = relationshipIssues(merged);
    if (conflicts.length || issues.length || start.reviewRequired)
      return {
        status: "review",
        review: { local: start.library, remote, conflicts, issues, generation: start.generation },
      };
    store.write(
      id,
      { ...start, library: merged, base: remote.library, revision: remote.revision },
      start.generation,
    );
    if (equal(merged, remote.library)) return { status: "synced" };
    const sent = store.read(id);
    const committed = await transport.push(remote.revision, sent.library);
    if (!committed) continue; // Another device won the compare-and-swap. Pull again.
    assertLibrary(committed.library);
    const current = store.read(id);
    if (current.revision === remote.revision)
      store.write(
        id,
        { ...current, base: committed.library, revision: committed.revision },
        current.generation,
      );
    return { status: store.pending(id) ? "pending" : "synced" };
  }
  return { status: "pending" };
}
export function resolveReview(
  store: LocalLibraries,
  id: string,
  review: Review,
  choice: "local" | "remote" | "both",
  makeId: () => string,
  combine: (a: Library, b: Library, id: () => string) => Library,
) {
  const current = store.read(id);
  if (current.generation !== review.generation)
    throw Error("Hay cambios nuevos. Reintentá la sincronización antes de decidir.");
  // Whole-library choice is explicit, with both full alternatives backed up first.
  const next =
    choice === "both"
      ? combine(review.local, review.remote.library, makeId)
      : choice === "local"
        ? review.local
        : review.remote.library;
  const issues = relationshipIssues(next);
  if (issues.length) throw Error(issues.join(" "));
  store.backup(id, current.library);
  store.backup(id, review.remote.library);
  store.write(
    id,
    {
      ...current,
      library: next,
      reviewRequired: false,
      base: review.remote.library,
      revision: review.remote.revision,
    },
    current.generation,
  );
}
export const emptyRemote = (): Remote => ({ revision: 0, library: emptyLibrary() });
