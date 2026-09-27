import { Pencil, SlidersHorizontal, Copy, Play, Trash2 } from "lucide-react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  loadSequences,
  loadTimers,
  subscribe,
  upsertSequence,
  deleteSequence,
} from "@/lib/timer-storage";
import {
  cloneSequence,
  emptySequence,
  sequenceDuration,
  sequenceItems,
  validateSequence,
  type SequencePreset,
} from "@/lib/sequence-model";
import { formatHuman, type TimerPreset } from "@/lib/timer-model";
export const Route = createFileRoute("/sequences")({
  head: () => ({ meta: [{ title: "Secuencias — Intervalos" }] }),
  component: Sequences,
});
function Sequences() {
  const router = useRouter();
  const [sequences, setSequences] = useState<SequencePreset[]>([]);
  const [timers, setTimers] = useState<TimerPreset[]>([]);
  const [dialog, setDialog] = useState<{ id: string; kind: "rename" | "delete" } | null>(null);
  const [name, setName] = useState("");
  useEffect(() => {
    const refresh = () => {
      setTimers(loadTimers());
      setSequences(loadSequences());
    };
    refresh();
    return subscribe(refresh);
  }, []);
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Secuencias</h1>
        <Button
          onClick={() => {
            const s = emptySequence();
            upsertSequence(s);
            void router.navigate({
              to: "/sequence-editor/$sequenceId",
              params: { sequenceId: s.id },
            });
          }}
        >
          Nueva secuencia
        </Button>
      </header>
      <section className="mt-6 space-y-3">
        {sequences.length === 0 && <p>No hay secuencias guardadas.</p>}
        {sequences.map((s) => {
          const issues = validateSequence(s, timers);
          const count = sequenceItems(s).length;
          return (
            <article
              key={s.id}
              className="panel group flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1">
                  <h2 className="min-w-0 break-words text-xl font-semibold">{s.name}</h2>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Renombrar secuencia"
                    title="Renombrar secuencia"
                    className="h-8 w-8 shrink-0 text-muted-foreground transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                    onClick={() => {
                      setName(s.name);
                      setDialog({ id: s.id, kind: "rename" });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatHuman(sequenceDuration(s, timers))} · {count}{" "}
                  {count === 1 ? "elemento" : "elementos"}
                </p>
                {issues.length > 0 && <p className="text-sm text-destructive">{issues[0]}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={issues.length > 0}
                  onClick={() =>
                    void router.navigate({
                      to: "/sequence-play/$sequenceId",
                      params: { sequenceId: s.id },
                    })
                  }
                >
                  <Play className="mr-1 h-4 w-4" aria-hidden="true" />
                  Ejecutar
                </Button>
                <Button
                  asChild
                  size="icon"
                  variant="secondary"
                  className="h-9 w-9"
                  title="Editar secuencia"
                >
                  <Link
                    to="/sequence-editor/$sequenceId"
                    params={{ sequenceId: s.id }}
                    aria-label="Editar secuencia"
                  >
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-9 w-9"
                  aria-label="Duplicar secuencia"
                  title="Duplicar secuencia"
                  onClick={() => upsertSequence(cloneSequence(s))}
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  aria-label="Eliminar secuencia"
                  title="Eliminar secuencia"
                  onClick={() => setDialog({ id: s.id, kind: "delete" })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </article>
          );
        })}
      </section>
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === "rename" ? "Renombrar secuencia" : "Eliminar secuencia"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.kind === "rename"
                ? "Elegí un nombre."
                : "Se eliminará la secuencia. Los temporizadores originales se conservan."}
            </DialogDescription>
          </DialogHeader>
          {dialog?.kind === "rename" && (
            <Input
              aria-label="Nombre de secuencia"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              disabled={dialog?.kind === "rename" && !name.trim()}
              onClick={() => {
                if (!dialog) return;
                const current = loadSequences().find((s) => s.id === dialog.id);
                if (dialog.kind === "delete") deleteSequence(dialog.id);
                else if (current) upsertSequence({ ...current, name: name.trim() });
                setDialog(null);
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
