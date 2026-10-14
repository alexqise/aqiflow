mod db;

use db::{AppData, CalEvent, Project, Tag, Task};
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WebviewWindow, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const DEFAULT_QUICK_SHORTCUT: &str = "CommandOrControl+Shift+Space";
const TRAY_ID: &str = "main-tray";

struct Db(Mutex<Connection>);

fn err(e: impl ToString) -> String {
    e.to_string()
}

/// Tells every window that persisted data changed so they can reload.
fn notify(app: &AppHandle, window: &WebviewWindow) {
    let _ = app.emit("data-changed", window.label().to_string());
}

#[tauri::command]
fn load_all(db: State<Db>) -> Result<AppData, String> {
    let conn = db.0.lock().map_err(err)?;
    db::load_all(&conn).map_err(err)
}

#[tauri::command]
fn save_tasks(app: AppHandle, window: WebviewWindow, db: State<Db>, tasks: Vec<Task>) -> Result<(), String> {
    {
        let mut conn = db.0.lock().map_err(err)?;
        let tx = conn.transaction().map_err(err)?;
        for t in &tasks {
            db::save_task(&tx, t).map_err(err)?;
        }
        tx.commit().map_err(err)?;
    }
    notify(&app, &window);
    Ok(())
}

#[tauri::command]
fn delete_tasks(app: AppHandle, window: WebviewWindow, db: State<Db>, ids: Vec<String>) -> Result<(), String> {
    {
        let conn = db.0.lock().map_err(err)?;
        for id in &ids {
            db::delete_task(&conn, id).map_err(err)?;
        }
    }
    notify(&app, &window);
    Ok(())
}

#[tauri::command]
fn save_project(app: AppHandle, window: WebviewWindow, db: State<Db>, project: Project) -> Result<(), String> {
    db::save_project(&*db.0.lock().map_err(err)?, &project).map_err(err)?;
    notify(&app, &window);
    Ok(())
}

#[tauri::command]
fn delete_project(app: AppHandle, window: WebviewWindow, db: State<Db>, id: String) -> Result<(), String> {
    db::delete_project(&*db.0.lock().map_err(err)?, &id).map_err(err)?;
    notify(&app, &window);
    Ok(())
}

#[tauri::command]
fn save_tag(app: AppHandle, window: WebviewWindow, db: State<Db>, tag: Tag) -> Result<(), String> {
    db::save_tag(&*db.0.lock().map_err(err)?, &tag).map_err(err)?;
    notify(&app, &window);
    Ok(())
}

#[tauri::command]
fn delete_tag(app: AppHandle, window: WebviewWindow, db: State<Db>, id: String) -> Result<(), String> {
    db::delete_tag(&*db.0.lock().map_err(err)?, &id).map_err(err)?;
    notify(&app, &window);
    Ok(())
}

#[tauri::command]
fn save_event(app: AppHandle, window: WebviewWindow, db: State<Db>, event: CalEvent) -> Result<(), String> {
    db::save_event(&*db.0.lock().map_err(err)?, &event).map_err(err)?;
    notify(&app, &window);
    Ok(())
}

#[tauri::command]
fn delete_event(app: AppHandle, window: WebviewWindow, db: State<Db>, id: String) -> Result<(), String> {
    db::delete_event(&*db.0.lock().map_err(err)?, &id).map_err(err)?;
    notify(&app, &window);
    Ok(())
}

#[tauri::command]
fn set_setting(app: AppHandle, window: WebviewWindow, db: State<Db>, key: String, value: String) -> Result<(), String> {
    db::set_setting(&*db.0.lock().map_err(err)?, &key, &value).map_err(err)?;
    notify(&app, &window);
    Ok(())
}

/// Re-binds the system-wide quick-add shortcut and persists it.
#[tauri::command]
fn set_quick_shortcut(app: AppHandle, db: State<Db>, accelerator: String) -> Result<(), String> {
    let gs = app.global_shortcut();
    gs.unregister_all().map_err(err)?;
    if let Err(e) = gs.register(accelerator.as_str()) {
        // Restore the previous binding so the user is never left without one.
        let prev = db::get_setting(&*db.0.lock().map_err(err)?, "quickShortcut")
            .ok()
            .flatten()
            .unwrap_or_else(|| DEFAULT_QUICK_SHORTCUT.into());
        let _ = gs.register(prev.as_str());
        return Err(err(e));
    }
    db::set_setting(&*db.0.lock().map_err(err)?, "quickShortcut", &accelerator).map_err(err)?;
    Ok(())
}

/// Text shown next to the menu bar icon (next event, running focus timer, …).
#[tauri::command]
fn set_tray_title(app: AppHandle, title: Option<String>) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_title(title.as_deref()).map_err(err)?;
    }
    Ok(())
}

#[tauri::command]
fn hide_quick(app: AppHandle) {
    if let Some(w) = app.get_webview_window("quick") {
        let _ = w.hide();
    }
}

#[tauri::command]
fn show_main(app: AppHandle) {
    show_main_window(&app);
}

fn show_main_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn toggle_quick(app: &AppHandle) {
    let Some(w) = app.get_webview_window("quick") else { return };
    if w.is_visible().unwrap_or(false) {
        let _ = w.hide();
    } else {
        let _ = w.center();
        let _ = w.show();
        let _ = w.set_focus();
        let _ = w.emit("quick-open", ());
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Open Aqiflow", true, None::<&str>)?;
    let quick = MenuItem::with_id(app, "quick", "Quick Add Task…", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Aqiflow", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quick, &sep, &quit])?;
    let icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "quick" => toggle_quick(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_quick(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let conn = db::open(&dir.join("aqiflow.db")).map_err(|e| e.to_string())?;
            let accel = db::get_setting(&conn, "quickShortcut")
                .ok()
                .flatten()
                .unwrap_or_else(|| DEFAULT_QUICK_SHORTCUT.into());
            app.manage(Db(Mutex::new(conn)));

            if app.global_shortcut().register(accel.as_str()).is_err() {
                let _ = app.global_shortcut().register(DEFAULT_QUICK_SHORTCUT);
            }
            build_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| match (window.label(), event) {
            // macOS convention: closing the main window keeps the app alive.
            ("main", WindowEvent::CloseRequested { api, .. }) => {
                api.prevent_close();
                let _ = window.hide();
            }
            ("quick", WindowEvent::Focused(false)) => {
                let _ = window.hide();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            load_all,
            save_tasks,
            delete_tasks,
            save_project,
            delete_project,
            save_tag,
            delete_tag,
            save_event,
            delete_event,
            set_setting,
            set_quick_shortcut,
            set_tray_title,
            hide_quick,
            show_main,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Aqiflow")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { .. } = event {
                show_main_window(app);
            }
            let _ = (app, event);
        });
}
