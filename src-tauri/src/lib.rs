#[cfg(target_os = "windows")]
mod native_session;
#[cfg(target_os = "windows")]
mod desktop;
#[cfg(target_os = "android")]
mod android_session;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    desktop::run();

    #[cfg(not(target_os = "windows"))]
    {
        let mut builder = tauri::Builder::default();
        #[cfg(target_os = "android")]
        {
            builder = builder
                .plugin(android_session::init())
                .invoke_handler(tauri::generate_handler![
                    android_session::start,
                    android_session::state,
                    android_session::control,
                    android_session::stop
                ]);
        }
        builder = builder
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_notification::init());
        builder
            .run(tauri::generate_context!())
            .expect("No se pudo abrir Time X");
    }
}
