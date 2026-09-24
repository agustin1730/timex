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
  Timer as TimerIcon,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  cloneTimer,
  emptyTimer,
  expandTimer,
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
    typeof s.folder === "string" && s.folder ? { folder: s.folder } : {},
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

  const go = (id: string | null) =>
    router.navigate({ to: "/", search: id ? { folder: id } : {} });

  const create = () => {
    const t = emptyTimer(currentId);
    upsertTimer(t);
    router.navigate({ to: "/editor/$timerId", params: { timerId: t.id } });
  };

  const newFolder = () => {
    const name = prompt(current ? "Nombre de la subcarpeta" : "Nombre de la carpeta");
    if (name === null) return;
    createFolder(name, currentId);
  };

  const rename = (f: Folder) => {
    const name = prompt("Nuevo nombre", f.name);
    if (name) renameFolder(f.id, name);
  };

  const removeFolder = (f: Folder) => {
    const c = folderContents(f.id);
    const hasContent = c.subfolders > 0 || c.timers > 0;
    const msg = hasContent
      ? `¿Eliminar «${f.name}»? También se eliminarán todos los temporizadores (${c.timers}) y subcarpetas (${c.subfolders}) que contiene. Esta acción no se puede deshacer.`
      : `¿Eliminar la carpeta vacía «${f.name}»?`;
    if (!confirm(msg)) return;
    deleteFolder(f.id);
    if (currentId === f.id) go(f.parentId);
  };

  // Destinos posibles para mover un temporizador.
  const locations: { id: string; label: string }[] = [{ id: "", label: "Biblioteca principal" }];
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
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <TimerIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-bold uppercase tracking-wide">Intervalos</h1>
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

      <nav
        aria-label="Ubicación"
        className="panel mt-8 flex flex-wrap items-center gap-1 px-3 py-2 text-sm"
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
            <button onClick={() => go(parent.id)} className="rounded px-2 py-1 hover:bg-surface-strong">
              {parent.name}
            </button>
          </>
        )}
        {current && (
          <>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="px-2 py-1 font-semibold text-primary">{current.name}</span>
          </>
        )}
      </nav>

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
                    <span className="block text-xs text-muted-foreground">
                      {current ? "Subcarpeta" : "Carpeta"} · {count} temporizadores
                    </span>
                  </span>
                </button>
                <Button size="icon" variant="ghost" title="Renombrar" onClick={() => rename(f)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Eliminar carpeta" onClick={() => removeFolder(f)}>
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
          const steps = expandTimer(t);
          return (
            <article
              key={t.id}
              className="panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4"
            >
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{t.name}</h2>
                <p className="truncate text-sm text-muted-foreground">
                  {formatHuman(totalDuration(t))} · {t.blocks.length} bloques · {steps.length}{" "}
                  etapas
                </p>
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  Mover a
                  <select
                    value={t.folderId ?? ""}
                    onChange={(e) => moveTimer(t.id, e.target.value || null)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-foreground"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
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
                    if (confirm(`¿Eliminar «${t.name}»?`)) deleteTimer(t.id);
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
        Los datos se guardan localmente en esta computadora. Esta versión web es la base de la
        futura aplicación de escritorio para Windows.
      </p>
    </main>
  );
}
