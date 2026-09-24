import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  expandTimer,
  formatClock,
  formatHuman,
  timerNotifications,
  timerVoice,
  type Step,
  type TimerPreset,
} from "@/lib/timer-model";
import { getTimer } from "@/lib/timer-storage";
import {
  notify,
  reportRunning,
  requestNotificationPermission,
  speak,
  stopSpeaking,
} from "@/lib/announcer";

export const Route = createFileRoute("/play/$timerId")({
  head: () => ({
    meta: [
      { title: "Reproductor — Intervalos" },
      {
        name: "description",
        content:
          "Ejecutá tu temporizador por intervalos con avisos de voz y controles de etapa.",
      },
      { property: "og:title", content: "Reproductor — Intervalos" },
      {
        property: "og:description",
        content: "Tiempo restante, etapa actual, repeticiones y controles rápidos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Player,
});

function Player() {
  const { timerId } = Route.useParams();
  const [timer, setTimer] = useState<TimerPreset | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  // Ajustes de avisos congelados al abrir la sesión (una copia propia).
  const [settings, setSettings] = useState({ voice: true, notifications: true });

  // Base de tiempo real: no dependemos de la frecuencia del intervalo visual.
  const deadlineRef = useRef<number | null>(null);
  const announcedRef = useRef<string | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    // Copia profunda: editar el temporizador no altera esta sesión.
    const found = getTimer(timerId);
    const t = found ? (JSON.parse(JSON.stringify(found)) as TimerPreset) : null;
    setTimer(t);
    if (t) {
      setSettings({ voice: timerVoice(t), notifications: timerNotifications(t) });
      const s = expandTimer(t);
      setSteps(s);
      setRemaining(s[0]?.duration ?? 0);
    }
  }, [timerId]);

  const announce = useCallback((step: Step) => {
    if (announcedRef.current === step.key) return;
    announcedRef.current = step.key;
    stopSpeaking(); // cancela cualquier locución atrasada
    if (settingsRef.current.voice) speak(step.stageName);
    if (settingsRef.current.notifications)
      notify(`Etapa: ${step.stageName}`, `${step.blockName} · repetición ${step.repeatIndex}/${step.repeatTotal}`);
  }, []);

  // Motor: un tick frecuente que recalcula contra el reloj del sistema.
  useEffect(() => {
    if (!running) return;
    reportRunning(true);
    const id = window.setInterval(() => {
      const deadline = deadlineRef.current;
      if (deadline == null) return;
      const left = (deadline - Date.now()) / 1000;
      if (left > 0) {
        setRemaining(left);
        return;
      }
      // avanzar (puede saltar varias etapas si la app estuvo suspendida)
      setIndex((prev) => {
        let next = prev + 1;
        let overflow = -left;
        let candidate = steps[next];
        while (candidate && overflow >= candidate.duration) {
          overflow -= candidate.duration;
          next += 1;
          candidate = steps[next];
        }
        const step = steps[next];
        if (!step) {
          deadlineRef.current = null;
          setRunning(false);
          setFinished(true);
          setRemaining(0);
          reportRunning(false);
          if (settingsRef.current.voice) speak("Temporizador finalizado");
          if (settingsRef.current.notifications)
            notify("Temporizador finalizado", "La secuencia terminó.");
          return prev;
        }
        deadlineRef.current = Date.now() + (step.duration - overflow) * 1000;
        setRemaining(step.duration - overflow);
        announce(step);
        return next;
      });
    }, 200);
    return () => {
      window.clearInterval(id);
      reportRunning(false);
    };
  }, [running, steps, announce]);

  const goTo = useCallback(
    (newIndex: number, keepRunning: boolean) => {
      if (steps.length === 0) return;
      const clamped = Math.max(0, Math.min(steps.length - 1, newIndex));
      const step = steps[clamped];
      if (!step) return;
      setIndex(clamped);
      setFinished(false);
      setRemaining(step.duration);
      deadlineRef.current = keepRunning ? Date.now() + step.duration * 1000 : null;
      announcedRef.current = null;
      if (keepRunning) announce(step);
      else stopSpeaking();
    },
    [steps, announce],
  );

  const start = async () => {
    if (steps.length === 0) return;
    if (settings.notifications) await requestNotificationPermission();
    const step = steps[index];
    const first = steps[0];
    if (!step || !first) return;
    if (finished) {
      setFinished(false);
      setIndex(0);
      deadlineRef.current = Date.now() + first.duration * 1000;
      setRemaining(first.duration);
      announcedRef.current = null;
      announce(first);
    } else {
      deadlineRef.current = Date.now() + remaining * 1000;
      announce(step);
    }
    setRunning(true);
  };

  const pause = () => {
    setRunning(false);
    deadlineRef.current = null;
    stopSpeaking();
  };

  const reset = () => {
    setRunning(false);
    setFinished(false);
    deadlineRef.current = null;
    announcedRef.current = null;
    stopSpeaking();
    setIndex(0);
    setRemaining(steps[0]?.duration ?? 0);
  };

  // Atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        running ? pause() : start();
      }
      if (e.code === "ArrowRight") goTo(index + 1, running);
      if (e.code === "ArrowLeft") goTo(index - 1, running);
      if (e.key.toLowerCase() === "r") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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

  const current = steps[index];
  const next = steps[index + 1];
  const elapsedBefore = steps.slice(0, index).reduce((a, s) => a + s.duration, 0);
  const total = steps.reduce((a, s) => a + s.duration, 0);
  const elapsed = elapsedBefore + ((current?.duration ?? 0) - remaining);
  const progress = current ? 1 - remaining / current.duration : 0;


  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild size="icon" variant="ghost">
            <Link to="/" search={timer.folderId ? { folder: timer.folderId } : {}}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="truncate text-xl font-semibold">{timer.name}</h1>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {formatClock(elapsed)} / {formatClock(total)}
        </span>
      </header>

      <section className="panel mt-6 flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          {finished
            ? "Finalizado"
            : `${current?.blockName ?? ""} · repetición ${current?.repeatIndex ?? 1}/${current?.repeatTotal ?? 1}`}
        </p>
        <h2 className="text-4xl font-bold uppercase text-primary">
          {finished ? "Temporizador finalizado" : (current?.stageName ?? "—")}
        </h2>
        <div className="clock-digits text-[6rem] leading-none sm:text-[8rem]">
          {formatClock(remaining)}
        </div>
        <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-surface-strong">
          <div
            className="h-full bg-primary transition-[width] duration-200"
            style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {next
            ? `Sigue: ${next.stageName} · ${formatHuman(next.duration)}`
            : "Última etapa"}
        </p>

        {finished && (
          <Button size="lg" onClick={start} className="mt-2">
            <RotateCcw className="mr-1 h-5 w-5" /> Volver a iniciar desde el principio
          </Button>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" variant="secondary" onClick={() => goTo(index - 1, running)}>
            <SkipBack className="mr-1 h-5 w-5" /> Anterior
          </Button>
          {running ? (
            <Button size="lg" onClick={pause}>
              <Pause className="mr-1 h-5 w-5" /> Pausar
            </Button>
          ) : (
            <Button size="lg" onClick={start}>
              <Play className="mr-1 h-5 w-5" /> Iniciar
            </Button>
          )}
          <Button size="lg" variant="secondary" onClick={() => goTo(index + 1, running)}>
            Siguiente <SkipForward className="ml-1 h-5 w-5" />
          </Button>
          <Button size="lg" variant="ghost" onClick={reset}>
            <RotateCcw className="mr-1 h-5 w-5" /> Reiniciar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Teclado: Espacio inicia o pausa · ← → cambian de etapa · R reinicia
        </p>
      </section>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Voz: {settings.voice ? "activada" : "desactivada"} · Notificaciones:{" "}
        {settings.notifications ? "activadas" : "desactivadas"} (se cambian en el editor)
      </p>
    </main>
  );
}
