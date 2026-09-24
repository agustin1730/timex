/**
 * Voz + notificaciones.
 *
 * En el navegador usa SpeechSynthesis y la Notification API.
 * Si existe una capa de escritorio (Electron/Tauri) que expone
 * `window.desktopTimer`, se delega en ella para que voz y avisos
 * sigan funcionando con la ventana oculta en la bandeja.
 */

export type DesktopBridge = {
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
  typeof window !== "undefined" && Boolean(window.desktopTimer);

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
  window.speechSynthesis?.cancel();
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function notify(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (window.desktopTimer?.notify) {
    window.desktopTimer.notify(title, body);
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, { body, silent: false });
}

export function reportRunning(running: boolean) {
  window.desktopTimer?.setRunning?.(running);
}
