import { getVersion } from "@tauri-apps/api/app";
import { isTauriDesktop } from "./desktop-session";
import { isTauriApp } from "./platform";

export const APP_VERSION = "0.24.0";

export function platformName() {
  if (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)) return "Android";
  if (isTauriDesktop()) return "Windows";
  return "Web";
}

export async function installedVersion() {
  if (!isTauriApp()) return APP_VERSION;
  try {
    return await getVersion();
  } catch {
    return APP_VERSION;
  }
}
