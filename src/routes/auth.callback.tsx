import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { finishGoogleLogin } from "@/lib/sync/supabase";
export const Route = createFileRoute("/auth/callback")({ component: Callback });
function Callback() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    void finishGoogleLogin()
      .then(() => router.navigate({ to: "/account", replace: true }))
      .catch((e) => setError((e as Error).message));
  }, [router]);
  return (
    <main className="p-6">
      <p role="status">{error || "Completando acceso a Google…"}</p>
      {error && <Link to="/account">Volver a Cuenta</Link>}
    </main>
  );
}
