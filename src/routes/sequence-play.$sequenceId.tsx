import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { sequenceTimeline } from "@/lib/sequence-timeline";
import { Button } from "@/components/ui/button";
import { loadSequences, loadTimers } from "@/lib/timer-storage";
import { expandSequence, type SequenceStep } from "@/lib/sequence-model";
import { TimelineSession, type Playback } from "@/lib/timer-session";
import { formatClock, formatHuman } from "@/lib/timer-model";
import {
  speak,
  stopSpeaking,
  notify,
  reportRunning,
  requestNotificationPermission,
} from "@/lib/announcer";
export const Route = createFileRoute("/sequence-play/$sequenceId")({
  head: () => ({ meta: [{ title: "Reproductor de secuencia — Intervalos" }] }),
  component: SequencePlayer,
});
const initial: Playback = { index: 0, remaining: 0, running: false, finished: false };
function SequencePlayer() {
  const { sequenceId } = Route.useParams();
  const sessionRef = useRef<TimelineSession<SequenceStep> | null>(null);
  const freshRef = useRef(true),
    requestRef = useRef(0);
  const [state, setState] = useState(initial),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [starting, setStarting] = useState(false);
  const build = () => {
    const sequence = loadSequences().find((s) => s.id === sequenceId);
    if (!sequence) throw Error("Secuencia no encontrada.");
    const steps = expandSequence(sequence, loadTimers());
    const session = new TimelineSession(
      steps,
      () => performance.now(),
      (step) => {
        stopSpeaking();
        if (step.voice) speak(step.stageName);
        if (step.notifications)
          notify(
            "Etapa: " + step.stageName,
            [sequence.name, step.timerName || "Transición", step.blockName].join(" · "),
          );
      },
      () => {
        stopSpeaking();
        const last = session.steps.at(-1);
        if (last?.voice) speak("Secuencia finalizada");
        if (last?.notifications) notify("Secuencia finalizada", sequence.name);
        reportRunning(false);
      },
    );
    setName(sequence.name);
    setError("");
    return session;
  };
  // La vista previa se carga al abrir; la copia de ejecución se vuelve a tomar al iniciar.
  useEffect(() => {
    try {
      sessionRef.current = build();
      setState(sessionRef.current.state);
    } catch (e) {
      setError((e as Error).message);
      sessionRef.current = null;
    }
    freshRef.current = true;
    const interval = window.setInterval(() => {
      const s = sessionRef.current;
      if (s?.state.running) {
        s.tick();
        setState(s.state);
      }
    }, 100);
    return () => {
      window.clearInterval(interval);
      sessionRef.current = null;
      stopSpeaking();
      reportRunning(false);
    };
    // build depende únicamente del identificador; no se recarga durante una sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequenceId]);
  const cancel = () => {
    requestRef.current++;
    setStarting(false);
  };
  const start = async () => {
    if (starting || sessionRef.current?.state.running) return;
    let session = sessionRef.current;
    if (freshRef.current || session?.state.finished) {
      try {
        const index = session?.state.finished ? 0 : (session?.state.index ?? 0);
        session = build();
        session.goTo(index);
        sessionRef.current = session;
        setState(session.state);
      } catch (e) {
        setError((e as Error).message);
        return;
      }
    }
    if (!session) return;
    const request = ++requestRef.current;
    setStarting(true);
    if (session.steps.some((s) => s.notifications)) await requestNotificationPermission();
    if (request !== requestRef.current || sessionRef.current !== session) return;
    setStarting(false);
    freshRef.current = false;
    session.start();
    setState(session.state);
    reportRunning(true);
  };
  const pause = () => {
    cancel();
    const s = sessionRef.current;
    if (!s) return;
    s.pause();
    setState(s.state);
    stopSpeaking();
    reportRunning(false);
  };
  const go = (delta: number) => {
    cancel();
    const s = sessionRef.current;
    if (!s) return;
    stopSpeaking();
    s.goTo(s.state.index + delta);
    setState(s.state);
  };
  const reset = () => {
    cancel();
    const s = sessionRef.current;
    if (!s) return;
    s.reset();
    setState(s.state);
    freshRef.current = true;
    stopSpeaking();
    reportRunning(false);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        (e.target as HTMLElement)?.closest("input,textarea,select,button,a,[contenteditable=true]")
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        if (state.running) pause();
        else void start();
      }
      if (e.code === "ArrowRight") go(1);
      if (e.code === "ArrowLeft") go(-1);
      if (e.key.toLowerCase() === "r") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const steps = sessionRef.current?.steps ?? [],
    current = steps[state.index],
    next = steps[state.index + 1];
  const total = steps.reduce((a, s) => a + s.duration, 0);
  const segments = sequenceTimeline(steps, state);
  const activeIndex = segments.findIndex(
    (segment) => state.index >= segment.start && state.index <= segment.end,
  );
  const active = segments[activeIndex];
  return (
    <main className="mx-auto min-h-screen w-full min-w-0 max-w-4xl px-4 py-6 md:px-6">
      <header className="flex min-w-0 items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link to="/sequences" aria-label="Volver a secuencias">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 break-words text-lg font-semibold">{name || "Secuencia"}</h1>
        <span
          className="flex shrink-0 items-center gap-2 text-sm tabular-nums text-muted-foreground"
          aria-label={`Duración total: ${formatClock(total)}`}
        >
          <Clock className="size-4" />
          {formatClock(total)}
        </span>
      </header>
      {error && (
        <p role="alert" className="my-4 text-destructive">
          {error}{" "}
          <Link to="/sequence-editor/$sequenceId" params={{ sequenceId }}>
            Editar secuencia
          </Link>
        </p>
      )}
      {!!segments.length && (
        <section className="mt-7" aria-label="Línea de tiempo de la secuencia">
          <ol
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${Math.min(segments.length, 16)}, minmax(0, 1fr))`,
            }}
          >
            {segments.map((segment, index) => (
              <li
                key={index}
                className="min-w-0"
                aria-current={index === activeIndex ? "step" : undefined}
              >
                <div
                  role="progressbar"
                  aria-label={`${index + 1} de ${segments.length} · ${segment.transition ? "Transición: " : ""}${segment.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(segment.progress * 100)}
                  aria-valuetext={
                    segment.status === "completed"
                      ? "Completado"
                      : segment.status === "pending"
                        ? "Pendiente"
                        : `${Math.round(segment.progress * 100)}% completado`
                  }
                  title={`${segment.name} · ${formatHuman(segment.duration)}`}
                  className={`relative h-5 overflow-hidden rounded-md border-2 ${index === activeIndex ? "border-primary" : "border-transparent"} ${segment.status === "pending" ? "bg-secondary" : "bg-primary/10"}`}
                >
                  <div
                    className={`h-full ${segment.status === "completed" ? "bg-primary/50" : "bg-primary"}`}
                    style={{ width: `${segment.progress * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
          {active && (
            <p className="mt-3 break-words text-sm text-muted-foreground" aria-live="polite">
              {activeIndex + 1} de {segments.length} ·{" "}
              <span className="font-medium text-foreground">
                {active.transition ? "Transición: " : ""}
                {active.name}
              </span>
            </p>
          )}
        </section>
      )}
      <section className="mt-8 space-y-6 text-center md:mt-12" aria-label="Reproducción">
        <div className="space-y-3">
          <h2 className="break-words text-3xl font-semibold md:text-4xl">
            {state.finished ? "Secuencia finalizada" : (current?.stageName ?? "Cargando…")}
          </h2>
          <div className="clock-digits text-[clamp(3rem,18vw,7rem)] leading-tight tabular-nums">
            {formatClock(state.remaining)}
          </div>
          {current?.timerName && (
            <p className="break-words text-sm text-muted-foreground">
              {current.blockName} · Repetición {current.repeatIndex} de {current.repeatTotal}
            </p>
          )}
        </div>
        <p className="min-h-6 break-words text-sm text-muted-foreground">
          {!state.finished &&
            (next ? `Sigue: ${next.stageName} · ${formatHuman(next.duration)}` : "Última etapa")}
        </p>
        {state.finished && (
          <Button
            disabled={starting}
            className="h-auto max-w-full whitespace-normal"
            onClick={start}
          >
            Volver a iniciar desde el principio
          </Button>
        )}
        <div className="flex flex-wrap items-center justify-center gap-1.5 [&>button]:px-3">
          <Button variant="secondary" disabled={!current} onClick={() => go(-1)}>
            <SkipBack className="size-4" />
            <span>Anterior</span>
          </Button>
          {state.running ? (
            <Button onClick={pause}>
              <Pause className="size-4" />
              Pausar
            </Button>
          ) : (
            <Button disabled={starting || !current} onClick={start}>
              <Play className="size-4" />
              Iniciar
            </Button>
          )}
          <Button variant="secondary" disabled={!current} onClick={() => go(1)}>
            <span>Siguiente</span>
            <SkipForward className="size-4" />
          </Button>
        </div>
        <Button variant="ghost" className="text-muted-foreground" onClick={reset}>
          <RotateCcw className="size-4" />
          Reiniciar
        </Button>
      </section>
    </main>
  );
}
