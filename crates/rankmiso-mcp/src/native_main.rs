use std::{env, fs, io, path::PathBuf, process::ExitCode};

use rankmiso_mcp::native_messaging::{self, SharedAuditStore};

#[cfg(windows)]
#[link(name = "msvcrt")]
unsafe extern "C" {
    fn _setmode(fd: i32, mode: i32) -> i32;
}

#[cfg(windows)]
fn set_native_messaging_binary_mode() -> Result<(), String> {
    const O_BINARY: i32 = 0x8000;
    for fd in [0, 1] {
        if unsafe { _setmode(fd, O_BINARY) } == -1 {
            return Err(format!(
                "Cannot set Native Messaging stream {fd} to binary mode"
            ));
        }
    }
    Ok(())
}

fn audit_dir() -> Result<PathBuf, String> {
    if let Some(path) = env::var_os("RANKMISO_MCP_AUDIT_DIR") {
        return Ok(PathBuf::from(path));
    }
    let config_path = env::var_os("RANKMISO_MCP_NATIVE_CONFIG")
        .map(PathBuf::from)
        .or_else(default_config_path)
        .ok_or_else(|| {
            "Set RANKMISO_MCP_AUDIT_DIR or install the RankMiso native-host configuration"
                .to_owned()
        })?;
    let metadata = fs::symlink_metadata(&config_path)
        .map_err(|_| "RankMiso native-host configuration is missing or unreadable")?;
    if !metadata.file_type().is_file()
        || metadata.file_type().is_symlink()
        || metadata.len() > 16 * 1024
    {
        return Err(
            "RankMiso native-host configuration must be a regular file no larger than 16 KiB"
                .to_owned(),
        );
    }
    let canonical = fs::canonicalize(&config_path)
        .map_err(|_| "Cannot resolve RankMiso native-host configuration")?;
    if canonical.parent()
        != config_path
            .parent()
            .and_then(|parent| fs::canonicalize(parent).ok())
            .as_deref()
    {
        return Err(
            "RankMiso native-host configuration is outside its configured directory".to_owned(),
        );
    }
    let config =
        fs::read(&canonical).map_err(|_| "RankMiso native-host configuration is unreadable")?;
    let value: serde_json::Value = serde_json::from_slice(&config)
        .map_err(|_| "RankMiso native-host configuration is invalid JSON")?;
    let path = value
        .get("auditDir")
        .and_then(serde_json::Value::as_str)
        .filter(|path| !path.is_empty())
        .ok_or_else(|| "Native-host configuration must contain an explicit auditDir".to_owned())?;
    Ok(PathBuf::from(path))
}

fn default_config_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let base = env::var_os("APPDATA").map(PathBuf::from)?;
    #[cfg(target_os = "macos")]
    let base = PathBuf::from(env::var_os("HOME")?).join("Library/Application Support");
    #[cfg(target_os = "linux")]
    let base = env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))?;
    Some(base.join("rankmiso-mcp").join("native-host.json"))
}

fn main() -> ExitCode {
    match std::env::args_os().nth(1).as_deref() {
        Some(arg) if arg == "--version" || arg == "-V" => {
            println!("rankmiso-mcp-native-host {}", env!("CARGO_PKG_VERSION"));
            return ExitCode::SUCCESS;
        }
        Some(arg) if arg == "--help" || arg == "-h" => {
            println!("rankmiso-mcp-native-host {}\n\nThis executable is started by Chrome or Firefox using Native Messaging.", env!("CARGO_PKG_VERSION"));
            return ExitCode::SUCCESS;
        }
        Some(_) => {
            eprintln!("rankmiso-mcp-native-host: unexpected command-line argument");
            return ExitCode::FAILURE;
        }
        None => {}
    }
    #[cfg(windows)]
    if let Err(error) = set_native_messaging_binary_mode() {
        eprintln!("rankmiso-mcp-native-host: {error}");
        return ExitCode::FAILURE;
    }
    let path = match audit_dir() {
        Ok(path) => path,
        Err(error) => {
            eprintln!("rankmiso-mcp-native-host: {error}");
            return ExitCode::FAILURE;
        }
    };
    let store = match SharedAuditStore::open(path) {
        Ok(store) => store,
        Err(error) => {
            eprintln!("rankmiso-mcp-native-host: {error}");
            return ExitCode::FAILURE;
        }
    };
    match native_messaging::run(io::stdin().lock(), io::stdout().lock(), &store) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("rankmiso-mcp-native-host: {error}");
            ExitCode::FAILURE
        }
    }
}
