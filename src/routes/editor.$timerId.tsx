import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Play, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  expandTimer,
  formatHuman,
  uid,
  totalDuration,
  validateTimer,
  type Block,
  type TimerPreset,
} from "@/lib/timer-model";
import { getTimer, upsertTimer } from "@/lib/timer-storage";

export const Route = createFileRoute("/editor/$timerId")({
  head: () => ({
    meta: [
      { title: "Editor de temporizador — Intervalos" },
      {
        name: "description",
        content: "Editá bloques, etapas, duraciones y repeticiones de tu temporizador.",
      },
      { property: "og:title", content: "Editor de temporizador — Intervalos" },
      {
        property: "og:description",
        content: "Bloques con etapas, duraciones y repeticiones, con vista previa.",
      },
    ],
  }),
  component: Editor,
});

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  if (item === undefined) return arr;
  copy.splice(to, 0, item);
  return copy;
}

function Editor() {
  const { timerId } = Route.useParams();
  const router = useRouter();
  const [timer, setTimer] = useState<TimerPreset | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTimer(getTimer(timerId) ?? null);
  }, [timerId]);

  if (!timer) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 text-center">
        <p className="text-muted-foreground">Temporizador no encontrado.</p>
        <Button asChild className="mt-4">
          <Link to="/">Volver a la biblioteca</Link>
        </Button>
      </main>
    );
  }

  const patch = (next: Partial<TimerPreset>) => {
    setTimer({ ...timer, ...next });
    setSaved(false);
  };

  const patchBlock = (index: number, next: Partial<Block>) => {
    const blocks = timer.blocks.map((b, i) => (i === index ? { ...b, ...next } : b));
    patch({ blocks });
  };

  const issues = validateTimer(timer);
  const steps = expandTimer(timer);

  const save = () => {
    upsertTimer(timer);
    setSaved(true);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild size="icon" variant="ghost">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <Label htmlFor="name" className="text-xs uppercase text-muted-foreground">
              Nombre
            </Label>
            <Input
              id="name"
              value={timer.name}
              onChange={(e) => patch({ name: e.target.value })}
              className="mt-1 text-lg font-semibold"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end">
          <Button variant="secondary" onClick={save}>
            <Save className="mr-1 h-4 w-4" /> {saved ? "Guardado" : "Guardar"}
          </Button>
          <Button
            disabled={issues.length > 0}
            onClick={() => {
              upsertTimer(timer);
              router.navigate({ to: "/play/$timerId", params: { timerId: timer.id } });
            }}
          >
            <Play className="mr-1 h-4 w-4" /> Iniciar
          </Button>
        </div>
      </header>

      <section className="mt-8 space-y-4">
        {timer.blocks.map((block, bi) => (
          <article key={block.id} className="panel p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
              <div className="min-w-0">
                <Label className="text-xs uppercase text-muted-foreground">
                  Bloque {bi + 1}
                </Label>
                <Input
                  value={block.name}
                  onChange={(e) => patchBlock(bi, { name: e.target.value })}
                  className="mt-1 font-semibold"
                />
              </div>
              <div className="flex shrink-0 items-end gap-2">
                <div className="w-24">
                  <Label className="text-xs uppercase text-muted-foreground">
                    Repetir
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={block.repeats}
                    onChange={(e) =>
                      patchBlock(bi, { repeats: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="mt-1"
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Subir bloque"
                  onClick={() => patch({ blocks: move(timer.blocks, bi, bi - 1) })}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Bajar bloque"
                  onClick={() => patch({ blocks: move(timer.blocks, bi, bi + 1) })}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Eliminar bloque"
                  onClick={() =>
                    patch({ blocks: timer.blocks.filter((_, i) => i !== bi) })
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {block.stages.map((stage, si) => {
                const minutes = Math.floor(stage.duration / 60);
                const seconds = stage.duration % 60;
                const setDuration = (m: number, s: number) =>
                  patchBlock(bi, {
                    stages: block.stages.map((st, i) =>
                      i === si
                        ? { ...st, duration: Math.max(0, m) * 60 + Math.max(0, s) }
                        : st,
                    ),
                  });
                return (
                  <div
                    key={stage.id}
                    className="flex flex-wrap items-end gap-2 rounded-lg bg-surface-strong p-3"
                  >
                    <div className="min-w-40 flex-1">
                      <Label className="text-xs uppercase text-muted-foreground">
                        Etapa {si + 1}
                      </Label>
                      <Input
                        value={stage.name}
                        onChange={(e) =>
                          patchBlock(bi, {
                            stages: block.stages.map((st, i) =>
                              i === si ? { ...st, name: e.target.value } : st,
                            ),
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                    <div className="w-20">
                      <Label className="text-xs uppercase text-muted-foreground">
                        Min
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={minutes}
                        onChange={(e) => setDuration(Number(e.target.value) || 0, seconds)}
                        className="mt-1"
                      />
                    </div>
                    <div className="w-20">
                      <Label className="text-xs uppercase text-muted-foreground">
                        Seg
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        value={seconds}
                        onChange={(e) => setDuration(minutes, Number(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Subir etapa"
                      onClick={() =>
                        patchBlock(bi, { stages: move(block.stages, si, si - 1) })
                      }
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Bajar etapa"
                      onClick={() =>
                        patchBlock(bi, { stages: move(block.stages, si, si + 1) })
                      }
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Eliminar etapa"
                      onClick={() =>
                        patchBlock(bi, {
                          stages: block.stages.filter((_, i) => i !== si),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  patchBlock(bi, {
                    stages: [
                      ...block.stages,
                      { id: uid(), name: "Etapa", duration: 30 },
                    ],
                  })
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Agregar etapa
              </Button>
            </div>
          </article>
        ))}

        <Button
          variant="secondary"
          onClick={() =>
            patch({
              blocks: [
                ...timer.blocks,
                {
                  id: uid(),
                  name: `Bloque ${timer.blocks.length + 1}`,
                  repeats: 1,
                  stages: [{ id: uid(), name: "Etapa", duration: 30 }],
                },
              ],
            })
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Agregar bloque
        </Button>
      </section>

      <section className="panel mt-8 p-4">
        <h2 className="text-lg font-semibold uppercase tracking-wide">Vista previa</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Duración total: {formatHuman(totalDuration(timer))} · {steps.length} etapas
        </p>
        {issues.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-destructive">
            {issues.map((i) => (
              <li key={i.message}>• {i.message}</li>
            ))}
          </ul>
        )}
        <ol className="mt-4 space-y-1 text-sm">
          {steps.map((s, i) => (
            <li
              key={s.key}
              className="flex items-center justify-between rounded-md bg-surface-strong px-3 py-1.5"
            >
              <span className="truncate">
                <span className="text-muted-foreground">{i + 1}.</span> {s.stageName}
                <span className="text-muted-foreground">
                  {" "}
                  — {s.blockName} ({s.repeatIndex}/{s.repeatTotal})
                </span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatHuman(s.duration)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
