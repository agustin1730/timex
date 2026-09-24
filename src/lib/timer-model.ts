export type Stage = {
  id: string;
  name: string;
  /** duración en segundos */
  duration: number;
};

export type Block = {
  id: string;
  name: string;
  stages: Stage[];
  repeats: number;
};

export type TimerPreset = {
  id: string;
  name: string;
  blocks: Block[];
  updatedAt: number;
  /** Anunciar etapas con voz (por temporizador) */
  voice?: boolean;
  /** Mostrar notificaciones (por temporizador) */
  notifications?: boolean;
  /** Carpeta o subcarpeta; null/undefined = biblioteca principal */
  folderId?: string | null;
};

export type Folder = {
  id: string;
  name: string;
  /** null = carpeta de primer nivel; id = subcarpeta */
  parentId: string | null;
};

export const timerVoice = (t: TimerPreset) => t.voice !== false;
export const timerNotifications = (t: TimerPreset) => t.notifications !== false;

export function cloneBlock(b: Block): Block {
  return { ...b, id: uid(), stages: b.stages.map((s) => ({ ...s, id: uid() })) };
}

export function cloneTimer(t: TimerPreset): TimerPreset {
  return {
    ...t,
    id: uid(),
    name: `${t.name} (copia)`,
    voice: timerVoice(t),
    notifications: timerNotifications(t),
    folderId: t.folderId ?? null,
    blocks: t.blocks.map(cloneBlock),
  };
}

/** Una etapa ya expandida en la línea de tiempo final */
export type Step = {
  key: string;
  stageName: string;
  blockName: string;
  blockIndex: number;
  repeatIndex: number;
  repeatTotal: number;
  duration: number;
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export function expandTimer(timer: TimerPreset): Step[] {
  const steps: Step[] = [];
  timer.blocks.forEach((block, blockIndex) => {
    const repeats = Math.max(1, Math.floor(block.repeats || 1));
    for (let r = 0; r < repeats; r++) {
      block.stages.forEach((stage, si) => {
        if (stage.duration <= 0) return;
        steps.push({
          key: `${block.id}-${r}-${stage.id}-${si}`,
          stageName: stage.name.trim() || "Etapa",
          blockName: block.name.trim() || `Bloque ${blockIndex + 1}`,
          blockIndex,
          repeatIndex: r + 1,
          repeatTotal: repeats,
          duration: stage.duration,
        });
      });
    }
  });
  return steps;
}

export function totalDuration(timer: TimerPreset): number {
  return expandTimer(timer).reduce((acc, s) => acc + s.duration, 0);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatHuman(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec} s`;
  if (sec === 0) return `${m} min`;
  return `${m} min ${sec} s`;
}

export type ValidationIssue = { message: string };

export function validateTimer(timer: TimerPreset): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!timer.name.trim()) issues.push({ message: "El temporizador necesita un nombre." });
  if (timer.blocks.length === 0) issues.push({ message: "Agregá al menos un bloque." });
  timer.blocks.forEach((b, i) => {
    const label = b.name.trim() || `Bloque ${i + 1}`;
    if (b.stages.length === 0) issues.push({ message: `«${label}» no tiene etapas.` });
    if (!b.repeats || b.repeats < 1)
      issues.push({ message: `«${label}» debe repetirse al menos una vez.` });
    b.stages.forEach((s, si) => {
      if (s.duration <= 0)
        issues.push({
          message: `La etapa ${si + 1} de «${label}» debe durar más de cero.`,
        });
    });
  });
  return issues;
}

export function emptyTimer(folderId: string | null = null): TimerPreset {
  return {
    id: uid(),
    name: "Nuevo temporizador",
    updatedAt: Date.now(),
    voice: true,
    notifications: true,
    folderId,
    blocks: [
      {
        id: uid(),
        name: "Bloque 1",
        repeats: 1,
        stages: [{ id: uid(), name: "Trabajo", duration: 60 }],
      },
    ],
  };
}

export const EXAMPLE_ID = "ejemplo-intervalos";

function round(name: string, repeats: number, work: number, rest: number): Block {
  return {
    id: uid(),
    name,
    repeats,
    stages: [
      { id: uid(), name: "Trabajo", duration: work },
      { id: uid(), name: "Descanso", duration: rest },
    ],
  };
}

function restBlock(): Block {
  return { id: uid(), name: "Descanso", repeats: 1, stages: [{ id: uid(), name: "Descanso", duration: 60 }] };
}

export function exampleTimer(): TimerPreset {
  return {
    id: EXAMPLE_ID,
    name: "Ejemplo: intervalos de trabajo",
    updatedAt: Date.now(),
    voice: true,
    notifications: true,
    folderId: null,
    blocks: [
      round("Round 1", 15, 5, 2),
      restBlock(),
      round("Round 2", 15, 5, 5),
      restBlock(),
      round("Round 3", 10, 10, 5),
      restBlock(),
      round("Round 4", 15, 1, 2),
    ],
  };
}
