import { test } from "node:test";
import assert from "node:assert/strict";
import { runtimePlatform } from "../src/lib/platform.ts";

test("Android Tauri stays out of the Windows native session path", () => {
  assert.equal(runtimePlatform(true, "Mozilla/5.0 (Linux; Android 16)"), "android");
  assert.equal(runtimePlatform(true, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "windows");
  assert.equal(runtimePlatform(false, "Mozilla/5.0 (Linux; Android 16)"), "web");
  assert.equal(runtimePlatform(true, "unknown"), "other");
});
