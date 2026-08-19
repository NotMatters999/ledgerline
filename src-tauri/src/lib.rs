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
use commands::settings::{setting_set, setting_get, setting_get_f64, marketing_spend_add,
    exchange_rates_get, exchange_rates_set, currencies_missing_rates_get};
use commands::export::{csv_export, pdf_export};
use commands::backup::{backup_list, backup_create, backup_restore_request, backup_restore_confirm};
use commands::data::{mrr_log_list, mrr_log_count, mrr_log_add, mrr_log_delete_request, mrr_log_delete_confirm};
use workspace::manager::WorkspaceManager;
use workspace::backup::BackupManager;
use utils::logger::Logger;
use tauri::Manager;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let start_time = std::time::Instant::now();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            // Resolve an app data dir but avoid panicking if the platform API returns None.
            let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| {
                let fallback = std::env::temp_dir().join("ledgerline_appdata");
                let _ = std::fs::create_dir_all(&fallback);
                fallback
            });

            // Initialize Logger
            Logger::init(app_data_dir.clone());

            // Initialize workspace manager, fail setup gracefully if it cannot be created
            let workspace_manager = match WorkspaceManager::new(&app_data_dir) {
                Ok(mgr) => mgr,
                Err(e) => {
                    utils::logger::log_info("System", &format!("Failed to initialize workspace manager: {}", e));
                    return Err(e.into());
                }
            };

            let backup_manager = BackupManager::new(&app_data_dir);

            app.manage(AppState {
                workspace_manager: std::sync::Mutex::new(workspace_manager),
                backup_manager,
            });
            app.manage(utils::token_store::SecureTokenStore::new());

            utils::logger::log_info("System", &format!("Cold start time: {:?}", start_time.elapsed()));
            Ok(())
        })
        .on_window_event(|_, event| {
            if let tauri::WindowEvent::Destroyed = event {
                utils::logger::log_info("System", "LedgerLine shutting down.");
            }
        })
        .invoke_handler(tauri::generate_handler![
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
            exchange_rates_get,
            exchange_rates_set,
            currencies_missing_rates_get,
            csv_export,
            pdf_export,
            backup_list,
            backup_create,
            backup_restore_request,
            backup_restore_confirm,
            mrr_log_list,
            mrr_log_count,
            mrr_log_add,
            mrr_log_delete_request,
            mrr_log_delete_confirm
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
