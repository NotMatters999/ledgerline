pub mod db;
pub mod workspace;
pub mod import;
pub mod validation;
pub mod engines;
pub mod commands;
pub mod utils;

use commands::workspace::*;
use commands::import::*;
use commands::engines::{mrr_get, arr_get, retention_get, ltv_get, cac_get, payback_get, forecast_get, cohort_get};
use commands::settings::{setting_set, setting_get, setting_get_f64, marketing_spend_add};
use commands::export::{export_csv, export_pdf};
use commands::backup::{backup_list, backup_create, backup_restore_request, backup_restore_confirm, BackupTokenStore};
use workspace::manager::WorkspaceManager;
use workspace::backup::BackupManager;
use utils::logger::Logger;
use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let start_time = std::time::Instant::now();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            let app_data_dir = app.path().app_data_dir().unwrap();
            
            // Initialize Logger
            Logger::init(app_data_dir.clone());
            
            let workspace_manager = WorkspaceManager::new(&app_data_dir).unwrap();
            let backup_manager = BackupManager::new(&app_data_dir);
            
            app.manage(AppState {
                workspace_manager: std::sync::Mutex::new(workspace_manager),
                backup_manager,
            });
            app.manage(BackupTokenStore::new());

            utils::logger::log_info("System", &format!("Cold start time: {:?}", start_time.elapsed()));
            Ok(())
        })
        .on_window_event(|_, event| {
            if let tauri::WindowEvent::Destroyed = event {
                utils::logger::log_info("System", "LedgerLine shutting down.");
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            workspace_list,
            workspace_create,
            workspace_rename,
            workspace_switch,
            workspace_delete_request,
            workspace_delete_confirm,
            import_preview,
            import_commit,
            mrr_get,
            arr_get,
            retention_get,
            ltv_get,
            cac_get,
            payback_get,
            forecast_get,
            cohort_get,
            setting_set,
            setting_get,
            setting_get_f64,
            marketing_spend_add,
            export_csv,
            export_pdf,
            backup_list,
            backup_create,
            backup_restore_request,
            backup_restore_confirm
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
