import { useEffect, type ReactNode } from "react";
import { useAccount } from "@/hooks/use-account";
import { startAccounts } from "@/lib/sync/account";
export function AccountBoundary({ children }: { children: ReactNode }) {
  const state = useAccount();
  useEffect(() => {
    startAccounts();
    if ("__TAURI_INTERNALS__" in window) {
      const marker = "intervalos.desktop-backup.v0.20.0";
      if (!window.localStorage.getItem(marker)) {
        try {
          const entries = Object.entries(window.localStorage).filter(
            ([key]) => key.startsWith("interval-timers.") || key.startsWith("intervalos.library."),
          );
          window.localStorage.setItem(marker, JSON.stringify({ createdAt: Date.now(), entries }));
        } catch {
          // Una copia sin espacio nunca debe impedir abrir la biblioteca existente.
        }
      }
    }
    if (import.meta.env.PROD && !("__TAURI_INTERNALS__" in window) && "serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  if (!state.ready)
    return <div className="p-5 text-muted-foreground">Abriendo biblioteca local…</div>;
  return <div key={state.user?.id ?? "guest"}>{children}</div>;
}
