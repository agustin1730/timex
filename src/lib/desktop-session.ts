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
  blockName?: string;
  blockProgress?: number;
  widgetEnabled: boolean;
  widgetVisible: boolean;
};

export type DesktopStage = {
  duration: number;
  stageName: string;
  color: string;
  repeatIndex: number;
  repeatTotal: number;
  blockName: string;
  blockKey: string;
  context: string;
  voice: boolean;
  notifications: boolean;
};

/** Android must never replace a valid local player state with an empty or stale native reply. */
export function requireAndroidSnapshot(
  value: unknown,
  sessionId: string,
  stageCount?: number,
): DesktopSnapshot {
  if (!value || typeof value !== "object")
    throw new Error("El servicio Android no devolvió una sesión válida");
  const state = value as Partial<DesktopSnapshot>;
  if (
    state.id !== sessionId ||
    !Number.isInteger(state.index) ||
    (state.index as number) < 0 ||
    (stageCount !== undefined && (state.index as number) >= stageCount) ||
    !Number.isFinite(state.remaining) ||
    (state.remaining as number) < 0 ||
    typeof state.running !== "boolean" ||
    typeof state.finished !== "boolean" ||
    typeof state.stageName !== "string" ||
    typeof state.color !== "string" ||
    !Number.isInteger(state.repeatIndex) ||
    !Number.isInteger(state.repeatTotal) ||
    typeof state.widgetVisible !== "boolean"
  ) {
    throw new Error("El servicio Android devolvió un estado incompleto o de otra sesión");
  }
  return state as DesktopSnapshot;
}

export function desktopStage(
  step: Step,
  context: string,
  voice: boolean,
  notifications: boolean,
  blockKey = String(step.blockIndex),
): DesktopStage {
  return {
    duration: step.duration,
    stageName: step.stageName,
    color: stageColorPalette[stageColor(step.color)].solid,
    repeatIndex: step.repeatIndex,
    repeatTotal: step.repeatTotal,
    blockName: step.blockName,
    blockKey,
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
  return invoke<unknown>("android_session_start", { input }).then((value) =>
    requireAndroidSnapshot(value, input.id, input.stages.length),
  );
}

export function readAndroidSession(sessionId: string) {
  return invoke<unknown>("android_session_state").then((value) =>
    value == null ? null : requireAndroidSnapshot(value, sessionId),
  );
}

export function controlAndroidSession(
  sessionId: string,
  action: "pause" | "resume" | "previous" | "next" | "reset",
) {
  return invoke<unknown>("android_session_control", { sessionId, action }).then((value) =>
    requireAndroidSnapshot(value, sessionId),
  );
}

export function stopAndroidSession(sessionId: string) {
  return invoke<void>("android_session_stop", { sessionId });
}

export const isNativeSession = () => isTauriDesktop() || isAndroidApp();

export function startNativeSession(input: Parameters<typeof startDesktopSession>[0]) {
  return isAndroidApp() ? startAndroidSession(input) : startDesktopSession(input);
}

export function readNativeSession(sessionId: string) {
  return isAndroidApp() ? readAndroidSession(sessionId) : readDesktopSession(sessionId);
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
  return isAndroidApp() ? stopAndroidSession(sessionId) : stopDesktopSession(sessionId);
}
