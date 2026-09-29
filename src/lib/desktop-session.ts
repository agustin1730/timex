import { invoke } from "@tauri-apps/api/core";
import { stageColor, stageColorPalette } from "./stage-colors";
import type { Step } from "./timer-model";
import type { Playback } from "./timer-session";
import { isAndroidApp, isTauriDesktop } from "./platform";

export { isTauriDesktop } from "./platform";

const WIDGET_KEY = "intervalos.widget.enabled.v1";
export const widgetPreference = () =>
  typeof window !== "undefined" && window.localStorage.getItem(WIDGET_KEY) === "true";

export async function setWidgetPreference(enabled: boolean) {
  await invoke("widget_set_enabled", { enabled });
  window.localStorage.setItem(WIDGET_KEY, String(enabled));
}

export type DesktopSnapshot = Playback & {
  id: string;
  stageName: string;
  color: string;
  repeatIndex: number;
  repeatTotal: number;
  widgetEnabled: boolean;
  widgetVisible: boolean;
};

export type DesktopStage = {
  duration: number;
  stageName: string;
  color: string;
  repeatIndex: number;
  repeatTotal: number;
  context: string;
  voice: boolean;
  notifications: boolean;
};

export function desktopStage(
  step: Step,
  context: string,
  voice: boolean,
  notifications: boolean,
): DesktopStage {
  return {
    duration: step.duration,
    stageName: step.stageName,
    color: stageColorPalette[stageColor(step.color)].solid,
    repeatIndex: step.repeatIndex,
    repeatTotal: step.repeatTotal,
    context,
    voice,
    notifications,
  };
}

export function startDesktopSession(input: {
  id: string;
  stages: DesktopStage[];
  index: number;
  remaining: number;
  finish: { title: string; body: string; voice: boolean; notifications: boolean };
}) {
  return invoke<DesktopSnapshot>("desktop_start_session", { input });
}

export function readDesktopSession(sessionId: string) {
  return invoke<DesktopSnapshot | null>("desktop_session_state", { sessionId });
}

export function controlDesktopSession(
  sessionId: string,
  action: "pause" | "resume" | "previous" | "next" | "reset",
) {
  return invoke<DesktopSnapshot>("desktop_control", { sessionId, action });
}

export function stopDesktopSession(sessionId: string) {
  return invoke<void>("desktop_stop_session", { sessionId });
}

/** Android uses the same snapshot shape as Windows, but the implementation is
 * a native foreground service exposed through a Tauri mobile plugin. */
export function startAndroidSession(input: {
  id: string;
  stages: DesktopStage[];
  index: number;
  remaining: number;
  finish: { title: string; body: string; voice: boolean; notifications: boolean };
}) {
  return invoke<DesktopSnapshot>("plugin:android-session|start", {
    id: input.id,
    stages: input.stages,
    index: input.index,
    remaining: input.remaining,
    finishTitle: input.finish.title,
  });
}

export function readAndroidSession() {
  return invoke<DesktopSnapshot>("plugin:android-session|state");
}

export function controlAndroidSession(
  sessionId: string,
  action: "pause" | "resume" | "previous" | "next" | "reset",
) {
  return invoke<DesktopSnapshot>("plugin:android-session|control", { id: sessionId, action });
}

export function stopAndroidSession() {
  return invoke<void>("plugin:android-session|stop");
}

export const isNativeSession = () => isTauriDesktop() || isAndroidApp();

export function startNativeSession(input: Parameters<typeof startDesktopSession>[0]) {
  return isAndroidApp() ? startAndroidSession(input) : startDesktopSession(input);
}

export function readNativeSession(sessionId: string) {
  return isAndroidApp() ? readAndroidSession() : readDesktopSession(sessionId);
}

export function controlNativeSession(
  sessionId: string,
  action: "pause" | "resume" | "previous" | "next" | "reset",
) {
  return isAndroidApp()
    ? controlAndroidSession(sessionId, action)
    : controlDesktopSession(sessionId, action);
}

export function stopNativeSession(sessionId: string) {
  return isAndroidApp() ? stopAndroidSession() : stopDesktopSession(sessionId);
}
