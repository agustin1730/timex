/** Shared platform boundary: Android must never invoke Windows session commands. */
export function runtimePlatform(native: boolean, userAgent: string) {
  if (!native) return "web";
  if (/Android/i.test(userAgent)) return "android";
  if (/Windows/i.test(userAgent)) return "windows";
  return "other";
}

export const isTauriApp = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const currentPlatform = () =>
  runtimePlatform(isTauriApp(), typeof navigator === "undefined" ? "" : navigator.userAgent);

export const isTauriDesktop = () => currentPlatform() === "windows";
export const isAndroidApp = () => currentPlatform() === "android";
