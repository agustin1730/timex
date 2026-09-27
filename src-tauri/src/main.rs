#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use notify_rust::{Notification, NotificationResponse};
use serde::Deserialize;
use std::{
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, RunEvent, State, WindowEvent, Wry,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
enum SessionStatus {
    #[default]
    Idle,
    Running,
    Paused,
    Finished,
}

impl SessionStatus {
    fn from_web(value: &str) -> Self {
        match value {
            "running" => Self::Running,
            "paused" => Self::Paused,
            "finished" => Self::Finished,
            _ => Self::Idle,
        }
    }
    fn label(self) -> &'static str {
        match self {
            Self::Idle => "Estado: sin sesión",
            Self::Running => "Estado: en ejecución",
            Self::Paused => "Estado: pausada",
            Self::Finished => "Estado: finalizada",
        }
    }
    fn keeps_window_alive(self) -> bool {
        matches!(self, Self::Running | Self::Paused)
    }
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScheduledNotice {
    delay_ms: u64,
    voice_text: Option<String>,
    notification_title: Option<String>,
    notification_body: Option<String>,
    final_notice: bool,
}

struct DesktopState {
    generation: u64,
    status: SessionStatus,
    hidden_notice_shown: bool,
    tts: Option<tts::Tts>,
    status_item: Option<MenuItem<Wry>>,
}
type SharedState = Arc<Mutex<DesktopState>>;

fn stop_voice(state: &SharedState) {
    if let Ok(mut guard) = state.lock() {
        if let Some(tts) = guard.tts.as_mut() {
            let _ = tts.stop();
        }
    }
}

fn spanish_tts() -> Option<tts::Tts> {
    let mut tts = tts::Tts::default().ok()?;
    if let Ok(voices) = tts.voices() {
        if let Some(voice) = voices.iter().find(|voice| {
            voice
                .language()
                .to_string()
                .to_lowercase()
                .starts_with("es")
        }) {
            let _ = tts.set_voice(voice);
        }
    }
    Some(tts)
}

fn set_status(state: &SharedState, status: SessionStatus) {
    if let Ok(mut guard) = state.lock() {
        guard.status = status;
        if let Some(item) = guard.status_item.as_ref() {
            let _ = item.set_text(status.label());
        }
    }
}

fn announce(app: &AppHandle, state: &SharedState, notice: &ScheduledNotice) {
    if let Some(text) = notice.voice_text.as_deref() {
        if let Ok(mut guard) = state.lock() {
            if let Some(tts) = guard.tts.as_mut() {
                let _ = tts.stop();
                let _ = tts.speak(text, true);
            }
        }
    }
    if let Some(title) = notice.notification_title.as_deref() {
        show_notification(
            app,
            title,
            notice.notification_body.as_deref().unwrap_or_default(),
        );
    }
}

fn show_notification(app: &AppHandle, title: &str, body: &str) {
    let mut notification = Notification::new();
    notification
        .summary(title)
        .body(body)
        .app_id(&app.config().identifier)
        .action("open", "Abrir Intervalos");

    match notification.show() {
        Ok(handle) => {
            let app = app.clone();
            thread::spawn(move || {
                let _ = handle.wait_for_response(move |response: &NotificationResponse| {
                    if notification_opens_window(response) {
                        show_main(&app);
                    }
                });
            });
        }
        Err(error) => eprintln!("No se pudo mostrar la notificación: {error}"),
    }
}

fn notification_opens_window(response: &NotificationResponse) -> bool {
    matches!(response, NotificationResponse::Default)
        || matches!(response, NotificationResponse::Action(action) if action == "open")
}

/// Select only the most recent due notice so resume never emits a stale burst.
fn next_due(events: &[ScheduledNotice], start: usize, elapsed_ms: u64) -> Option<usize> {
    if start >= events.len() || events[start].delay_ms > elapsed_ms {
        return None;
    }
    let mut selected = start;
    while selected + 1 < events.len() && events[selected + 1].delay_ms <= elapsed_ms {
        selected += 1;
    }
    Some(selected)
}

#[tauri::command]
fn replace_native_schedule(
    app: AppHandle,
    state: State<'_, SharedState>,
    notices: Vec<ScheduledNotice>,
) {
    let state = state.inner().clone();
    let generation = {
        let mut guard = state.lock().expect("desktop state poisoned");
        guard.generation += 1;
        guard.status = SessionStatus::Running;
        if let Some(item) = guard.status_item.as_ref() {
            let _ = item.set_text(SessionStatus::Running.label());
        }
        guard.generation
    };
    stop_voice(&state);
    thread::spawn(move || {
        let started = Instant::now();
        let mut index = 0;
        while index < notices.len() {
            let active = state
                .lock()
                .map(|guard| {
                    guard.generation == generation && guard.status == SessionStatus::Running
                })
                .unwrap_or(false);
            if !active {
                return;
            }
            let elapsed = started.elapsed().as_millis() as u64;
            if let Some(due) = next_due(&notices, index, elapsed) {
                let notice = &notices[due];
                announce(&app, &state, notice);
                index = due + 1;
                if notice.final_notice {
                    set_status(&state, SessionStatus::Finished);
                    return;
                }
            } else {
                let wait = notices[index].delay_ms.saturating_sub(elapsed).min(100);
                thread::sleep(Duration::from_millis(wait.max(10)));
            }
        }
    });
}

#[tauri::command]
fn set_session_status(state: State<'_, SharedState>, status: String) {
    let state = state.inner();
    let next = SessionStatus::from_web(&status);
    if next != SessionStatus::Running {
        if let Ok(mut guard) = state.lock() {
            guard.generation += 1;
        }
        stop_voice(state);
    }
    set_status(state, next);
}

#[tauri::command]
fn stop_native_voice(state: State<'_, SharedState>) {
    stop_voice(state.inner());
}

#[tauri::command]
fn native_notifications_available() -> bool {
    true
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if let Err(error) = window.show() {
            eprintln!("No se pudo mostrar la ventana principal: {error}");
        }
        if let Err(error) = window.unminimize() {
            eprintln!("No se pudo restaurar la ventana principal: {error}");
        }
        if let Err(error) = window.set_focus() {
            eprintln!("No se pudo enfocar la ventana principal: {error}");
        }
        if let Some(state) = app.try_state::<SharedState>() {
            if let Ok(mut guard) = state.lock() {
                guard.hidden_notice_shown = false;
            }
        }
    } else {
        eprintln!("No se encontró la ventana principal");
    }
}

