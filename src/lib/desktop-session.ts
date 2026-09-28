import { invoke } from "@tauri-apps/api/core";
import { stageColor, stageColorPalette } from "./stage-colors";
import type { Step } from "./timer-model";
import type { Playback } from "./timer-session";

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
