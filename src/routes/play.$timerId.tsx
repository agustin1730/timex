import { useAndroidForeground } from "@/hooks/use-android-foreground";
import { isAndroidApp } from "@/lib/platform";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlayerWidgetButton } from "@/components/player-widget-button";
import {
  formatClock,
  formatHuman,
  timerNotifications,
  timerVoice,
  type TimerPreset,
} from "@/lib/timer-model";
import { TimerSession, type Playback } from "@/lib/timer-session";
import { stageColor, stageColorPalette } from "@/lib/stage-colors";
import {
  controlDesktopSession,
  desktopStage,
  isTauriDesktop,
  readDesktopSession,
  startDesktopSession,
  stopDesktopSession,
} from "@/lib/desktop-session";
import { getTimer } from "@/lib/timer-storage";
import {
  notify,
  hasDesktopLayer,
  reportSessionStatus,
  requestNotificationPermission,
  speak,
  stopSpeaking,
} from "@/lib/announcer";

export const Route = createFileRoute("/play/$timerId")({
  head: () => ({
    meta: [
      { title: "Reproductor — Time X" },
      {
        name: "description",
        content: "Ejecutá tu temporizador por intervalos con avisos de voz y controles de etapa.",
      },
      { property: "og:title", content: "Reproductor — Time X" },
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
  const desktopIdRef = useRef("");
  const desktopStartedRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [desktopError, setDesktopError] = useState("");
  const [widgetVisible, setWidgetVisible] = useState(false);
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
        if (hasDesktopLayer()) return;
        stopSpeaking();
        if (timerVoice(session.timer)) speak(step.stageName);
        if (timerNotifications(session.timer))
          notify(
            "Etapa: " + step.stageName,
            step.blockName + " · repetición " + step.repeatIndex + "/" + step.repeatTotal,
          );
      },
      () => {
        if (hasDesktopLayer()) return;
        stopSpeaking();
        if (timerVoice(session.timer)) speak("Temporizador finalizado");
        if (timerNotifications(session.timer))
          notify("Temporizador finalizado", "El temporizador terminó.");
        reportSessionStatus("finished");
      },
    );
    sessionRef.current = session;
    desktopIdRef.current = crypto.randomUUID();
    desktopStartedRef.current = false;
    setTimer(session.timer);
    setPlayback(session.state);
    setStarting(false);
    let polling = false;
    const id = window.setInterval(() => {
      if (isTauriDesktop()) {
        if (!desktopStartedRef.current || polling) return;
        polling = true;
        void readDesktopSession(desktopIdRef.current)
          .then((native) => {
            if (native && sessionRef.current === session) {
              session.applySnapshot(native);
              setPlayback(session.state);
              setWidgetVisible(native.widgetVisible);
            }
          })
          .catch((error) => console.error("No se pudo leer la sesión nativa", error))
          .finally(() => {
            polling = false;
          });
      } else if (session.state.running) {
        session.tick();
        setPlayback(session.state);
      }
    }, 100);
    return () => {
      window.clearInterval(id);
      sessionRef.current = null;
      if (isTauriDesktop()) void stopDesktopSession(desktopIdRef.current);
      else {
        stopSpeaking();
        reportSessionStatus("idle");
      }
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
    try {
      if (isTauriDesktop()) {
        const native = desktopStartedRef.current
          ? await controlDesktopSession(desktopIdRef.current, "resume")
          : await startDesktopSession({
              id: desktopIdRef.current,
              stages: session.steps.map((step) =>
                desktopStage(
                  step,
                  `${step.blockName} · repetición ${step.repeatIndex}/${step.repeatTotal}`,
                  timerVoice(session.timer),
                  timerNotifications(session.timer),
                ),
              ),
              index: session.state.index,
              remaining: session.state.remaining,
              finish: {
                title: "Temporizador finalizado",
                body: "El temporizador terminó.",
                voice: timerVoice(session.timer),
                notifications: timerNotifications(session.timer),
              },
            });
        if (request !== requestRef.current || session !== sessionRef.current) {
          await stopDesktopSession(native.id);
          return;
        }
        desktopStartedRef.current = true;
        session.applySnapshot(native);
        setPlayback(session.state);
        setWidgetVisible(native.widgetVisible);
      } else {
        session.start();
        setPlayback(session.state);
        reportSessionStatus("running");
      }
      setDesktopError("");
    } catch (error) {
      setDesktopError(`No se pudo iniciar: ${String(error)}`);
    } finally {
      if (request === requestRef.current) setStarting(false);
    }
  };
  const pause = () => {
    cancelPending();
    const session = sessionRef.current;
    if (!session) return;
    if (isTauriDesktop() && desktopStartedRef.current) {
      void controlDesktopSession(desktopIdRef.current, "pause")
        .then((native) => {
          session.applySnapshot(native);
          setPlayback(session.state);
        })
        .catch((error) => setDesktopError(String(error)));
      return;
    }
    session.pause();
    setPlayback(session.state);
    stopSpeaking();
    reportSessionStatus("paused");
  };
  useAndroidForeground(pause);

  const goTo = (newIndex: number) => {
    cancelPending();
    const session = sessionRef.current;
    if (!session) return;
    if (isTauriDesktop() && desktopStartedRef.current) {
      const action = newIndex < session.state.index ? "previous" : "next";
      void controlDesktopSession(desktopIdRef.current, action)
        .then((native) => {
          session.applySnapshot(native);
          setPlayback(session.state);
        })
        .catch((error) => setDesktopError(String(error)));
      return;
    }
    stopSpeaking();
    session.goTo(newIndex);
    setPlayback(session.state);
    if (!session.state.running) reportSessionStatus("paused");
  };
  const reset = () => {
    cancelPending();
    const session = sessionRef.current;
    if (!session) return;
    if (isTauriDesktop() && desktopStartedRef.current) {
      void controlDesktopSession(desktopIdRef.current, "reset")
        .then((native) => {
          session.applySnapshot(native);
          setPlayback(session.state);
        })
        .catch((error) => setDesktopError(String(error)));
      return;
    }
    session.reset();
    setPlayback(session.state);
    stopSpeaking();
    reportSessionStatus("idle");
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
  const currentColor = stageColorPalette[stageColor(current?.color)];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-8">
      {desktopError && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {desktopError}
        </p>
      )}
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
        <h2
          className="text-4xl font-bold uppercase"
          style={{ color: finished ? undefined : currentColor.solid }}
        >
          {finished ? "Temporizador finalizado" : (current?.stageName ?? "—")}
        </h2>
        <div className="clock-digits text-[6rem] leading-none sm:text-[8rem]">
          {formatClock(remaining)}
        </div>
        <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-surface-strong">
          <div
            className="h-full transition-[width] duration-200"
            style={{
              width: `${Math.min(100, Math.max(0, progress * 100))}%`,
              backgroundColor: currentColor.solid,
            }}
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
          <PlayerWidgetButton
            active={desktopStartedRef.current && !finished}
            visible={widgetVisible}
            onError={setDesktopError}
          />
        </div>
        <p hidden={isAndroidApp()} className="text-xs text-muted-foreground">
          Teclado: Espacio inicia o pausa · ← → cambian de etapa · R reinicia
        </p>
      </section>

      <p hidden={isAndroidApp()} className="mt-4 text-center text-xs text-muted-foreground">
        Voz: {settings.voice ? "activada" : "desactivada"} · Notificaciones:{" "}
        {settings.notifications ? "activadas" : "desactivadas"} (se cambian en el editor)
      </p>
    </main>
  );
}
