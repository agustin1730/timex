#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod native_session;

use native_session::{Session, SessionInput, Snapshot, Transition};
use notify_rust::{Notification, NotificationResponse};
use std::{
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, PhysicalPosition, RunEvent, State, WebviewUrl, WebviewWindowBuilder,
    WindowEvent, Wry,
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

#[derive(Clone)]
struct ScheduledNotice {
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
    widget_item: Option<MenuItem<Wry>>,
    widget_enabled: bool,
    widget_visible: bool,
    widget_dismissed: bool,
    session: Option<Session>,
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

fn sync_widget_menu(guard: &DesktopState) {
    if let Some(item) = guard.widget_item.as_ref() {
        let _ = item.set_text(if guard.widget_visible {
            "Ocultar mini widget"
        } else {
            "Mostrar mini widget"
        });
        let _ = item.set_enabled(guard.status.keeps_window_alive());
    }
}

fn widget_window(app: &AppHandle, state: &SharedState, visible: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("widget")
        .ok_or("Falta la ventana del widget")?;
    if visible {
        let monitor = app
            .get_webview_window("main")
            .and_then(|main| main.current_monitor().ok().flatten())
            .or_else(|| window.primary_monitor().ok().flatten())
            .ok_or("No se encontró el monitor")?;
        let work = monitor.work_area();
        let size = window.outer_size().map_err(|error| error.to_string())?;
        let x = work.position.x + (work.size.width as i32 - size.width as i32 - 16).max(0);
        let y = work.position.y + (work.size.height as i32 - size.height as i32 - 16).max(0);
        window
            .set_position(PhysicalPosition::new(x, y))
            .map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
    } else {
        window.hide().map_err(|error| error.to_string())?;
    }
    if let Ok(mut guard) = state.lock() {
        guard.widget_visible = visible;
        sync_widget_menu(&guard);
    }
    Ok(())
}

fn show_widget_if_enabled(app: &AppHandle, state: &SharedState) {
    let show = state
        .lock()
        .map(|guard| {
            guard.widget_enabled
                && !guard.widget_visible
                && !guard.widget_dismissed
                && guard.status.keeps_window_alive()
        })
        .unwrap_or(false);
    if show {
        if let Err(error) = widget_window(app, state, true) {
            eprintln!("No se pudo abrir el mini widget: {error}");
        }
    }
}

fn announce(app: &AppHandle, state: &SharedState, notice: &ScheduledNotice) {
    stop_voice(state);
    if let Some(text) = notice.voice_text.as_deref() {
        if let Ok(mut guard) = state.lock() {
            if let Some(tts) = guard.tts.as_mut() {
                let _ = tts.speak(text, true);
            }
        }
    }
    let suppress = state
        .lock()
        .map(|guard| guard.widget_visible && !notice.final_notice)
        .unwrap_or(false);
    if !suppress {
        if let Some(title) = notice.notification_title.as_deref() {
            show_notification(
                app,
                title,
                notice.notification_body.as_deref().unwrap_or_default(),
            );
        }
    }
}

fn show_notification(app: &AppHandle, title: &str, body: &str) {
    let mut notification = Notification::new();
    notification
        .summary(title)
        .body(body)
        .app_id(&app.config().identifier)
        .action("open", "Abrir Time X");

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

fn transition_notice(transition: Transition) -> ScheduledNotice {
    match transition {
        Transition::Stage(stage) => ScheduledNotice {
            voice_text: stage.voice.then_some(stage.stage_name.clone()),
            notification_title: stage
                .notifications
                .then(|| format!("Etapa: {}", stage.stage_name)),
            notification_body: stage.notifications.then_some(stage.context),
            final_notice: false,
        },
        Transition::Finish(finish) => ScheduledNotice {
            voice_text: finish.voice.then_some(finish.title.clone()),
            notification_title: finish.notifications.then_some(finish.title),
            notification_body: finish.notifications.then_some(finish.body),
            final_notice: true,
        },
    }
}

fn spawn_desktop_worker(app: AppHandle, state: SharedState, generation: u64) {
    thread::spawn(move || loop {
        let (event, finished) = {
            let mut guard = match state.lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };
            if guard.generation != generation || guard.status != SessionStatus::Running {
                return;
            }
            let Some(session) = guard.session.as_mut() else {
                return;
            };
            let event = session.advance(Instant::now());
            let finished = session.finished;
            if finished {
                guard.status = SessionStatus::Finished;
                if let Some(item) = guard.status_item.as_ref() {
                    let _ = item.set_text(SessionStatus::Finished.label());
                }
                sync_widget_menu(&guard);
            }
            (event, finished)
        };
        if state
            .lock()
            .map(|guard| guard.generation != generation)
            .unwrap_or(true)
        {
            return;
        }
        if finished {
            let _ = widget_window(&app, &state, false);
        }
        if let Some(event) = event {
            announce(&app, &state, &transition_notice(event));
        }
        if finished {
            return;
        }
        thread::sleep(Duration::from_millis(25));
    });
}

fn desktop_snapshot(state: &SharedState, id: Option<&str>) -> Option<Snapshot> {
    let guard = state.lock().ok()?;
    let session = guard.session.as_ref()?;
    if id.is_some_and(|id| id != session.id) {
        return None;
    }
    Some(session.snapshot(Instant::now(), guard.widget_enabled, guard.widget_visible))
}

#[tauri::command]
fn desktop_start_session(
    app: AppHandle,
    state: State<'_, SharedState>,
    input: SessionInput,
) -> Result<Snapshot, String> {
    let session = Session::new(input, Instant::now())?;
    let first = session.stages[session.index].clone();
    let shared = state.inner().clone();
    let generation = {
        let mut guard = shared.lock().map_err(|error| error.to_string())?;
        guard.generation += 1;
        guard.status = SessionStatus::Running;
        guard.widget_dismissed = false;
        guard.session = Some(session);
        if let Some(item) = guard.status_item.as_ref() {
            let _ = item.set_text(SessionStatus::Running.label());
        }
        sync_widget_menu(&guard);
        guard.generation
    };
    show_widget_if_enabled(&app, &shared);
    announce(&app, &shared, &transition_notice(Transition::Stage(first)));
    spawn_desktop_worker(app, shared.clone(), generation);
    desktop_snapshot(&shared, None).ok_or("No se pudo iniciar la sesión".into())
}

#[tauri::command]
fn desktop_session_state(
    state: State<'_, SharedState>,
    session_id: Option<String>,
) -> Option<Snapshot> {
    desktop_snapshot(state.inner(), session_id.as_deref())
}

#[tauri::command]
fn desktop_control(
    app: AppHandle,
    state: State<'_, SharedState>,
    session_id: String,
    action: String,
) -> Result<Snapshot, String> {
    let shared = state.inner().clone();
    let (event, running, reset, generation) = {
        let mut guard = shared.lock().map_err(|error| error.to_string())?;
        let session = guard.session.as_mut().ok_or("No hay sesión activa")?;
        if session.id != session_id {
            return Err("La sesión cambió".into());
        }
        let event = session.control(&action, Instant::now())?;
        let running = session.running;
        let reset = action == "reset";
        guard.generation += 1;
        guard.status = if reset {
            SessionStatus::Idle
        } else if running {
            SessionStatus::Running
        } else {
            SessionStatus::Paused
        };
        if let Some(item) = guard.status_item.as_ref() {
            let _ = item.set_text(guard.status.label());
        }
        sync_widget_menu(&guard);
        (event, running, reset, guard.generation)
    };
    if reset {
        widget_window(&app, &shared, false)?;
    } else if running {
        show_widget_if_enabled(&app, &shared);
    }
    if let Some(event) = event {
        announce(&app, &shared, &transition_notice(event));
    } else if !running {
        stop_voice(&shared);
    }
    if running {
        spawn_desktop_worker(app, shared.clone(), generation);
    }
    desktop_snapshot(&shared, Some(&session_id)).ok_or("No hay sesión activa".into())
}

#[tauri::command]
fn desktop_stop_session(app: AppHandle, state: State<'_, SharedState>, session_id: String) {
    let shared = state.inner();
    let stopped = if let Ok(mut guard) = shared.lock() {
        if guard
            .session
            .as_ref()
            .is_some_and(|session| session.id == session_id)
        {
            guard.generation += 1;
            guard.session = None;
            guard.status = SessionStatus::Idle;
            if let Some(item) = guard.status_item.as_ref() {
                let _ = item.set_text(SessionStatus::Idle.label());
            }
            sync_widget_menu(&guard);
            true
        } else {
            false
        }
    } else {
        false
    };
    if stopped {
        let _ = widget_window(&app, shared, false);
        stop_voice(shared);
    }
}

#[tauri::command]
fn widget_set_enabled(
    app: AppHandle,
    state: State<'_, SharedState>,
    enabled: bool,
) -> Result<(), String> {
    let shared = state.inner();
    if let Ok(mut guard) = shared.lock() {
        guard.widget_enabled = enabled;
        guard.widget_dismissed = false;
    }
    if enabled {
        show_widget_if_enabled(&app, shared);
    } else {
        widget_window(&app, shared, false)?;
    }
    Ok(())
}

#[tauri::command]
fn widget_dismiss(app: AppHandle, state: State<'_, SharedState>) -> Result<(), String> {
    let shared = state.inner();
    if let Ok(mut guard) = shared.lock() {
        guard.widget_dismissed = true;
    }
    widget_window(&app, shared, false)
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
            .title("Salir de Time X")
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
        widget_item: None,
        widget_enabled: false,
        widget_visible: false,
        widget_dismissed: false,
        session: None,
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
            set_session_status,
            stop_native_voice,
            native_notifications_available,
            desktop_start_session,
            desktop_session_state,
            desktop_control,
            desktop_stop_session,
            widget_set_enabled,
            widget_dismiss
        ])
        .setup(move |app| {
            WebviewWindowBuilder::new(app, "widget", WebviewUrl::App("widget.html".into()))
                .title("Mini widget de Time X")
                .inner_size(224.0, 150.0)
                .resizable(false)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .visible(false)
                .build()?;
            let show = MenuItem::with_id(app, "show", "Mostrar Time X", true, None::<&str>)?;
            let status = MenuItem::with_id(
                app,
                "status",
                SessionStatus::Idle.label(),
                false,
                None::<&str>,
            )?;
            let widget =
                MenuItem::with_id(app, "widget", "Mostrar mini widget", false, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &status, &widget, &quit])?;
            if let Ok(mut guard) = setup_state.lock() {
                guard.status_item = Some(status);
                guard.widget_item = Some(widget);
            }
            let tray_state = setup_state.clone();
            let mut tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Time X")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "widget" => {
                        let visible = tray_state
                            .lock()
                            .map(|guard| guard.widget_visible)
                            .unwrap_or(false);
                        if visible {
                            if let Ok(mut guard) = tray_state.lock() {
                                guard.widget_dismissed = true;
                            }
                            let _ = widget_window(app, &tray_state, false);
                        } else {
                            if let Ok(mut guard) = tray_state.lock() {
                                guard.widget_enabled = true;
                                guard.widget_dismissed = false;
                            }
                            show_widget_if_enabled(app, &tray_state);
                        }
                    }
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
        .expect("No se pudo iniciar Time X")
        .run(move |app, event| match event {
            RunEvent::WindowEvent {
                label,
                event: WindowEvent::CloseRequested { api, .. },
                ..
            } if label == "widget" => {
                api.prevent_close();
                if let Ok(mut guard) = shared.lock() {
                    guard.widget_dismissed = true;
                }
                let _ = widget_window(app, &shared, false);
            }
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
                    let widget_visible = shared
                        .lock()
                        .map(|guard| guard.widget_visible)
                        .unwrap_or(false);
                    if should_notify && !widget_visible {
                        show_notification(
                            app,
                            "Time X sigue funcionando",
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
