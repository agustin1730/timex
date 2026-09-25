import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  formatClock,
  formatHuman,
  timerNotifications,
  timerVoice,
  type TimerPreset,
} from "@/lib/timer-model";
import { TimerSession, type Playback } from "@/lib/timer-session";
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
        content: "Ejecutá tu temporizador por intervalos con avisos de voz y controles de etapa.",
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
  const sessionRef = useRef<TimerSession | null>(null);
  const requestRef = useRef(0);
  const [starting, setStarting] = useState(false);
  const [playback, setPlayback] = useState<Playback>({
    index: 0,
    remaining: 0,
    running: false,
    finished: false,
  });
  const { index, remaining, running, finished } = playback;
  const steps = sessionRef.current?.steps ?? [];
  const settings = {
    voice: timer ? timerVoice(timer) : true,
    notifications: timer ? timerNotifications(timer) : true,
  };

  useEffect(() => {
    const found = getTimer(timerId);
    if (!found) {
      setTimer(null);
      return;
    }
    const session = new TimerSession(
      found,
      () => performance.now(),
      (step) => {
        stopSpeaking();
        if (timerVoice(session.timer)) speak(step.stageName);
        if (timerNotifications(session.timer))
          notify(
            "Etapa: " + step.stageName,
            step.blockName + " · repetición " + step.repeatIndex + "/" + step.repeatTotal,
          );
      },
      () => {
        stopSpeaking();
        if (timerVoice(session.timer)) speak("Temporizador finalizado");
        if (timerNotifications(session.timer))
          notify("Temporizador finalizado", "El temporizador terminó.");
        reportRunning(false);
      },
    );
    sessionRef.current = session;
    setTimer(session.timer);
    setPlayback(session.state);
    setStarting(false);
    const id = window.setInterval(() => {
      if (!session.state.running) return;
      session.tick();
      setPlayback(session.state);
    }, 100);
    return () => {
      window.clearInterval(id);
      sessionRef.current = null;
      stopSpeaking();
      reportRunning(false);
    };
  }, [timerId]);

  const cancelPending = () => {
    requestRef.current++;
    setStarting(false);
  };
  const start = async () => {
    const session = sessionRef.current;
    if (!session || !session.steps.length || session.state.running || starting) return;
    const request = ++requestRef.current;
    setStarting(true);
    if (timerNotifications(session.timer)) await requestNotificationPermission();
    if (request !== requestRef.current || session !== sessionRef.current) return;
    setStarting(false);
    session.start();
    setPlayback(session.state);
    reportRunning(session.state.running);
  };
  const pause = () => {
    cancelPending();
    const session = sessionRef.current;
    if (!session) return;
    session.pause();
    setPlayback(session.state);
    stopSpeaking();
    reportRunning(false);
  };
  const goTo = (newIndex: number) => {
    cancelPending();
    const session = sessionRef.current;
    if (!session) return;
    stopSpeaking();
    session.goTo(newIndex);
    setPlayback(session.state);
  };
  const reset = () => {
    cancelPending();
    const session = sessionRef.current;
    if (!session) return;
    session.reset();
    setPlayback(session.state);
    stopSpeaking();
    reportRunning(false);
  };

  // Atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        (e.target as HTMLElement)?.closest(
          "input, textarea, select, button, a, [contenteditable=true]",
        )
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        if (running) pause();
        else void start();
      }
      if (e.code === "ArrowRight") goTo(index + 1);
      if (e.code === "ArrowLeft") goTo(index - 1);
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
  const elapsed = finished ? total : elapsedBefore + ((current?.duration ?? 0) - remaining);
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
          {!finished && next
            ? `Sigue: ${next.stageName} · ${formatHuman(next.duration)}`
            : "Última etapa"}
        </p>

        {finished && (
          <Button size="lg" disabled={starting || !steps.length} onClick={start} className="mt-2">
            <RotateCcw className="mr-1 h-5 w-5" /> Volver a iniciar desde el principio
          </Button>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" variant="secondary" onClick={() => goTo(index - 1)}>
            <SkipBack className="mr-1 h-5 w-5" /> Anterior
          </Button>
          {running ? (
            <Button size="lg" onClick={pause}>
              <Pause className="mr-1 h-5 w-5" /> Pausar
            </Button>
          ) : (
            <Button size="lg" disabled={starting || !steps.length} onClick={start}>
              <Play className="mr-1 h-5 w-5" /> Iniciar
            </Button>
          )}
          <Button size="lg" variant="secondary" onClick={() => goTo(index + 1)}>
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
