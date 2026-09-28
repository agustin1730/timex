import { getVersion } from "@tauri-apps/api/app";
import { isTauriDesktop } from "./desktop-session";

export const APP_VERSION = "0.23.0";

export function platformName() {
  if (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)) return "Android";
  if (isTauriDesktop()) return "Windows";
  return "Web";
}

export async function installedVersion() {
  if (!isTauriDesktop()) return APP_VERSION;
  try {
    return await getVersion();
  } catch {
    return APP_VERSION;
  }
}
