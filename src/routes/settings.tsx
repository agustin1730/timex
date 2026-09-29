import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccount } from "@/hooks/use-account";
import { APP_VERSION, installedVersion, platformName } from "@/lib/app-info";
import { isAndroidApp } from "@/lib/platform";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Configuración — Time X" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const account = useAccount();
  const [version, setVersion] = useState(APP_VERSION);

  useEffect(() => {
    void installedVersion().then(setVersion);
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-7 sm:px-6">
      <h1 className="font-display text-3xl font-semibold uppercase">Configuración</h1>

      <section aria-labelledby="account-settings" className="space-y-3">
        <h2 id="account-settings" className="text-lg font-medium">
          Cuenta
        </h2>
        <Link
          to="/account"
          className="panel flex min-h-20 items-center gap-4 p-5 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <UserRound className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Cuenta</span>
            <span className="block truncate text-sm text-muted-foreground">
              {account.user?.email ?? "Sin cuenta"}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      </section>

      <section aria-labelledby="about-settings" className="space-y-3">
        <h2 id="about-settings" className="text-lg font-medium">
          Acerca de la app
        </h2>
        <div className="panel p-5">
          <h3 className="font-semibold">Time X</h3>
          <dl className="mt-4 divide-y divide-border text-sm">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt>Versión</dt>
              <dd className="text-muted-foreground">{version}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt>Plataforma</dt>
              <dd className="text-muted-foreground">{platformName()}</dd>
            </div>
          </dl>
        </div>
      </section>

      {isAndroidApp() && (
        <section aria-labelledby="android-playback" className="space-y-3">
          <h2 id="android-playback" className="text-lg font-medium">
            Reproducción en segundo plano
          </h2>
          <div className="panel space-y-3 p-5 text-sm text-muted-foreground">
            <p>
              Para que Time X continúe con la pantalla bloqueada, abrí Ajustes de Android → Apps →
              Time X → Batería y elegí{" "}
              <strong className="text-foreground">Sin restricciones</strong>.
            </p>
            <p>
              En Xiaomi/HyperOS también podés activar Inicio automático y permitir las
              notificaciones. El temporizador seguirá funcionando si cambiás de aplicación.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
