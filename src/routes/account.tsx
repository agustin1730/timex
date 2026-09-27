import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAccount } from "@/hooks/use-account";
import { authConfigured, googleLogin } from "@/lib/sync/supabase";
import { decide, hasPending, importGuest, logout, rereview, syncNow } from "@/lib/sync/account";
export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Cuenta — Intervalos" }] }),
  component: Account,
});
function Account() {
  const state = useAccount();
  const [message, setMessage] = useState("");
  const [closing, setClosing] = useState(false);
  const [choice, setChoice] = useState<"local" | "remote" | null>(null);
  const attempt = async (fn: () => Promise<unknown>) => {
    try {
      setMessage("");
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-7">
      <h1 className="text-2xl font-semibold">Cuenta</h1>
      {!state.user ? (
        <section className="panel space-y-4 p-5">
          <p>
            Podés usar Intervalos sin cuenta y sin conexión. Conectá Google para sincronizar tus
            configuraciones entre dispositivos.
          </p>
          <Button onClick={() => void attempt(googleLogin)}>Continuar con Google</Button>
          {!authConfigured() && (
            <p className="text-sm text-muted-foreground">
              El inicio de sesión todavía no está configurado. La biblioteca local sigue disponible.
            </p>
          )}
        </section>
      ) : (
        <>
          <section className="panel space-y-4 p-5">
            <p className="break-all font-semibold">{state.user.email}</p>
            <p role="status" className="text-sm text-muted-foreground">
              {state.busy ? "Sincronizando…" : state.status}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={state.busy || !!state.review || state.importNeeded}
                onClick={() => void syncNow()}
              >
                Reintentar sincronización
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (hasPending()) setClosing(true);
                  else void attempt(() => logout());
                }}
              >
                Cerrar sesión
              </Button>
            </div>
          </section>
          {state.importNeeded && (
            <section className="panel space-y-3 p-5">
              <h2 className="font-semibold">Primera conexión de esta cuenta en este dispositivo</h2>
              <p className="text-sm">
                Incorporá la biblioteca sin cuenta junto a los datos de Google. Revisaremos
                coincidencias y conflictos antes de reemplazar información. La biblioteca sin cuenta
                se conserva separada.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={state.busy} onClick={() => void importGuest(true)}>
                  Incorporar datos de este dispositivo
                </Button>
                <Button
                  variant="secondary"
                  disabled={state.busy}
                  onClick={() => void importGuest(false)}
                >
                  Usar solo los datos de la cuenta
                </Button>
              </div>
            </section>
          )}
          {state.review && (
            <section className="panel space-y-4 p-5">
              <h2 className="font-semibold">Revisar antes de sincronizar</h2>
              <p className="text-sm">
                Hay cambios o posibles duplicados. No se reemplazó la copia de la nube. Las opciones
                de reemplazo afectan a la biblioteca completa y guardan un respaldo local de ambas
                versiones.
              </p>
              {!!state.duplicates.length && (
                <p className="text-sm">
                  Nombres coincidentes con distintos IDs: {state.duplicates.join(", ")}. No se
                  consideran el mismo registro automáticamente.
                </p>
              )}
              {state.review.conflicts.map((c) => (
                <details key={`${c.collection}:${c.id}`} className="rounded border p-3">
                  <summary className="cursor-pointer break-words">
                    {c.name} · {c.collection} ·{" "}
                    {c.local == null || c.remote == null
                      ? "Eliminación incompatible con una edición"
                      : "Versiones diferentes"}
                  </summary>
                  <div className="grid gap-3 pt-3 sm:grid-cols-2">
                    <div>
                      <h3>Este dispositivo</h3>
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all text-xs">
                        {JSON.stringify(c.local ?? "Eliminado", null, 2)}
                      </pre>
                    </div>
                    <div>
                      <h3>Nube</h3>
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all text-xs">
                        {JSON.stringify(c.remote ?? "Eliminado", null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              ))}
              {state.review.issues.map((issue) => (
                <p key={issue} className="text-sm text-destructive">
                  {issue}
                </p>
              ))}
              <div className="flex flex-wrap gap-2">
                {!state.review.conflicts.length && !state.review.issues.length && (
                  <Button onClick={() => decide("merge")}>Incorporar ambos registros</Button>
                )}
                <Button variant="secondary" onClick={() => decide("both")}>
                  Conservar ambas bibliotecas
                </Button>
                <Button variant="outline" onClick={() => setChoice("local")}>
                  Usar biblioteca de este dispositivo
                </Button>
                <Button variant="outline" onClick={() => setChoice("remote")}>
                  Usar biblioteca de la nube
                </Button>
                <Button variant="ghost" onClick={rereview}>
                  Volver a revisar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Conservar ambas agrega copias de los registros locales y mantiene sus relaciones; no
                copia las eliminaciones locales.
              </p>
            </section>
          )}
        </>
      )}
      {(message || state.error) && (
        <p role="alert" className="break-words text-sm text-destructive">
          {message || state.error}
        </p>
      )}
      <Dialog open={closing} onOpenChange={setClosing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hay cambios pendientes</DialogTitle>
            <DialogDescription>
              Podés cancelar y sincronizar primero, o cerrar conservando los cambios en este
              dispositivo. Quedarán ocultos hasta que vuelvas a entrar con la misma cuenta y todavía
              no estarán en otros dispositivos.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setClosing(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={() => void attempt(() => logout(true))}>
            Conservar pendientes y cerrar sesión
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!choice}
        onOpenChange={(open) => {
          if (!open) setChoice(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar biblioteca completa</DialogTitle>
            <DialogDescription>
              {choice === "local"
                ? "La versión de este dispositivo reemplazará la biblioteca sincronizada, incluidas sus eliminaciones. Los datos exclusivos de la nube no quedarán activos."
                : "La versión de la nube reemplazará la biblioteca activa en este dispositivo. Los cambios locales exclusivos no quedarán activos."}{" "}
              Se conservará un respaldo local de ambas versiones.
            </DialogDescription>
          </DialogHeader>
          <Button variant="secondary" onClick={() => setChoice(null)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (choice) decide(choice);
              setChoice(null);
            }}
          >
            Confirmar reemplazo
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
