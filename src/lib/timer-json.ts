import { stageColor, stageColors, type StageColor } from "./stage-colors.ts";
import { timerNotifications, timerVoice, type TimerPreset } from "./timer-model.ts";

export const TIMER_JSON_FORMAT = "time-x-timers";
export const TIMER_JSON_VERSION = 1;
export const MAX_TIMER_JSON_BYTES = 5 * 1024 * 1024;
const MAX_IMPORTED_TIMERS = 500;
const MAX_EXPANDED_STEPS_PER_FILE = 100_000;

export type TimerImportDraft = {
  name: string;
  voice: boolean;
  notifications: boolean;
  blocks: {
    name: string;
    repeats: number;
    stages: { name: string; duration: number; color: StageColor }[];
  }[];
};

type TimerJsonEnvelope = {
  format: typeof TIMER_JSON_FORMAT;
  version: typeof TIMER_JSON_VERSION;
  exportedAt: string;
  timers: TimerImportDraft[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireName(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}: falta el nombre.`);
  return value.trim();
}

function parseTimer(value: unknown, index: number): TimerImportDraft {
  const label = `Temporizador ${index + 1}`;
  if (!isRecord(value)) throw new Error(`${label}: el dato debe ser un objeto.`);
  const name = requireName(value["name"], label);
  if (value["voice"] !== undefined && typeof value["voice"] !== "boolean")
    throw new Error(`${label}: el ajuste de voz debe ser verdadero o falso.`);
  if (value["notifications"] !== undefined && typeof value["notifications"] !== "boolean")
    throw new Error(`${label}: el ajuste de notificaciones debe ser verdadero o falso.`);
  if (!Array.isArray(value["blocks"]) || value["blocks"].length === 0)
    throw new Error(`${label}: debe tener al menos un bloque.`);

  const blocks = value["blocks"].map((block, blockIndex) => {
    const blockLabel = `${label}, bloque ${blockIndex + 1}`;
    if (!isRecord(block)) throw new Error(`${blockLabel}: el dato debe ser un objeto.`);
    const blockName = requireName(block["name"], blockLabel);
    if (
      typeof block["repeats"] !== "number" ||
      !Number.isSafeInteger(block["repeats"]) ||
      block["repeats"] < 1
    )
      throw new Error(`${blockLabel}: las repeticiones deben ser un entero mayor que cero.`);
    if (!Array.isArray(block["stages"]) || block["stages"].length === 0)
      throw new Error(`${blockLabel}: debe tener al menos una etapa.`);
    const stages = block["stages"].map((stage, stageIndex) => {
      const stageLabel = `${blockLabel}, etapa ${stageIndex + 1}`;
      if (!isRecord(stage)) throw new Error(`${stageLabel}: el dato debe ser un objeto.`);
      if (
        typeof stage["duration"] !== "number" ||
        !Number.isSafeInteger(stage["duration"]) ||
        stage["duration"] <= 0
      )
        throw new Error(
          `${stageLabel}: la duración debe ser un entero de segundos mayor que cero.`,
        );
      if (stage["color"] !== undefined && !stageColors.includes(stage["color"] as StageColor))
        throw new Error(`${stageLabel}: el color no es compatible con Time X.`);
      return {
        name: requireName(stage["name"], stageLabel),
        duration: stage["duration"],
        color: stageColor(stage["color"]),
      };
    });
    return { name: blockName, repeats: block["repeats"], stages };
  });

  return {
    name,
    voice: value["voice"] !== false,
    notifications: value["notifications"] !== false,
    blocks,
  };
}

export function parseTimerJson(text: string): TimerImportDraft[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("El archivo no contiene un JSON válido.");
  }
  if (!isRecord(parsed) || parsed["format"] !== TIMER_JSON_FORMAT)
    throw new Error("El archivo no tiene el formato de temporizadores de Time X.");
  if (parsed["version"] !== TIMER_JSON_VERSION)
    throw new Error("La versión de este archivo no es compatible con esta versión de Time X.");
  if (!Array.isArray(parsed["timers"]) || parsed["timers"].length === 0)
    throw new Error("El archivo no contiene temporizadores.");
  if (parsed["timers"].length > MAX_IMPORTED_TIMERS)
    throw new Error(`El archivo supera el límite de ${MAX_IMPORTED_TIMERS} temporizadores.`);
  const timers = parsed["timers"].map(parseTimer);
  const expandedSteps = timers.reduce(
    (total, timer) =>
      total + timer.blocks.reduce((sum, block) => sum + block.repeats * block.stages.length, 0),
    0,
  );
  if (!Number.isSafeInteger(expandedSteps) || expandedSteps > MAX_EXPANDED_STEPS_PER_FILE)
    throw new Error(
      "La cantidad total de etapas repetidas del archivo supera el límite permitido.",
    );
  return timers;
}

export function createTimerJson(timers: TimerPreset[]): string {
  const envelope: TimerJsonEnvelope = {
    format: TIMER_JSON_FORMAT,
    version: TIMER_JSON_VERSION,
    exportedAt: new Date().toISOString(),
    timers: timers.map((timer) => ({
      name: timer.name,
      voice: timerVoice(timer),
      notifications: timerNotifications(timer),
      blocks: timer.blocks.map((block) => ({
        name: block.name,
        repeats: block.repeats,
        stages: block.stages.map((stage) => ({
          name: stage.name,
          duration: stage.duration,
          color: stageColor(stage.color),
        })),
      })),
    })),
  };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export function downloadTimerJson(timer: TimerPreset) {
  const slug =
    timer.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "temporizador";
  const blob = new Blob([createTimerJson([timer])], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `time-x-${slug}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
