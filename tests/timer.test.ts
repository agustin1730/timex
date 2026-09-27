import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  exampleTimer,
  emptyTimer,
  expandTimer,
  totalDuration,
  cloneBlock,
  cloneTimer,
} from "../src/lib/timer-model.ts";
import { TimerSession } from "../src/lib/timer-session.ts";

test("ejemplo: siete bloques, 113 etapas, 630 segundos y orden exacto", () => {
  const t = exampleTimer();
  assert.deepEqual(
    t.blocks.map((b) => [b.name, b.repeats, b.stages.map((s) => [s.name, s.duration])]),
    [
      [
        "Round 1",
        15,
        [
          ["Trabajo", 5],
          ["Descanso", 2],
        ],
      ],
      ["Descanso", 1, [["Descanso", 60]]],
      [
        "Round 2",
        15,
        [
          ["Trabajo", 5],
          ["Descanso", 5],
        ],
      ],
      ["Descanso", 1, [["Descanso", 60]]],
      [
        "Round 3",
        10,
        [
          ["Trabajo", 10],
          ["Descanso", 5],
        ],
      ],
      ["Descanso", 1, [["Descanso", 60]]],
      [
        "Round 4",
        15,
        [
          ["Trabajo", 1],
          ["Descanso", 2],
        ],
      ],
    ],
  );
  assert.equal(totalDuration(t), 630);
  assert.equal(expandTimer(t).length, 113);
});

test("copias profundas conservan ajustes y carpeta; nuevos activan ambos avisos", () => {
  const t = exampleTimer();
  t.voice = false;
  t.notifications = true;
  t.folderId = "carpeta";
  const c = cloneTimer(t);
  const b = cloneBlock(t.blocks[0]);
  assert.equal(c.folderId, t.folderId);
  assert.equal(c.voice, false);
  assert.equal(c.notifications, true);
  assert.notEqual(c.id, t.id);
  assert.notEqual(c.blocks[0].id, t.blocks[0].id);
  assert.notEqual(c.blocks[0].stages[0].id, t.blocks[0].stages[0].id);
  c.blocks[0].stages[0].duration = 999;
  b.stages[0].name = "Copia";
  assert.equal(t.blocks[0].stages[0].duration, 5);
  assert.equal(t.blocks[0].stages[0].name, "Trabajo");
  assert.equal(emptyTimer().voice, true);
  assert.equal(emptyTimer().notifications, true);
});

function fixture() {
  let time = 0;
  const events = [];
  let completed = 0;
  const t = exampleTimer();
  const session = new TimerSession(
    t,
    () => time,
    (s) => events.push(s.key),
    () => completed++,
  );
  return {
    t,
    session,
    events,
    advance: (ms) => {
      time += ms;
      session.tick();
    },
    completed: () => completed,
  };
}

test("Siguiente y Anterior cruzan TODOS los límites activos y pausados desde cero", () => {
  for (const active of [false, true]) {
    const { session: s, advance } = fixture();
    if (active) s.start();
    for (let i = 1; i < s.steps.length; i++) {
      advance(100);
      s.goTo(i);
      assert.equal(s.state.index, i);
      assert.equal(s.state.remaining, s.steps[i].duration);
      assert.equal(s.state.running, active);
    }
    for (let i = s.steps.length - 2; i >= 0; i--) {
      advance(100);
      s.goTo(i);
      assert.equal(s.state.index, i);
      assert.equal(s.state.remaining, s.steps[i].duration);
      assert.equal(s.state.running, active);
    }
    s.goTo(-1);
    assert.equal(s.state.index, 0);
    s.goTo(999);
    assert.equal(s.state.index, 112);
  }
});

test("pausa exacta, reanudación sin aviso repetido y reinicio", () => {
  const { session: s, advance, events } = fixture();
  s.start();
  s.start();
  advance(1234);
  s.pause();
  assert.equal(s.state.remaining, 3.766);
  advance(10000);
  assert.equal(s.state.remaining, 3.766);
  s.start();
  assert.equal(events.length, 1);
  advance(3766);
  assert.equal(s.state.index, 1);
  assert.equal(events.length, 2);
  s.reset();
  assert.deepEqual(s.state, { index: 0, remaining: 5, running: false, finished: false });
  s.start();
  assert.equal(events.length, 3);
});

test("113 avisos, incluidas etapas de 1 y 2 segundos; final único a los 630 segundos", () => {
  const { session: s, advance, events, completed } = fixture();
  s.start();
  for (let i = 0; i < 6300; i++) advance(100);
  assert.equal(events.length, 113);
  assert.equal(new Set(events).size, 113);
  assert.equal(completed(), 1);
  assert.equal(s.state.finished, true);
  assert.equal(s.state.running, false);
  assert.equal(s.state.remaining, 0);
  advance(10000);
  assert.equal(completed(), 1);
  s.start();
  assert.equal(s.state.index, 0);
  assert.equal(s.state.remaining, 5);
  assert.equal(events.length, 114);
});

test("retraso del reloj no deriva la duración ni pierde el final", () => {
  const { session: s, advance, events, completed } = fixture();
  s.start();
  advance(630000);
  assert.equal(events.length, 113);
  assert.equal(completed(), 1);
  assert.equal(s.state.finished, true);
});

test("editar preset durante sesión no modifica contenido ni ajustes capturados", () => {
  const { t, session: s } = fixture();
  s.start();
  t.voice = false;
  t.notifications = false;
  t.blocks[0].stages[0].duration = 100;
  assert.equal(s.timer.voice, true);
  assert.equal(s.timer.notifications, true);
  assert.equal(s.steps[0].duration, 5);
});
