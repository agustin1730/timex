import { exampleTimer, type TimerPreset } from "./timer-model";

const KEY = "interval-timers.v1";
const SETTINGS_KEY = "interval-timers.settings.v1";

export type AppSettings = {
  voice: boolean;
  notifications: boolean;
};

export const defaultSettings: AppSettings = { voice: true, notifications: true };

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadTimers(): TimerPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const seed = [exampleTimer()];
      window.localStorage.setItem(KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as TimerPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTimers(timers: TimerPreset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(timers));
  emit();
}

export function getTimer(id: string): TimerPreset | undefined {
  return loadTimers().find((t) => t.id === id);
}

export function upsertTimer(timer: TimerPreset) {
  const timers = loadTimers();
  const idx = timers.findIndex((t) => t.id === timer.id);
  const next = { ...timer, updatedAt: Date.now() };
  if (idx >= 0) timers[idx] = next;
  else timers.push(next);
  saveTimers(timers);
}

export function deleteTimer(id: string) {
  saveTimers(loadTimers().filter((t) => t.id !== id));
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  emit();
}
