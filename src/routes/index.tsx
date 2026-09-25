import { sequenceDeletionWarning, folderTimerIds } from "@/lib/timer-storage";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  Copy,
  Folder as FolderIcon,
  FolderPlus,
  Home,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  cloneTimer,
  emptyTimer,
  formatHuman,
  totalDuration,
  type Folder,
  type TimerPreset,
} from "@/lib/timer-model";
import {
  createFolder,
  deleteFolder,
  deleteTimer,
  folderContents,
  loadFolders,
  loadTimers,
  moveTimer,
  renameFolder,
  subscribe,
  upsertTimer,
} from "@/lib/timer-storage";

type Search = { folder?: string };

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s["folder"] === "string" && s["folder"] ? { folder: s["folder"] } : {},
  head: () => ({
    meta: [
      { title: "Intervalos — Biblioteca de temporizadores" },
      {
        name: "description",
        content:
          "Creá, guardá y ejecutá temporizadores por intervalos con bloques, etapas, repeticiones y carpetas.",
      },
      { property: "og:title", content: "Intervalos — Biblioteca de temporizadores" },
      {
        property: "og:description",
        content: "Temporizadores por intervalos con bloques, repeticiones, voz, avisos y carpetas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Library,
});

function Library() {
  const router = useRouter();
  const { folder: folderParam } = Route.useSearch();
  const [timers, setTimers] = useState<TimerPreset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderDialog, setFolderDialog] = useState<{ id?: string; parentId: string | null } | null>(
    null,
  );
  const [folderName, setFolderName] = useState("");
  const [removal, setRemoval] = useState<{
    id: string;
    kind: "folder" | "timer";
    message: string;
  } | null>(null);

  useEffect(() => {
    const refresh = () => {
      setTimers(loadTimers());
      setFolders(loadFolders());
    };
    refresh();
    const unsub = subscribe(refresh);
    return () => {
      unsub();
    };
  }, []);

  const current = folders.find((f) => f.id === folderParam) ?? null;
  const currentId = current?.id ?? null;
  const parent = current?.parentId ? folders.find((f) => f.id === current.parentId) : null;
  const subfolders = folders.filter((f) => f.parentId === currentId);
  const visible = timers.filter((t) => (t.folderId ?? null) === currentId);
  const canCreateFolder = !current || current.parentId === null;

  const go = (id: string | null) => router.navigate({ to: "/", search: id ? { folder: id } : {} });

  const create = () => {
    const t = emptyTimer(currentId);
    upsertTimer(t);
    router.navigate({ to: "/editor/$timerId", params: { timerId: t.id } });
  };

  const newFolder = () => {
    setFolderName("");
    setFolderDialog({ parentId: currentId });
  };
  const rename = (f: Folder) => {
    setFolderName(f.name);
    setFolderDialog({ id: f.id, parentId: f.parentId });
  };
  const removeFolder = (f: Folder) => {
    const c = folderContents(f.id);
    setRemoval({
      id: f.id,
      kind: "folder",
      message:
        "¿Eliminar «" +
        f.name +
        "»? También se eliminarán todos los temporizadores (" +
        c.timers +
        ") y subcarpetas (" +
        c.subfolders +
        ") que contiene. Esta acción no se puede deshacer." +
        sequenceDeletionWarning(folderTimerIds(f.id)),
    });
  };

  // Destinos posibles para mover un temporizador.
  const locations: { id: string; label: string }[] = [{ id: "", label: "Sin carpeta" }];
  folders
    .filter((f) => f.parentId === null)
    .forEach((f) => {
      locations.push({ id: f.id, label: f.name });
      folders
        .filter((s) => s.parentId === f.id)
        .forEach((s) => locations.push({ id: s.id, label: `${f.name} / ${s.name}` }));
    });

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold uppercase tracking-wide">Temporizadores</h1>
            <p className="truncate text-sm text-muted-foreground">
              Biblioteca de temporizadores guardados en esta computadora
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {canCreateFolder && (
            <Button variant="secondary" onClick={newFolder}>
              <FolderPlus className="mr-1 h-4 w-4" /> {current ? "Subcarpeta" : "Carpeta"}
            </Button>
          )}
          <Button onClick={create}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo
          </Button>
        </div>
      </header>

      {current && (
        <nav
          aria-label="Ubicación"
          className="mb-5 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
        >
          <button
            onClick={() => go(null)}
            className={`flex items-center gap-1 rounded px-2 py-1 hover:bg-surface-strong ${!current ? "font-semibold text-primary" : ""}`}
          >
            <Home className="h-4 w-4" /> Biblioteca principal
          </button>
          {parent && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <button
                onClick={() => go(parent.id)}
                className="rounded px-2 py-1 hover:bg-surface-strong"
              >
                {parent.name}
              </button>
            </>
          )}
          {current && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="min-w-0 break-words px-2 py-1 font-semibold text-primary">
                {current.name}
              </span>
            </>
          )}
        </nav>
      )}

      {subfolders.length > 0 && (
        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          {subfolders.map((f) => {
            const count = timers.filter((t) => t.folderId === f.id).length;
            return (
              <article key={f.id} className="panel flex items-center gap-2 p-3">
                <button
                  onClick={() => go(f.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <FolderIcon className="h-5 w-5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{f.name}</span>
                    <span className="block text-xs text-muted-foreground">{count}</span>
                  </span>
                </button>
                <Button size="icon" variant="ghost" title="Renombrar" onClick={() => rename(f)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Eliminar carpeta"
                  onClick={() => removeFolder(f)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </article>
            );
          })}
        </section>
      )}

      <section className="mt-4 space-y-3">
        {visible.length === 0 && (
          <p className="panel p-8 text-center text-muted-foreground">
            No hay temporizadores en esta ubicación.
          </p>
        )}
        {visible.map((t) => {
          return (
            <article
              key={t.id}
              className="panel flex flex-wrap items-center justify-between gap-4 p-4"
            >
              <div className="min-w-0 basis-56 flex-1">
                <h2 className="truncate text-xl font-semibold">{t.name}</h2>
                <p className="truncate text-sm text-muted-foreground">
                  {formatHuman(totalDuration(t))} · {t.blocks.length}{" "}
                  {t.blocks.length === 1 ? "bloque" : "bloques"}
                </p>
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  Mover a
                  <select
                    value={t.folderId ?? ""}
                    onChange={(e) => moveTimer(t.id, e.target.value || null)}
                    className="min-w-0 max-w-full flex-1 rounded-md border border-input bg-background px-2 py-1 text-foreground"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                  title="Duplicar temporizador"
                  onClick={() => upsertTimer(cloneTimer(t))}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Eliminar"
                  onClick={() => {
                    setRemoval({
                      id: t.id,
                      kind: "timer",
                      message:
                        `¿Eliminar «${t.name}»? Esta acción no se puede deshacer.` +
                        sequenceDeletionWarning([t.id]),
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </article>
          );
        })}
      </section>

      <Dialog
        open={folderDialog !== null}
        onOpenChange={(open) => {
          if (!open) setFolderDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {folderDialog?.id
                ? "Renombrar carpeta"
                : folderDialog?.parentId
                  ? "Crear subcarpeta"
                  : "Crear carpeta"}
            </DialogTitle>
            <DialogDescription>Elegí un nombre para esta ubicación.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!folderDialog || !folderName.trim()) return;
              if (folderDialog.id) renameFolder(folderDialog.id, folderName);
              else createFolder(folderName, folderDialog.parentId);
              setFolderDialog(null);
            }}
          >
            <Label htmlFor="folder-name">Nombre de la carpeta</Label>
            <Input
              id="folder-name"
              autoFocus
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="secondary" onClick={() => setFolderDialog(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!folderName.trim()}>
                Guardar carpeta
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={removal !== null}
        onOpenChange={(open) => {
          if (!open) setRemoval(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>{removal?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button autoFocus variant="secondary" onClick={() => setRemoval(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!removal) return;
                if (removal.kind === "folder") deleteFolder(removal.id);
                else deleteTimer(removal.id);
                setRemoval(null);
              }}
            >
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mt-10 text-xs text-muted-foreground">
        Los datos se guardan localmente en esta computadora. Esta versión web es la base de la
        futura aplicación de escritorio para Windows.
      </p>
    </main>
  );
}
