#[cfg(target_os = "windows")]
mod native_session;
#[cfg(target_os = "windows")]
mod desktop;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    desktop::run();

    #[cfg(not(target_os = "windows"))]
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("No se pudo abrir Time X");
}
