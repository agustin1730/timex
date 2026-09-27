import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertLibrary, type Library } from "./library.ts";
import { emptyRemote, type Remote, type SyncTransport } from "./engine.ts";
let client: SupabaseClient | null = null;
export function authConfigured() {
  return !!(
    import.meta.env["VITE_SUPABASE_URL"] && import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]
  );
}
export function supabase(): SupabaseClient | null {
  if (typeof window === "undefined" || !authConfigured()) return null;
  if (!client)
    client = createClient(
      import.meta.env["VITE_SUPABASE_URL"],
      import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
      {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storageKey: "intervalos.auth.v1",
        },
      },
    );
  return client;
}
export function transport(userId: string): SyncTransport {
  const client = supabase();
  if (!client) throw Error("Falta configurar Supabase.");
  const checkSession = async () => {
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== userId)
      throw Error(
        "Volvé a conectar tu cuenta para sincronizar. La biblioteca local está disponible.",
      );
    return data.session.access_token;
  };
  return {
    async pull() {
      const token = await checkSession();
      const { data, error } = await client
        .from("intervalos_libraries")
        .select("revision,library")
        .eq("user_id", userId)
        .abortSignal(AbortSignal.timeout(15000))
        .setHeader("Authorization", `Bearer ${token}`)
        .maybeSingle();
      if (error) throw error;
      if (!data) return emptyRemote();
      assertLibrary(data.library);
      return data as Remote;
    },
    async push(expected: number, library: Library) {
      const token = await checkSession();
      const { data, error } = await client
        .rpc("intervalos_commit", { expected_revision: expected, next_library: library })
        .setHeader("Authorization", `Bearer ${token}`)
        .abortSignal(AbortSignal.timeout(15000));
      if (error) throw error;
      return data as Remote | null;
    },
  };
}
export async function googleLogin() {
  const client = supabase();
  if (!client)
    throw Error(
      "El inicio de sesión todavía no está configurado. Podés seguir usando la app sin cuenta.",
    );
  if ("__TAURI_INTERNALS__" in window)
    throw Error(
      "Este proyecto todavía no incluye el retorno de login para una aplicación Tauri instalada.",
    );
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: new URL("/auth/callback", window.location.origin).href,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
}
let exchange: Promise<void> | null = null;
export function finishGoogleLogin() {
  if (exchange) return exchange;
  exchange = (async () => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (url.searchParams.has("error") || !code)
      throw Error("Google no completó el acceso. Podés volver a intentarlo desde Cuenta.");
    const client = supabase();
    if (!client) throw Error("Falta configurar Supabase.");
    const { error } = await client.auth.exchangeCodeForSession(code);
    window.history.replaceState({}, "", "/auth/callback");
    if (error)
      throw Error("No se pudo completar el acceso. Iniciá sesión nuevamente desde este navegador.");
  })();
  return exchange;
}
