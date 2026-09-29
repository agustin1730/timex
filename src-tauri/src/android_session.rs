#![cfg(target_os = "android")]

use tauri::{plugin::{Builder, TauriPlugin}, Runtime};

/// Registers the Android foreground-service plugin. The Kotlin implementation
/// is copied into the generated Android project by scripts/android.ps1 so the
/// generated directory remains reproducible.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("android-session")
        .setup(|_app, api| {
            api.register_android_plugin(
                "com.agustin1730.intervalos.androidsession",
                "AndroidSessionPlugin",
            )?;
            Ok(())
        })
        .build()
}
