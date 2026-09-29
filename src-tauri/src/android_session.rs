#![cfg(target_os = "android")]

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::OnceLock;
use tauri::{plugin::{Builder, PluginHandle, TauriPlugin}, Wry};

static HANDLE: OnceLock<PluginHandle<Wry>> = OnceLock::new();

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartInput {
    pub id: String,
    pub stages: Vec<Value>,
    pub index: usize,
    pub remaining: f64,
    pub finish: FinishInput,
}

#[derive(Deserialize, Serialize)]
pub struct FinishInput {
    pub title: String,
    pub body: String,
    pub voice: bool,
    pub notifications: bool,
}

fn handle() -> Result<&'static PluginHandle<Wry>, String> {
    HANDLE.get().ok_or_else(|| "El plugin Android aún no está listo".into())
}

/// Registers the Android foreground-service plugin. The Kotlin implementation
/// is copied into the generated Android project by scripts/android.ps1 so the
/// generated directory remains reproducible.
pub fn init() -> TauriPlugin<Wry> {
    Builder::new("android-session")
        .setup(|_app, api| {
            let plugin = api.register_android_plugin(
                "com.agustin1730.intervalos.androidsession",
                "AndroidSessionPlugin",
            )?;
            let _ = HANDLE.set(plugin);
            Ok(())
        })
        .build()
}

#[tauri::command(rename = "android_session_start")]
pub fn start(input: StartInput) -> Result<Value, String> {
    let payload = json!({
        "id": input.id,
        "stages": input.stages,
        "index": input.index,
        "remaining": input.remaining,
        "finishTitle": input.finish.title,
    });
    handle()?.run_mobile_plugin("start", payload).map_err(|e| e.to_string())
}

#[tauri::command(rename = "android_session_state")]
pub fn state() -> Result<Value, String> {
    handle()?.run_mobile_plugin("state", ()).map_err(|e| e.to_string())
}

#[tauri::command(rename = "android_session_control")]
pub fn control(session_id: String, action: String) -> Result<Value, String> {
    handle()?
        .run_mobile_plugin("control", json!({ "id": session_id, "action": action }))
        .map_err(|e| e.to_string())
}

#[tauri::command(rename = "android_session_stop")]
pub fn stop(session_id: String) -> Result<(), String> {
    handle()?.run_mobile_plugin::<Value>("stop", json!({ "id": session_id })).map(|_| ()).map_err(|e| e.to_string())
}