fn exit_requested(app: &AppHandle, state: &SharedState) {
    let active = state
        .lock()
        .map(|guard| guard.status.keeps_window_alive())
        .unwrap_or(false);
    if active {
        show_main(app);
        let confirmed = app.dialog().message("Hay una sesión abierta. Si salís, se detendrán el temporizador, la voz y las notificaciones.")
            .title("Salir de Intervalos")
            .buttons(MessageDialogButtons::OkCancelCustom("Salir".into(), "Cancelar".into()))
            .blocking_show();
        if !confirmed {
            return;
        }
    }
    if let Ok(mut guard) = state.lock() {
        guard.generation += 1;
        guard.status = SessionStatus::Idle;
    }
    stop_voice(state);
    app.exit(0);
}

fn main() {
    let shared: SharedState = Arc::new(Mutex::new(DesktopState {
        generation: 0,
        status: SessionStatus::Idle,
        hidden_notice_shown: false,
        tts: spanish_tts(),
        status_item: None,
    }));
    let managed = shared.clone();
    let setup_state = shared.clone();
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(managed)
        .invoke_handler(tauri::generate_handler![
            replace_native_schedule,
            set_session_status,
            stop_native_voice,
            native_notifications_available
        ])
        .setup(move |app| {
            let show = MenuItem::with_id(app, "show", "Mostrar Intervalos", true, None::<&str>)?;
            let status = MenuItem::with_id(
                app,
                "status",
                SessionStatus::Idle.label(),
                false,
                None::<&str>,
            )?;
            let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &status, &quit])?;
            if let Ok(mut guard) = setup_state.lock() {
                guard.status_item = Some(status);
            }
            let tray_state = setup_state.clone();
            let mut tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Intervalos")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => exit_requested(app, &tray_state),
                    _ => {}
                })
                .on_tray_icon_event(move |tray, event| {
                    if matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } | TrayIconEvent::DoubleClick {
                            button: MouseButton::Left,
                            ..
                        }
                    ) {
                        show_main(tray.app_handle());
                    }
                });
            if let Some(icon) = app.default_window_icon().cloned() {
                tray = tray.icon(icon);
            }
            tray.build(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("No se pudo iniciar Intervalos")
        .run(move |app, event| match event {
            RunEvent::WindowEvent {
                label,
                event: WindowEvent::CloseRequested { api, .. },
                ..
            } if label == "main" => {
                let active = shared
                    .lock()
                    .map(|guard| guard.status.keeps_window_alive())
                    .unwrap_or(false);
                if active {
                    api.prevent_close();
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                    let should_notify = if let Ok(mut guard) = shared.lock() {
                        let first = !guard.hidden_notice_shown;
                        guard.hidden_notice_shown = true;
                        first
                    } else {
                        false
                    };
                    if should_notify {
                        show_notification(
                            app,
                            "Intervalos sigue funcionando",
                            "La sesión continúa en la bandeja del sistema.",
                        );
                    }
                } else {
                    app.exit(0);
                }
            }
            _ => {}
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    fn notice(delay_ms: u64) -> ScheduledNotice {
        ScheduledNotice {
            delay_ms,
            voice_text: None,
            notification_title: None,
            notification_body: None,
            final_notice: false,
        }
    }
    #[test]
    fn missed_notices_collapse_to_latest_due() {
        let events = vec![notice(0), notice(1_000), notice(2_000), notice(4_000)];
        assert_eq!(next_due(&events, 0, 0), Some(0));
        assert_eq!(next_due(&events, 1, 3_500), Some(2));
        assert_eq!(next_due(&events, 3, 3_500), None);
    }
    #[test]
    fn paused_and_running_keep_window_alive() {
        assert!(SessionStatus::Running.keeps_window_alive());
        assert!(SessionStatus::Paused.keeps_window_alive());
        assert!(!SessionStatus::Idle.keeps_window_alive());
        assert!(!SessionStatus::Finished.keeps_window_alive());
    }

    #[test]
    fn notification_click_and_open_action_restore_only_when_activated() {
        assert!(notification_opens_window(&NotificationResponse::Default));
        assert!(notification_opens_window(&NotificationResponse::Action(
            "open".to_owned()
        )));
        assert!(!notification_opens_window(&NotificationResponse::Closed(
            notify_rust::CloseReason::Dismissed
        )));
        assert!(!notification_opens_window(&NotificationResponse::Action(
            "other".to_owned()
        )));
    }
}
