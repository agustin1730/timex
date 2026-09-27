import {
  expandTimer,
  totalDuration,
  timerVoice,
  timerNotifications,
  uid,
  EXAMPLE_ID,
  validateTimer,
  type TimerPreset,
  type Step,
} from "./timer-model.ts";

export type SequenceItem =
  | { id: string; kind: "timer"; timerId: string }
  | {
      id: string;
      kind: "transition";
      name: string;
      duration: number;
      voice: boolean;
      notifications: boolean;
    };
export type SequenceNode =
  SequenceItem | { id: string; kind: "repeat"; repeats: number; items: SequenceItem[] };
export type SequencePreset = {
  id: string;
  name: string;
  nodes: SequenceNode[];
  updatedAt: number;
  convertedRepeatGroups?: number;
};
export type SequenceStep = Step & {
  timerName: string;
  itemId: string;
  groupIndex: number;
  groupTotal: number;
  voice: boolean;
  notifications: boolean;
};
export const sequenceItems = (s: SequencePreset): SequenceItem[] =>
  s.nodes.flatMap((n) => (n.kind === "repeat" ? n.items : [n]));
export const emptySequence = (): SequencePreset => ({
  id: uid(),
  name: "Nueva secuencia",
  nodes: [],
  updatedAt: Date.now(),
});
export const transitionItem = (): SequenceItem => ({
  id: uid(),
  kind: "transition",
  name: "Preparación",
  duration: 30,
  voice: true,
  notifications: true,
});
export const EXAMPLE_SEQUENCE_ID = "ejemplo-secuencia";
export function exampleSequence(): SequencePreset {
  return {
    id: EXAMPLE_SEQUENCE_ID,
    name: "Ejemplo: trabajo con preparación",
    updatedAt: Date.now(),
    nodes: [
      { id: uid(), kind: "timer", timerId: EXAMPLE_ID },
      transitionItem(),
      { id: uid(), kind: "timer", timerId: EXAMPLE_ID },
    ],
  };
}
export function cloneSequence(s: SequencePreset): SequencePreset {
  return {
    ...s,
    id: uid(),
    name: s.name + " (copia)",
    updatedAt: Date.now(),
    nodes: s.nodes.map((n) =>
      n.kind === "repeat"
        ? { ...n, id: uid(), items: n.items.map((i) => ({ ...i, id: uid() })) }
        : { ...n, id: uid() },
    ),
  };
}
export function sequenceDuration(s: SequencePreset, timers: TimerPreset[]): number {
  const duration = (i: SequenceItem) =>
    i.kind === "transition"
      ? Number.isFinite(i.duration) && i.duration > 0
        ? i.duration
        : 0
      : totalDuration(
          timers.find((t) => t.id === i.timerId) ?? { id: "", name: "", blocks: [], updatedAt: 0 },
        );
  return s.nodes.reduce(
    (sum, n) =>
      sum +
      (n.kind === "repeat"
        ? n.items.reduce((a, i) => a + duration(i), 0) *
          (Number.isSafeInteger(n.repeats) && n.repeats > 0 ? n.repeats : 0)
        : duration(n)),
    0,
  );
}
export function validateSequence(s: SequencePreset, timers: TimerPreset[]): string[] {
  const issues: string[] = [];
  if (!s.name.trim()) issues.push("La secuencia necesita un nombre.");
  if (!s.nodes.length) issues.push("Agregá al menos un elemento.");
  for (const n of s.nodes)
    if (n.kind === "repeat") {
      if (!n.items.length) issues.push("Un tramo no puede estar vacío.");
      if (!Number.isSafeInteger(n.repeats) || n.repeats < 1)
        issues.push("Las repeticiones deben ser enteros mayores que cero.");
    }
  for (const i of sequenceItems(s)) {
    if (i.kind === "timer") {
      const t = timers.find((t) => t.id === i.timerId);
      if (!t) issues.push("Hay un temporizador que ya no existe. Quitá su referencia.");
      else if (validateTimer(t).length)
        issues.push(`Revisá el temporizador «${t.name}»: tiene etapas o repeticiones inválidas.`);
    } else if (!i.name.trim() || !Number.isFinite(i.duration) || i.duration <= 0)
      issues.push("Cada transición necesita nombre y duración mayor que cero.");
  }
  return [...new Set(issues)];
}
/** Compatibility only: flatten legacy groups without changing their playback order. */
export function flattenLegacyRepeats(s: SequencePreset): SequencePreset {
  const groups = s.nodes.filter((n) => n.kind === "repeat");
  if (!groups.length) return s;
  let count = 0;
  for (const n of s.nodes) {
    if (
      n.kind === "repeat" &&
      (!Number.isSafeInteger(n.repeats) || n.repeats < 1 || !n.items.length)
    )
      throw Error(
        "No se pudo convertir un tramo antiguo inválido. Los datos originales se conservan.",
      );
    count += n.kind === "repeat" ? n.items.length * n.repeats : 1;
  }
  if (!Number.isSafeInteger(count) || count > 100000)
    throw Error(
      "La secuencia antigua es demasiado grande para convertirla. Los datos originales se conservan.",
    );
  const nodes: SequenceItem[] = [];
  s.nodes.forEach((n, index) => {
    if (n.kind !== "repeat") {
      nodes.push(n);
      return;
    }
    for (let r = 0; r < n.repeats; r++)
      n.items.forEach((item, child) =>
        nodes.push({
          ...item,
          id: JSON.stringify(["expanded", s.id, index, n.id, r, child, item.id]),
        }),
      );
  });
  return { ...s, nodes, convertedRepeatGroups: (s.convertedRepeatGroups ?? 0) + groups.length };
}
export function removeTimerReferences(s: SequencePreset, ids: string[]): SequencePreset {
  const keep = (i: SequenceItem) => i.kind !== "timer" || !ids.includes(i.timerId);
  return {
    ...s,
    nodes: s.nodes.flatMap<SequenceNode>((n) => {
      if (n.kind !== "repeat") return keep(n) ? [n] : [];
      const items = n.items.filter(keep);
      return items.length ? [{ ...n, items }] : [];
    }),
    updatedAt: Date.now(),
  };
}
export function expandSequence(s: SequencePreset, timers: TimerPreset[]): SequenceStep[] {
  const issues = validateSequence(s, timers);
  if (issues.length) throw Error(issues.join(" "));
  const steps: SequenceStep[] = [];
  s.nodes.forEach((n) => {
    const items = n.kind === "repeat" ? n.items : [n];
    const repeats = n.kind === "repeat" ? n.repeats : 1;
    for (let r = 1; r <= repeats; r++)
      for (const i of items) {
        if (i.kind === "timer") {
          const t = timers.find((t) => t.id === i.timerId)!;
          steps.push(
            ...expandTimer(t).map((step) => ({
              ...step,
              key: `${n.id}/${r}/${i.id}/${step.key}`,
              timerName: t.name,
              itemId: i.id,
              groupIndex: r,
              groupTotal: repeats,
              voice: timerVoice(t),
              notifications: timerNotifications(t),
            })),
          );
        } else
          steps.push({
            key: `${n.id}/${r}/${i.id}`,
            stageName: i.name,
            duration: i.duration,
            blockName: "Transición",
            blockIndex: 0,
            repeatIndex: 1,
            repeatTotal: 1,
            timerName: "",
            itemId: i.id,
            groupIndex: r,
            groupTotal: repeats,
            voice: i.voice,
            notifications: i.notifications,
          });
      }
  });
  return steps;
}
