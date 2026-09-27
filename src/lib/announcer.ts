/**
 * Voz + notificaciones.
 *
 * En el navegador usa SpeechSynthesis y la Notification API.
 * Si existe una capa de escritorio (Electron/Tauri) que expone
 * `window.desktopTimer`, se delega en ella para que voz y avisos
 * sigan funcionando con la ventana oculta en la bandeja.
 */

export type DesktopBridge = {
  stopSpeaking?: () => void;
  speak?: (text: string) => void;
  notify?: (title: string, body: string) => void;
  setRunning?: (running: boolean) => void;
};

declare global {
  interface Window {
    desktopTimer?: DesktopBridge;
  }
}

export const hasDesktopLayer = () =>
  typeof window !== "undefined" &&
  (Boolean(window.desktopTimer) || "__TAURI_INTERNALS__" in window);

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let nativeQueue = Promise.resolve<unknown>(undefined);

function nativeCall(command: string, args?: Record<string, unknown>) {
  if (!isTauri()) return;
  nativeQueue = nativeQueue.then(() => invoke(command, args)).catch(() => undefined);
}

export function reportSessionStatus(status: "idle" | "running" | "paused" | "finished") {
  nativeCall("set_session_status", { status });
  if (status === "running" || status === "idle")
    window.desktopTimer?.setRunning?.(status === "running");
}

export function speak(text: string) {
  if (typeof window === "undefined") return;
  if (window.desktopTimer?.speak) {
    window.desktopTimer.speak(text);
    return;
  }
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-ES";
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("es"));
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window === "undefined") return;
  nativeCall("stop_native_voice");
  window.desktopTimer?.stopSpeaking?.();
  window.speechSynthesis?.cancel();
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined") return false;
  if (isTauri()) {
    try {
      return await invoke<boolean>("native_notifications_available");
    } catch {
      return false;
    }
  }
  if (window.desktopTimer?.notify) return true;
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export function notify(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (window.desktopTimer?.notify) {
    window.desktopTimer.notify(title, body);
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, silent: false });
  } catch {
    /* API no disponible en algunos navegadores. */
  }
}

export function reportRunning(running: boolean) {
  reportSessionStatus(running ? "running" : "idle");
}
import { invoke } from "@tauri-apps/api/core";
