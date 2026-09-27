import { test } from "node:test";
import assert from "node:assert/strict";
import { sequenceTimeline } from "../src/lib/sequence-timeline.ts";
import { expandSequence } from "../src/lib/sequence-model.ts";
import { TimelineSession } from "../src/lib/timer-session.ts";
const timer = {
  id: "t",
  name: "Trabajo",
  updatedAt: 0,
  voice: false,
  notifications: false,
  blocks: [
    {
      id: "b",
      name: "Bloque",
      repeats: 2,
      stages: [
        { id: "a", name: "A", duration: 1 },
        { id: "b", name: "B", duration: 2 },
      ],
    },
  ],
};
const sequence = {
  id: "s",
  name: "Ocho elementos",
  updatedAt: 0,
  nodes: Array.from({ length: 8 }, (_, i) =>
    i === 2 || i === 6
      ? {
          id: `i${i}`,
          kind: "transition",
          name: "Preparación",
          duration: 3,
          voice: false,
          notifications: false,
        }
      : { id: `i${i}`, kind: "timer", timerId: "t" },
  ),
};
test("ocho segmentos reales: seis temporizadores y dos transiciones, sin segmentos por bloque", () => {
  const steps = expandSequence(sequence, [timer]);
  const segments = sequenceTimeline(steps, {
    index: 0,
    remaining: 1,
    running: false,
    finished: false,
  });
  assert.equal(segments.length, 8);
  assert.deepEqual(
    segments.map((s) => s.duration),
    [6, 6, 3, 6, 6, 6, 3, 6],
  );
  assert.equal(
    segments.reduce((sum, s) => sum + s.duration, 0),
    42,
  );
  assert.ok(segments.every((s) => s.progress === 0));
  assert.equal(segments[0].status, "current");
  assert.equal(segments[1].status, "pending");
});
test("progreso real, pausa, salto de etapa y límites en ambos sentidos, reinicio y final", () => {
  let now = 0,
    finished = 0;
  const session = new TimelineSession(
    expandSequence(sequence, [timer]),
    () => now,
    () => {},
    () => finished++,
  );
  const timeline = () => sequenceTimeline(session.steps, session.state);
  session.start();
  now = 500;
  session.tick();
  assert.equal(timeline()[0].progress, 0.5 / 6);
  session.pause();
  now = 5000;
  session.tick();
  assert.equal(timeline()[0].progress, 0.5 / 6);
  session.goTo(1);
  assert.equal(timeline()[0].progress, 1 / 6);
  assert.equal(session.state.running, false);
  session.goTo(3);
  assert.equal(timeline()[0].progress, 4 / 6);
  session.goTo(4);
  assert.equal(timeline()[0].status, "completed");
  assert.equal(timeline()[1].progress, 0);
  session.goTo(8);
  assert.equal(timeline()[2].transition, true);
  assert.equal(timeline()[2].progress, 0);
  session.goTo(7);
  assert.equal(timeline()[1].progress, 4 / 6);
  assert.equal(timeline()[2].status, "pending");
  session.start();
  session.goTo(9);
  assert.equal(session.state.running, true);
  assert.equal(timeline()[3].progress, 0);
  session.reset();
  assert.ok(timeline().every((s) => s.progress === 0));
  session.start();
  now += 42000;
  session.tick();
  assert.equal(finished, 1);
  assert.ok(timeline().every((s) => s.progress === 1 && s.status === "completed"));
  session.goTo(0);
  assert.equal(timeline()[0].progress, 0);
  assert.equal(timeline()[1].status, "pending");
});
