import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { exampleTimer, cloneTimer } from "../src/lib/timer-model.ts";
import {
  loadTimers,
  saveTimers,
  createFolder,
  loadFolders,
  renameFolder,
  moveTimer,
  folderContents,
  deleteFolder,
  upsertTimer,
} from "../src/lib/timer-storage.ts";
const values = new Map();
globalThis.window = {
  localStorage: { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) },
  addEventListener() {},
  removeEventListener() {},
};
beforeEach(() => values.clear());

test("siembra única y conservación de todos los cambios de un ejemplo anterior", () => {
  assert.equal(loadTimers().length, 1);
  assert.equal(loadTimers().length, 1);
  values.clear();
  const t = exampleTimer();
  t.name = "Personalizado";
  t.voice = false;
  t.notifications = false;
  t.folderId = "x";
  t.blocks[0].repeats = 3;
  values.set("interval-timers.v1", JSON.stringify([t]));
  assert.deepEqual(loadTimers(), [t]);
  assert.deepEqual(loadTimers(), [t]);
});
test("ejemplo eliminado explícitamente no reaparece", () => {
  loadTimers();
  saveTimers([]);
  assert.deepEqual(loadTimers(), []);
});
test("carpetas dos niveles, renombrar, mover, duplicar y recargar", () => {
  const a = createFolder("Trabajo", null),
    b = createFolder("Mañana", a.id);
  assert.equal(createFolder("Tercer nivel", b.id), null);
  assert.equal(createFolder("Huérfana", "missing"), null);
  const t = loadTimers()[0];
  moveTimer(t.id, b.id);
  renameFolder(a.id, "Rutinas");
  renameFolder(b.id, "Tarde");
  const c = cloneTimer(loadTimers()[0]);
  upsertTimer(c);
  assert.equal(loadTimers()[1].folderId, b.id);
  assert.equal(loadFolders()[0].name, "Rutinas");
  assert.equal(loadFolders()[1].name, "Tarde");
  assert.deepEqual(folderContents(a.id), { subfolders: 1, timers: 2 });
  moveTimer(c.id, null);
  assert.equal(loadTimers()[1].folderId, null);
  moveTimer(c.id, "missing");
  assert.equal(loadTimers()[1].folderId, null);
  deleteFolder(a.id);
  assert.deepEqual(loadFolders(), []);
  assert.deepEqual(
    loadTimers().map((t) => t.id),
    [c.id],
  );
});
