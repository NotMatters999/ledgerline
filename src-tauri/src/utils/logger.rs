use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use chrono::Utc;

pub static LOGGER: OnceLock<Mutex<Logger>> = OnceLock::new();

pub struct Logger {
    log_dir: PathBuf,
}

impl Logger {
    pub fn init(app_data_dir: PathBuf) {
        let log_dir = app_data_dir.join("logs");
        let _ = fs::create_dir_all(&log_dir);
        
        let logger = Logger { log_dir };
        let _ = LOGGER.set(Mutex::new(logger));
        
        log_info("System", "Logger initialized. LedgerLine starting up.");
    }

    fn write_log(&self, level: &str, module: &str, message: &str) {
        let now = Utc::now();
        let date_str = now.format("%Y-%m-%d").to_string();
        let log_file_path = self.log_dir.join(format!("{}.log", date_str));
        
        let log_entry = format!(
            r#"{{"timestamp": "{}", "level": "{}", "module": "{}", "message": "{}"}}"#,
            now.to_rfc3339(),
            level,
            module,
            message.replace("\"", "\\\"").replace("\n", "\\n")
        );
        
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_file_path) {
            let _ = writeln!(file, "{}", log_entry);
        }
    }
}

pub fn log_info(module: &str, message: &str) {
    if let Some(logger) = LOGGER.get() {
        if let Ok(logger) = logger.lock() {
            logger.write_log("INFO", module, message);
        }
    }
}

pub fn log_warn(module: &str, message: &str) {
    if let Some(logger) = LOGGER.get() {
        if let Ok(logger) = logger.lock() {
            logger.write_log("WARN", module, message);
        }
    }
}

pub fn log_error(module: &str, message: &str) {
    if let Some(logger) = LOGGER.get() {
        if let Ok(logger) = logger.lock() {
            logger.write_log("ERROR", module, message);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs::read_to_string;

    #[test]
    fn test_structured_logging() {
        let dir = tempdir().unwrap();
        let app_dir = dir.path().to_path_buf();
        
        Logger::init(app_dir.clone());
        
        log_info("TestModule", "This is a test info message");
        log_error("TestModule", "This is an error with \"quotes\"");
        
        let date_str = Utc::now().format("%Y-%m-%d").to_string();
        let log_file = app_dir.join("logs").join(format!("{}.log", date_str));
        
        let contents = read_to_string(log_file).unwrap();
        let lines: Vec<&str> = contents.lines().collect();
        
        // Line 0 is startup, Line 1 is INFO, Line 2 is ERROR
        assert!(lines.len() >= 3);
        assert!(lines[1].contains(r#""level": "INFO""#));
        assert!(lines[1].contains(r#""message": "This is a test info message""#));
        
        assert!(lines[2].contains(r#""level": "ERROR""#));
        assert!(lines[2].contains(r#""message": "This is an error with \"quotes\"""#));
    }
}
