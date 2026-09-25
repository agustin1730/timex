import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { exampleTimer, emptyTimer } from "../src/lib/timer-model.ts";
import {
  exampleSequence,
  sequenceDuration,
  expandSequence,
  flattenLegacyRepeats,
  cloneSequence,
  validateSequence,
  removeTimerReferences,
  transitionItem,
} from "../src/lib/sequence-model.ts";
import { TimelineSession } from "../src/lib/timer-session.ts";
import {
  loadTimers,
  loadSequences,
  upsertTimer,
  upsertSequence,
  deleteTimer,
  createFolder,
  deleteFolder,
  affectedSequences,
  sequenceDeletionWarning,
  folderTimerIds,
  deleteSequence,
} from "../src/lib/timer-storage.ts";
const data = new Map();
globalThis.window = {
  localStorage: { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) },
  addEventListener() {},
  removeEventListener() {},
};
beforeEach(() => data.clear());
const fixture = () => {
  const t = emptyTimer();
  t.voice = false;
  t.notifications = true;
  t.blocks = [
    {
      id: "b",
      name: "Bloque",
      repeats: 2,
      stages: [
        { id: "work", name: "Trabajo", duration: 1 },
        { id: "rest", name: "Descanso", duration: 2 },
      ],
    },
  ];
  const transition = { ...transitionItem(), duration: 3, voice: true, notifications: false };
  const s = {
    id: "s",
    name: "Prueba",
    updatedAt: 0,
    nodes: [
      { id: "ref", kind: "timer", timerId: t.id },
      transition,
      { id: "ref2", kind: "timer", timerId: t.id },
    ],
  };
  return { t, s };
};
test("ejemplo 21:30, 227 etapas, referencias repetidas únicas y siembra idempotente", () => {
  const t = exampleTimer(),
    s = exampleSequence();
  assert.equal(sequenceDuration(s, [t]), 1290);
  const steps = expandSequence(s, [t]);
  assert.equal(steps.length, 227);
  assert.equal(new Set(steps.map((s) => s.key)).size, 227);
  assert.equal(steps[113].stageName, "Preparación");
  const before = JSON.stringify(loadTimers());
  assert.equal(loadSequences().length, 1);
  assert.equal(loadSequences().length, 1);
  assert.equal(JSON.stringify(loadTimers()), before);
  deleteSequence(loadSequences()[0].id);
  assert.deepEqual(loadSequences(), []);
});
test("tramo dos veces temporizador y transición: orden, repeticiones internas y duración", () => {
  const { t, s } = fixture();
  const grouped = groupRange(s, 0, 1, 2);
  assert.equal(sequenceDuration(grouped, [t]), 24);
  const steps = expandSequence(grouped, [t]);
  assert.deepEqual(
    steps.map((s) => s.duration),
    [1, 2, 1, 2, 3, 1, 2, 1, 2, 3, 1, 2, 1, 2],
  );
  assert.equal(steps[5].groupIndex, 2);
  assert.equal(steps[4].voice, true);
  assert.equal(steps[4].notifications, false);
  assert.equal(steps[0].voice, false);
  assert.equal(steps[0].notifications, true);
});
test("navegación activa y pausada cruza cada etapa, bloque, temporizador, transición y tramo", () => {
  const { t, s } = fixture();
  t.blocks.push({ ...t.blocks[0], id: "b2", repeats: 1 });
  const steps = expandSequence(groupRange(s, 0, 1, 2), [t]);
  for (const active of [false, true]) {
    const engine = new TimelineSession(
      steps,
      () => 0,
      () => {},
      () => {},
    );
    if (active) engine.start();
    for (let i = 0; i < steps.length; i++) {
      engine.goTo(i);
      assert.equal(engine.state.index, i);
      assert.equal(engine.state.remaining, steps[i].duration);
      assert.equal(engine.state.running, active);
    }
    for (let i = steps.length - 1; i >= 0; i--) {
      engine.goTo(i);
      assert.equal(engine.state.index, i);
      assert.equal(engine.state.remaining, steps[i].duration);
      assert.equal(engine.state.running, active);
    }
  }
});
test("reproducción automática: un aviso por etapa y final solo de secuencia, sin finales intermedios", () => {
  const { t, s } = fixture();
  let now = 0,
    finished = 0;
  const events = [];
  const steps = expandSequence(groupRange(s, 0, 1, 2), [t]);
  const engine = new TimelineSession(
    steps,
    () => now,
    (s) => events.push(s.key),
    () => finished++,
  );
  engine.start();
  for (let i = 0; i < 240; i++) {
    now += 100;
    engine.tick();
  }
  assert.equal(finished, 1);
  assert.equal(events.length, 14);
  assert.equal(new Set(events).size, 14);
  engine.tick();
  assert.equal(finished, 1);
  assert.equal(engine.state.finished, true);
  engine.start();
  assert.equal(engine.state.index, 0);
  assert.equal(engine.state.running, true);
});
test("referencias actuales recalculan; sesión y copia de secuencia independientes", () => {
  const { t, s } = fixture();
  const copy = cloneSequence(groupRange(s, 0, 1, 2));
  copy.nodes[0].items[1].name = "Otra";
  assert.equal(s.nodes[1].name, "Preparación");
  assert.equal(copy.nodes[0].items[0].timerId, t.id);
  const engine = new TimelineSession(
    expandSequence(s, [t]),
    () => 0,
    () => {},
    () => {},
  );
  engine.start();
  t.blocks[0].stages[0].duration = 5;
  t.voice = true;
  s.nodes[1].duration = 10;
  assert.equal(engine.steps[0].duration, 1);
  assert.equal(engine.steps[0].voice, false);
  assert.equal(engine.steps[4].duration, 3);
  assert.equal(sequenceDuration(s, [t]), 38);
  assert.equal(expandSequence(s, [t])[0].duration, 5);
});
test("eliminar temporizador avisa nombres, quita TODAS las apariciones y limpia tramos vacíos", () => {
  const { t, s } = fixture();
  upsertTimer(t);
  upsertSequence(groupRange(s, 0, 0, 2));
  assert.equal(affectedSequences([t.id]).length, 1);
  assert.match(sequenceDeletionWarning([t.id]), /Prueba/);
  deleteTimer(t.id);
  const result = loadSequences().find((x) => x.id === s.id);
  assert.equal(result.nodes.length, 1);
  assert.equal(result.nodes[0].kind, "transition");
  assert.equal(sequenceDuration(result, loadTimers()), 3);
  upsertSequence(s);
  assert.equal(loadSequences().find((x) => x.id === s.id).nodes.length, 1);
});
test("carpeta y subcarpeta eliminadas limpian referencias sin afectar otros temporizadores", () => {
  const { t, s } = fixture();
  const parent = createFolder("Padre", null),
    child = createFolder("Hija", parent.id);
  t.folderId = child.id;
  upsertTimer(t);
  upsertSequence(groupRange(s, 0, 1, 2));
  assert.deepEqual(folderTimerIds(parent.id), [t.id]);
  assert.match(sequenceDeletionWarning(folderTimerIds(parent.id)), /Prueba/);
  const before = JSON.stringify(loadSequences());
  assert.equal(JSON.stringify(loadSequences()), before);
  deleteFolder(parent.id);
  const result = loadSequences().find((x) => x.id === s.id);
  assert.equal(sequenceDuration(result, loadTimers()), 6);
  assert.ok(loadTimers().some((t) => t.id === "ejemplo-intervalos"));
});
test("vacío, referencia faltante y transición inválida impiden ejecutar", () => {
  const { t, s } = fixture();
  s.nodes = [];
  assert.ok(validateSequence(s, [t]).length);
  assert.throws(() => expandSequence(s, [t]));
  s.nodes = [{ id: "r", kind: "repeat", repeats: 2, items: [] }];
  assert.ok(validateSequence(s, [t]).length);
  s.nodes = [{ id: "r", kind: "timer", timerId: "missing" }];
  assert.throws(() => expandSequence(s, [t]));
  s.nodes = [{ ...transitionItem(), duration: 0 }];
  assert.throws(() => expandSequence(s, [t]));
});

