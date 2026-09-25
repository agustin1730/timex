import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Clock,
  Pencil,
  Play,
  Plus,
  Save,
  Timer,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loadSequences, loadTimers, subscribe, upsertSequence } from "@/lib/timer-storage";
import {
  sequenceDuration,
  transitionItem,
  validateSequence,
  type SequencePreset,
  type SequenceItem,
} from "@/lib/sequence-model";
import { uid, formatClock, formatHuman, totalDuration, type TimerPreset } from "@/lib/timer-model";
export const Route = createFileRoute("/sequence-editor/$sequenceId")({
  head: () => ({ meta: [{ title: "Editor de secuencia — Intervalos" }] }),
  component: SequenceEditor,
});
function move<T>(items: T[], index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const copy = [...items];
  const item = copy.splice(index, 1)[0]!;
  copy.splice(target, 0, item);
  return copy;
}
function ItemCard({
  item,
  timers,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  item: SequenceItem;
  timers: TimerPreset[];
  index: number;
  count: number;
  onChange: (item: SequenceItem) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timer = item.kind === "timer" ? timers.find((t) => t.id === item.timerId) : undefined;
  const name =
    item.kind === "transition" ? item.name : (timer?.name ?? "Temporizador no disponible");
  const duration = item.kind === "transition" ? item.duration : timer ? totalDuration(timer) : 0;
  return (
    <article className="panel min-w-0 p-3 md:p-4" aria-label={`Elemento ${index + 1}: ${name}`}>
      <button
        className="flex w-full min-w-0 items-center gap-3 text-left md:hidden"
        aria-expanded={expanded}
        aria-controls={`details-${item.id}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-sm text-primary">{index + 1}</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{name || "Transición"}</span>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {formatClock(duration)}
        </span>
        <ChevronDown className={`size-4 shrink-0 ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div id={`details-${item.id}`} className={`${expanded ? "mt-3" : "hidden"} md:mt-0 md:block`}>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="hidden text-sm text-primary md:block">{index + 1}</span>
          <div className="min-w-0 flex-1 basis-44">
            {item.kind === "timer" ? (
              <>
                <h2 className="break-words font-semibold">{name}</h2>
                <p className="text-sm text-muted-foreground">
                  {formatHuman(duration)} · {timer?.blocks.length ?? 0}{" "}
                  {timer?.blocks.length === 1 ? "bloque" : "bloques"}
                </p>
              </>
            ) : (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Input
                  ref={input}
                  aria-label="Nombre de transición"
                  className="min-w-0 flex-1 basis-32"
                  value={item.name}
                  onChange={(e) => onChange({ ...item, name: e.target.value })}
                />
                <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  <Input
                    aria-label="Duración en segundos"
                    className="w-20"
                    type="number"
                    min={1}
                    value={item.duration}
                    onChange={(e) => onChange({ ...item, duration: Number(e.target.value) })}
                  />
                  <span>s</span>
                </label>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Subir elemento"
              title="Subir"
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Bajar elemento"
              title="Bajar"
              disabled={index === count - 1}
              onClick={() => onMove(1)}
            >
              <ArrowDown className="size-4" />
            </Button>
            {item.kind === "timer" ? (
              <Button size="icon" variant="ghost" asChild disabled={!timer}>
                <Link
                  to="/editor/$timerId"
                  params={{ timerId: item.timerId }}
                  target="_blank"
                  rel="noopener"
                  aria-label="Editar temporizador (nueva pestaña)"
                  title="Editar temporizador en nueva pestaña"
                >
                  <Pencil className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Editar transición"
                title="Editar transición"
                onClick={() => input.current?.focus()}
              >
                <Pencil className="size-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              aria-label="Quitar elemento"
              title="Quitar"
              onClick={onRemove}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
        {item.kind === "transition" && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              <Switch
                checked={item.voice}
                onCheckedChange={(voice) => onChange({ ...item, voice })}
              />
              Voz
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={item.notifications}
                onCheckedChange={(notifications) => onChange({ ...item, notifications })}
              />
              Notificaciones
            </label>
          </div>
        )}
      </div>
    </article>
  );
}
function SequenceEditor() {
  const { sequenceId } = Route.useParams();
  const router = useRouter();
  const [sequence, setSequence] = useState<SequencePreset | null>(null);
  const [timers, setTimers] = useState<TimerPreset[]>([]);
  const [timerId, setTimerId] = useState("");
  const [picker, setPicker] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      setSequence(loadSequences().find((s) => s.id === sequenceId) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
    setLoaded(true);
    setSaved(false);
    const refresh = () => setTimers(loadTimers());
    refresh();
    return subscribe(refresh);
  }, [sequenceId]);
  if (!loaded) return <main className="p-5 text-muted-foreground">Cargando secuencia…</main>;
  if (!sequence)
    return (
      <main className="p-5">
        <p role="alert">{error || "Secuencia no encontrada."}</p>
        <Link to="/sequences">Volver a secuencias</Link>
      </main>
    );
  const patch = (nodes: SequenceItem[]) => {
    setSequence({ ...sequence, nodes });
    setSaved(false);
  };
  // Stored legacy groups are expanded by loadSequences before editing.
  const items = sequence.nodes as SequenceItem[];
  const issues = validateSequence(sequence, timers);
  const save = () => {
    try {
      upsertSequence(sequence);
      setSequence(loadSequences().find((s) => s.id === sequence.id)!);
      setSaved(true);
      setError("");
      return true;
    } catch (e) {
      setError(`No se pudo guardar: ${(e as Error).message}`);
      return false;
    }
  };
  return (
    <main className="mx-auto w-full min-w-0 max-w-4xl space-y-4 px-4 py-6 md:px-6">
      <Link to="/sequences" className="text-sm text-muted-foreground hover:text-foreground">
        ← Secuencias
      </Link>
      <header className="flex min-w-0 flex-wrap items-center gap-3">
        <Input
          aria-label="Nombre de secuencia"
          className="min-w-0 flex-1 basis-full text-lg font-semibold md:basis-48"
          value={sequence.name}
          onChange={(e) => {
            setSequence({ ...sequence, name: e.target.value });
            setSaved(false);
          }}
        />
        <span
          className="mr-auto inline-flex shrink-0 items-center gap-2 text-sm tabular-nums text-muted-foreground"
          aria-label={`Duración total: ${formatClock(sequenceDuration(sequence, timers))}`}
        >
          <Clock className="size-4" />
          {formatClock(sequenceDuration(sequence, timers))}
        </span>
        <Button variant="secondary" onClick={save}>
          <Save className="size-4" />
          {saved ? "Guardado" : "Guardar"}
        </Button>
        <Button
          disabled={issues.length > 0}
          onClick={() => {
            if (save())
              void router.navigate({
                to: "/sequence-play/$sequenceId",
                params: { sequenceId: sequence.id },
              });
          }}
        >
          <Play className="size-4" />
          Ejecutar
        </Button>
      </header>
      {!!sequence.convertedRepeatGroups && (
        <p role="status" className="text-sm text-muted-foreground">
          Los tramos antiguos se convirtieron en elementos individuales, conservando el orden y la
          duración. Se guardó un respaldo local.
        </p>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary">
            <Plus className="size-4" />
            Agregar
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onSelect={() => {
              setTimerId("");
              setPicker(true);
            }}
          >
            <Timer className="mr-2 size-4" />
            Temporizador
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => patch([...items, transitionItem()])}>
            <Clock className="mr-2 size-4" />
            Transición
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <section aria-label="Elementos de la secuencia" className="space-y-3">
        {items.map((item, index) => (
          <ItemCard
            key={item.id}
            item={item}
            index={index}
            count={items.length}
            timers={timers}
            onChange={(next) => patch(items.map((i) => (i.id === item.id ? next : i)))}
            onMove={(delta) => patch(move(items, index, delta))}
            onRemove={() => patch(items.filter((i) => i.id !== item.id))}
          />
        ))}
      </section>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {issues.length > 0 && (
        <ul className="text-sm text-destructive" aria-label="Problemas de la secuencia">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar temporizador</DialogTitle>
          </DialogHeader>
          <label className="space-y-2 text-sm">
            Temporizador de la biblioteca
            <select
              className="block w-full min-w-0 rounded-md border bg-background p-2"
              value={timerId}
              onChange={(e) => setTimerId(e.target.value)}
            >
              <option value="">Elegí un temporizador</option>
              {timers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={!timers.some((t) => t.id === timerId)}
            onClick={() => {
              patch([...items, { id: uid(), kind: "timer", timerId }]);
              setPicker(false);
            }}
          >
            Agregar temporizador
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
