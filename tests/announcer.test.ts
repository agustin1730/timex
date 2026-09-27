import { test } from "node:test";
import assert from "node:assert/strict";
import {
  speak,
  stopSpeaking,
  notify,
  requestNotificationPermission,
} from "../src/lib/announcer.ts";

test("avisos web cancelan voz anterior y notifican solo con permiso", async () => {
  const calls = [];
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  globalThis.Notification = class {
    static permission = "granted";
    constructor(title) {
      calls.push(title);
    }
  };
  globalThis.window = {
    Notification: globalThis.Notification,
    speechSynthesis: {
      cancel: () => calls.push("cancel"),
      getVoices: () => [],
      speak: (u) => calls.push(u.text),
    },
  };
  speak("Trabajo");
  speak("Descanso");
  assert.deepEqual(calls, ["cancel", "Trabajo", "cancel", "Descanso"]);
  notify("Etapa", "");
  assert.equal(calls.at(-1), "Etapa");
  Notification.permission = "denied";
  notify("No", "");
  assert.equal(calls.at(-1), "Etapa");
  assert.equal(await requestNotificationPermission(), false);
});
test("puente recibe cancelación, voz y notificación; no pide permiso web", async () => {
  const calls = [];
  globalThis.window = {
    desktopTimer: {
      stopSpeaking: () => calls.push("cancel"),
      speak: (t) => calls.push(t),
      notify: (t) => calls.push(t),
    },
  };
  stopSpeaking();
  speak("Trabajo");
  notify("Etapa", "");
  assert.equal(await requestNotificationPermission(), true);
  assert.deepEqual(calls, ["cancel", "Trabajo", "Etapa"]);
});
test("permiso fallido no impide iniciar ni notificación fallida rompe motor", async () => {
  globalThis.Notification = class {
    static permission = "default";
    static requestPermission() {
      return Promise.reject(new Error("unsupported"));
    }
    constructor() {
      throw Error("unsupported");
    }
  };
  globalThis.window = { Notification: globalThis.Notification };
  assert.equal(await requestNotificationPermission(), false);
  Notification.permission = "granted";
  assert.doesNotThrow(() => notify("Etapa", ""));
});