function groupRange(s, from, to, repeats) {
  return {
    ...s,
    nodes: [
      ...s.nodes.slice(0, from),
      { id: "legacy", kind: "repeat", repeats, items: s.nodes.slice(from, to + 1) },
      ...s.nodes.slice(to + 1),
    ],
  };
}

test("migración preserva orden, duración, referencias y ajustes; copias independientes", () => {
  const { t, s } = fixture();
  const legacy = groupRange(s, 0, 1, 2);
  const before = JSON.stringify(legacy);
  const flat = flattenLegacyRepeats(legacy);
  assert.equal(flat.nodes.length, 5);
  assert.equal(flat.convertedRepeatGroups, 1);
  assert.equal(sequenceDuration(flat, [t]), sequenceDuration(legacy, [t]));
  const signature = (sequence) =>
    expandSequence(sequence, [t]).map(
      ({ stageName, duration, voice, notifications, timerName, blockName, repeatIndex }) => ({
        stageName,
        duration,
        voice,
        notifications,
        timerName,
        blockName,
        repeatIndex,
      }),
    );
  assert.deepEqual(signature(flat), signature(legacy));
  assert.equal(new Set(flat.nodes.map((i) => i.id)).size, 5);
  assert.equal(flat.nodes[0].timerId, t.id);
  flat.nodes[1].name = "Cambio independiente";
  assert.equal(flat.nodes[3].name, "Preparación");
  assert.equal(JSON.stringify(legacy), before);
  assert.equal(flattenLegacyRepeats(flat), flat);
});
test("migración al cargar guarda respaldo previo y persiste sin duplicar al reabrir", () => {
  const { t, s } = fixture();
  upsertTimer(t);
  const raw = JSON.stringify([groupRange(s, 0, 1, 2)]);
  data.set("interval-timers.sequences.v1", raw);
  data.set("interval-timers.sequence-example.v1", "1");
  const result = loadSequences();
  assert.equal(data.get("interval-timers.sequences.before-expansion.v1"), raw);
  assert.equal(result[0].nodes.length, 5);
  assert.deepEqual(loadSequences(), result);
  assert.equal(data.get("interval-timers.sequences.v1"), JSON.stringify(result));
  upsertSequence(result[0]);
  assert.equal(data.get("interval-timers.sequences.before-expansion.v1"), raw);
});
test("tramo inválido o falta de espacio para respaldo no destruyen datos antiguos", () => {
  const { s } = fixture();
  const invalid = groupRange(s, 0, 1, 0);
  const raw = JSON.stringify([invalid]);
  data.set("interval-timers.sequences.v1", raw);
  assert.throws(() => loadSequences(), /originales se conservan/);
  assert.equal(data.get("interval-timers.sequences.v1"), raw);
  const valid = JSON.stringify([groupRange(s, 0, 1, 2)]);
  data.set("interval-timers.sequences.v1", valid);
  const original = window.localStorage.setItem;
  window.localStorage.setItem = () => {
    throw Error("QuotaExceededError");
  };
  try {
    assert.throws(() => loadSequences(), /QuotaExceeded/);
  } finally {
    window.localStorage.setItem = original;
  }
  assert.equal(data.get("interval-timers.sequences.v1"), valid);
});
