use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Expose the app data dir to the JS side once at startup so the
            // storage adapter can build absolute paths without async probing.
            let handle = app.handle().clone();
            if let Ok(dir) = handle.path().app_data_dir() {
                let _ = std::fs::create_dir_all(&dir);
                let expr = format!(
                    "window.__APP_DATA_DIR__ = {};",
                    serde_json::to_string(dir.to_string_lossy().as_ref()).unwrap_or_default()
                );
                if let Some(webview) = handle.get_webview_window("main") {
                    let _ = webview.eval(&expr);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
