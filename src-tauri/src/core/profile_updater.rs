use crate::config::profile::{create_profile, get_profile_config, get_profile_item, set_profile_config};
use crate::core::manager::{is_core_running, restart_core};
use crate::core::mihomo_api::mihomo_hot_reload_config;
use crate::state::AppState;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tauri::AppHandle;
use tokio::sync::Mutex;
use tokio::task::AbortHandle;

static UPDATERS: OnceLock<Mutex<HashMap<String, AbortHandle>>> = OnceLock::new();

fn updaters_map() -> &'static Mutex<HashMap<String, AbortHandle>> {
    UPDATERS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub async fn init_profile_updater(state: &Arc<AppState>, app_handle: Option<&AppHandle>) {
    let cfg = match get_profile_config(state, false).await {
        Ok(c) => c,
        Err(_) => return,
    };
    let Some(items) = cfg.get("items").and_then(Value::as_array) else {
        return;
    };
    for item in items {
        add_profile_updater(state, app_handle, item).await;
    }
}

/// Auto-update a remote profile in the background without killing the core or self-aborting the updater task.
pub async fn auto_update_profile(
    state: &Arc<AppState>,
    app_handle: Option<&AppHandle>,
    id: &str,
) -> Result<(), String> {
    let latest = match get_profile_item(state, Some(id)).await? {
        Some(it) => it,
        None => return Ok(()),
    };

    let is_remote = latest.get("type").and_then(Value::as_str) == Some("remote");
    let allow_auto = latest
        .get("allowAutoUpdate")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    let auto_update = latest
        .get("autoUpdate")
        .and_then(Value::as_bool)
        .unwrap_or(true);
    if !is_remote || !allow_auto || !auto_update {
        return Ok(());
    }

    // Safely download new subscription content. If remote server is unreachable, keep the existing working profile intact!
    let created = match create_profile(state, app_handle, latest).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[AutoUpdate] Profile '{id}' download failed: {e}. Keeping active profile.");
            return Err(e);
        }
    };

    let is_current = {
        let _guard = state.profile_lock.lock().await;
        let mut cfg = get_profile_config(state, true).await?;
        let mut current_matches = false;

        if let Some(obj) = cfg.as_object_mut() {
            let current = obj
                .get("current")
                .and_then(Value::as_str)
                .map(str::to_string)
                .filter(|s| !s.is_empty());

            let items = obj
                .entry("items")
                .or_insert_with(|| Value::Array(Vec::new()))
                .as_array_mut()
                .ok_or_else(|| "Invalid items list".to_string())?;

            if let Some(pos) = items
                .iter()
                .position(|it| it.get("id").and_then(Value::as_str) == Some(id))
            {
                items[pos] = created.clone();
            } else {
                // Profile was deleted while update was downloading — do not resurrect it
                return Ok(());
            }

            if current.as_deref() == Some(id) {
                current_matches = true;
            }
        }

        set_profile_config(state, app_handle, cfg).await?;
        current_matches
    };

    // If this profile is active and core is running, hot-reload configuration in-memory
    // without killing mihomo.exe, tearing down Wintun, or dropping active connections!
    if is_current && is_core_running(state).await {
        if let Err(e) = mihomo_hot_reload_config(state, app_handle).await {
            eprintln!("[AutoUpdate] Hot-reload failed: {e}, falling back to restart");
            let _ = restart_core(state, app_handle).await;
        }
    }

    Ok(())
}

pub fn add_profile_updater<'a>(
    state: &'a Arc<AppState>,
    app_handle: Option<&'a AppHandle>,
    item: &'a Value,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + 'a>> {
    Box::pin(async move {
        let Some(id) = item.get("id").and_then(Value::as_str).map(str::to_string) else {
            return;
        };
        remove_profile_updater(&id).await;

        let is_remote = item.get("type").and_then(Value::as_str) == Some("remote");
        let interval_mins = item.get("interval").and_then(Value::as_u64).unwrap_or(0);
        let allow_auto = item
            .get("allowAutoUpdate")
            .and_then(Value::as_bool)
            .unwrap_or(true);
        let auto_update = item
            .get("autoUpdate")
            .and_then(Value::as_bool)
            .unwrap_or(true);

        if !is_remote || interval_mins == 0 || !allow_auto || !auto_update {
            return;
        }

        let state_clone = state.clone();
        let app_clone = app_handle.cloned();
        let item_clone = item.clone();
        let id_clone = id.clone();

        let handle = tokio::spawn(async move {
            let mut interval_minutes = interval_mins;
            let mut interval = Duration::from_secs(interval_minutes.saturating_mul(60));
            let updated_ms = item_clone
                .get("updated")
                .and_then(Value::as_i64)
                .unwrap_or(0);
            let now_ms = chrono::Utc::now().timestamp_millis();
            let elapsed_ms = (now_ms - updated_ms).max(0) as u64;
            let interval_ms = interval.as_millis() as u64;

            let initial_delay = if elapsed_ms >= interval_ms {
                Duration::from_secs(30)
            } else {
                Duration::from_millis((interval_ms - elapsed_ms).min(u64::MAX))
            };

            tokio::time::sleep(initial_delay).await;
            loop {
                let _ = auto_update_profile(&state_clone, app_clone.as_ref(), &id_clone).await;

                // Re-read interval in case subscription headers updated the interval
                if let Ok(Some(latest)) = get_profile_item(&state_clone, Some(&id_clone)).await {
                    if let Some(new_mins) = latest.get("interval").and_then(Value::as_u64) {
                        if new_mins > 0 {
                            interval_minutes = new_mins;
                            interval = Duration::from_secs(interval_minutes.saturating_mul(60));
                        }
                    }
                } else {
                    break;
                }

                tokio::time::sleep(interval).await;
            }
        });

        updaters_map()
            .lock()
            .await
            .insert(id, handle.abort_handle());
    })
}

pub async fn remove_profile_updater(id: &str) {
    if let Some(abort) = updaters_map().lock().await.remove(id) {
        abort.abort();
    }
}
