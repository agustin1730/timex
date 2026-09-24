import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Pencil, Play, Plus, Timer as TimerIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  emptyTimer,
  expandTimer,
  formatHuman,
  uid,
  totalDuration,
  type TimerPreset,
} from "@/lib/timer-model";
import {
  deleteTimer,
  loadSettings,
  loadTimers,
  saveSettings,
  upsertTimer,
  type AppSettings,
} from "@/lib/timer-storage";
import { requestNotificationPermission } from "@/lib/announcer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Intervalos — Biblioteca de temporizadores" },
      {
        name: "description",
        content:
          "Creá, guardá y ejecutá temporizadores por intervalos con bloques, etapas y repeticiones.",
      },
      { property: "og:title", content: "Intervalos — Biblioteca de temporizadores" },
      {
        property: "og:description",
        content: "Temporizadores por intervalos con bloques, repeticiones, voz y avisos.",
      },
    ],
  }),
  component: Library,
});

function Library() {
  const router = useRouter();
  const [timers, setTimers] = useState<TimerPreset[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    voice: true,
    notifications: true,
  });

  useEffect(() => {
    setTimers(loadTimers());
    setSettings(loadSettings());
  }, []);

  const refresh = () => setTimers(loadTimers());

  const updateSettings = async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    if (patch.notifications) await requestNotificationPermission();
    setSettings(next);
    saveSettings(next);
  };

  const create = () => {
    const t = emptyTimer();
    upsertTimer(t);
    router.navigate({ to: "/editor/$timerId", params: { timerId: t.id } });
  };

  const duplicate = (t: TimerPreset) => {
    upsertTimer({
      ...t,
      id: uid(),
      name: `${t.name} (copia)`,
      blocks: t.blocks.map((b) => ({
        ...b,
        id: uid(),
        stages: b.stages.map((s) => ({ ...s, id: uid() })),
      })),
    });
    refresh();
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <TimerIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold uppercase tracking-wide">
              Intervalos
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              Biblioteca de temporizadores guardados en esta computadora
            </p>
          </div>
        </div>
        <Button onClick={create} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" /> Nuevo
        </Button>
      </header>

      <section className="panel mt-8 flex flex-wrap items-center gap-6 p-4">
        <div className="flex items-center gap-3">
          <Switch
            id="voice"
            checked={settings.voice}
            onCheckedChange={(v) => updateSettings({ voice: v })}
          />
          <Label htmlFor="voice">Voz al comenzar cada etapa</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="notif"
            checked={settings.notifications}
            onCheckedChange={(v) => updateSettings({ notifications: v })}
          />
          <Label htmlFor="notif">Notificaciones del sistema</Label>
        </div>
      </section>

      <section className="mt-6 space-y-3">
        {timers.length === 0 && (
          <p className="panel p-8 text-center text-muted-foreground">
            Todavía no hay temporizadores guardados.
          </p>
        )}
        {timers.map((t) => {
          const steps = expandTimer(t);
          return (
            <article
              key={t.id}
              className="panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4"
            >
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{t.name}</h2>
                <p className="truncate text-sm text-muted-foreground">
                  {formatHuman(totalDuration(t))} · {t.blocks.length} bloques ·{" "}
                  {steps.length} etapas
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button asChild size="sm">
                  <Link to="/play/$timerId" params={{ timerId: t.id }}>
                    <Play className="mr-1 h-4 w-4" /> Iniciar
                  </Link>
                </Button>
                <Button asChild size="icon" variant="secondary" title="Editar">
                  <Link to="/editor/$timerId" params={{ timerId: t.id }}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  title="Duplicar"
                  onClick={() => duplicate(t)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Eliminar"
                  onClick={() => {
                    if (confirm(`¿Eliminar «${t.name}»?`)) {
                      deleteTimer(t.id);
                      refresh();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </article>
          );
        })}
      </section>

      <p className="mt-10 text-xs text-muted-foreground">
        Los datos se guardan localmente en esta computadora. Esta versión web es la base
        de la futura aplicación de escritorio para Windows.
      </p>
    </main>
  );
}
