import { test } from "node:test";
import assert from "node:assert/strict";
import { LocalLibraries, newEnvelope, accountKey } from "../src/lib/sync/local.ts";
import {
  emptyLibrary,
  mergeLibraries,
  keepBoth,
  relationshipIssues,
  possibleDuplicates,
} from "../src/lib/sync/library.ts";
import { synchronize, resolveReview, emptyRemote } from "../src/lib/sync/engine.ts";
import { exampleTimer } from "../src/lib/timer-model.ts";
function device() {
  const values = new Map<string, string>();
  return {
    values,
    store: new LocalLibraries({
      getItem: (k) => values.get(k) ?? null,
      setItem: (k, v) => {
        values.set(k, v);
      },
    }),
  };
}
function library() {
  const l = emptyLibrary();
  l.folders.f = { id: "f", name: "Rutina", parentId: null };
  l.timers.t = { ...exampleTimer(), id: "t", folderId: "f" };
  l.sequences.s = {
    id: "s",
    name: "Sesión",
    updatedAt: 0,
    nodes: [{ id: "i", kind: "timer", timerId: "t" }],
  };
  return l;
}
function ready(store, id, l = emptyLibrary()) {
  store.write(id, { ...newEnvelope(), library: l, importDecided: true });
}
function server() {
  let remote = emptyRemote();
  return {
    get value() {
      return structuredClone(remote);
    },
    pull: async () => structuredClone(remote),
    push: async (expected, l) => {
      if (expected !== remote.revision) return null;
      remote = { revision: remote.revision + 1, library: structuredClone(l) };
      return structuredClone(remote);
    },
  };
}
test("guest data unchanged; account A, B and guest remain separate including pending changes", () => {
  const { store, values } = device();
  store.set(null, "interval-timers.v1", JSON.stringify([library().timers.t]));
  const before = values.get("interval-timers.v1");
  ready(store, "A", library());
  store.set("A", "interval-timers.v1", JSON.stringify([{ ...library().timers.t, name: "Solo A" }]));
  assert.equal(store.pending("A"), true);
  assert.equal(store.get("B", "interval-timers.v1"), "[]");
  assert.equal(values.get("interval-timers.v1"), before);
  assert.equal(JSON.parse(store.get("A", "interval-timers.v1"))[0].name, "Solo A");
  assert.equal(store.guest().timers.t.name, library().timers.t.name);
  assert.equal(new LocalLibraries(store.storage).read("A").library.timers.t.name, "Solo A");
});
test("first import preserves stable IDs, cloud-only records and graph; second device receives it", async () => {
  const a = device(),
    b = device(),
    cloud = server(),
    initial = emptyLibrary();
  initial.folders.remote = { id: "remote", name: "Nube", parentId: null };
  await cloud.push(0, initial);
  ready(a.store, "user", library());
  assert.equal((await synchronize(a.store, "user", cloud)).status, "synced");
  assert.ok(cloud.value.library.folders.remote);
  assert.equal(cloud.value.library.sequences.s.nodes[0].timerId, "t");
  assert.deepEqual(relationshipIssues(cloud.value.library), []);
  ready(b.store, "user");
  await synchronize(b.store, "user", cloud);
  assert.deepEqual(b.store.read("user").library, a.store.read("user").library);
});
test("offline edits persist and retry; deletions stay tombstoned on a second device", async () => {
  const a = device(),
    b = device(),
    cloud = server();
  ready(a.store, "u", library());
  await synchronize(a.store, "u", cloud);
  ready(b.store, "u");
  await synchronize(b.store, "u", cloud);
  a.store.set("u", "interval-timers.sequences.v1", "[]");
  a.store.set("u", "interval-timers.v1", "[]");
  a.store.set("u", "interval-timers.folders.v1", "[]");
  await assert.rejects(
    synchronize(a.store, "u", {
      ...cloud,
      pull: async () => {
        throw Error("offline");
      },
    }),
  );
  assert.equal(a.store.pending("u"), true);
  await synchronize(a.store, "u", cloud);
  await synchronize(b.store, "u", cloud);
  assert.equal(b.store.read("u").library.timers.t, null);
  assert.equal(b.store.read("u").library.sequences.s, null);
  assert.equal(b.store.read("u").library.folders.f, null);
  await synchronize(b.store, "u", cloud);
  assert.equal(cloud.value.library.timers.t, null);
});
test("concurrent same-ID edits require explicit choice; keep both remaps all references", async () => {
  const a = device(),
    b = device(),
    cloud = server();
  ready(a.store, "u", library());
  await synchronize(a.store, "u", cloud);
  ready(b.store, "u");
  await synchronize(b.store, "u", cloud);
  a.store.set("u", "interval-timers.v1", JSON.stringify([{ ...library().timers.t, name: "A" }]));
  b.store.set("u", "interval-timers.v1", JSON.stringify([{ ...library().timers.t, name: "B" }]));
  await synchronize(a.store, "u", cloud);
  const result = await synchronize(b.store, "u", cloud);
  assert.equal(result.status, "review");
  assert.equal(cloud.value.library.timers.t.name, "A");
  assert.equal(b.store.read("u").library.timers.t.name, "B");
  let id = 0;
  resolveReview(b.store, "u", result.review, "both", () => `copy${++id}`, keepBoth);
  await synchronize(b.store, "u", cloud);
  const l = cloud.value.library;
  assert.equal(Object.values(l.timers).filter(Boolean).length, 2);
  assert.deepEqual(relationshipIssues(l), []);
  assert.ok([...b.values.keys()].some((k) => k.includes(":backup:")));
});
test("CAS race retries against latest remote without overwriting concurrent changes", async () => {
  const { store } = device(),
    cloud = server();
  ready(store, "u", library());
  let raced = false;
  const transport = {
    pull: cloud.pull,
    push: async (rev, l) => {
      if (!raced) {
        raced = true;
        const r = cloud.value.library;
        r.folders.x = { id: "x", name: "Concurrente", parentId: null };
        await cloud.push(rev, r);
      }
      return cloud.push(rev, l);
    },
  };
  assert.equal((await synchronize(store, "u", transport)).status, "synced");
  assert.ok(cloud.value.library.folders.x);
  assert.ok(cloud.value.library.timers.t);
});
test("edits during upload stay pending and are sent by the next round", async () => {
  const { store } = device(),
    cloud = server();
  ready(store, "u", library());
  const transport = {
    pull: cloud.pull,
    push: async (rev, l) => {
      store.set(
        "u",
        "interval-timers.v1",
        JSON.stringify([{ ...library().timers.t, name: "Durante envío" }]),
      );
      return cloud.push(rev, l);
    },
  };
  assert.equal((await synchronize(store, "u", transport)).status, "pending");
  assert.equal(store.read("u").library.timers.t.name, "Durante envío");
  await synchronize(store, "u", cloud);
  assert.equal(cloud.value.library.timers.t.name, "Durante envío");
});
test("possible duplicates by name are not merged by ID and review gate survives reopening", async () => {
  const { store, values } = device(),
    cloud = server(),
    l = library(),
    r = emptyLibrary();
  r.folders.other = { id: "other", name: "Rutina", parentId: null };
  assert.deepEqual(possibleDuplicates(l, r), ["Rutina"]);
  await cloud.push(0, r);
  ready(store, "u", l);
  const e = store.read("u");
  store.write("u", { ...e, reviewRequired: true });
  const reopened = new LocalLibraries(store.storage);
  const result = await synchronize(reopened, "u", cloud);
  assert.equal(result.status, "review");
  assert.equal(cloud.value.revision, 1);
  assert.equal(reopened.pending("u"), true);
});
test("edit versus deletion and cross-record orphaning are reviewed rather than discarded", () => {
  const base = library(),
    local = structuredClone(base),
    remote = structuredClone(base);
  local.timers.t.name = "Edición";
  remote.timers.t = null;
  assert.equal(mergeLibraries(base, local, remote).conflicts.length, 1);
  const local2 = structuredClone(base);
  local2.sequences.new = { ...base.sequences.s, id: "new" };
  remote.sequences.s = null;
  assert.ok(relationshipIssues(mergeLibraries(base, local2, remote).merged).length);
});
test("storage failure leaves the last durable envelope intact; stale review cannot erase new edits", async () => {
  const d = device(),
    cloud = server();
  ready(d.store, "u", library());
  const before = d.values.get(accountKey("u"));
  const failing = new LocalLibraries({
    getItem: (k) => d.values.get(k) ?? null,
    setItem: () => {
      throw Error("Quota");
    },
  });
  assert.throws(() => failing.set("u", "interval-timers.v1", "[]"), /Quota/);
  assert.equal(d.values.get(accountKey("u")), before);
  const remote = library();
  remote.timers.t.name = "Nube";
  await cloud.push(0, remote);
  const result = await synchronize(d.store, "u", cloud);
  d.store.set(
    "u",
    "interval-timers.v1",
    JSON.stringify([{ ...library().timers.t, name: "Más reciente" }]),
  );
  assert.throws(
    () => resolveReview(d.store, "u", result.review, "remote", () => "", keepBoth),
    /cambios nuevos/,
  );
});
