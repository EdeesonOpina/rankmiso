//! Per-user installation and client setup for the RankMiso local companion.

use std::{
    env,
    ffi::OsString,
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    process::{Command, Output},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

pub const HOST_NAME: &str = "com.misoecosystem.rankmiso";
pub const FIREFOX_EXTENSION_ID: &str = "rankmiso@rankmiso.extension";
// Verified from the published RankMiso Chrome Web Store listing.
pub const CHROME_EXTENSION_ID: &str = "gdklhfalmmahhgimegjlfnhmacimeonl";

const CONFIG_NAME: &str = "native-host.json";
const CLIENT_NAME: &str = "rankmiso";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallPaths {
    pub data_dir: PathBuf,
    pub bin_dir: PathBuf,
    pub audit_dir: PathBuf,
    pub config_dir: PathBuf,
    pub config_file: PathBuf,
}

#[derive(Debug, Deserialize, Serialize)]
struct NativeConfig {
    #[serde(rename = "auditDir")]
    audit_dir: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct HostManifest {
    name: String,
    description: String,
    path: String,
    #[serde(rename = "type")]
    kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    allowed_origins: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    allowed_extensions: Option<Vec<String>>,
}

fn home() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Cannot determine the current user's home directory".to_owned())
}

pub fn install_paths() -> Result<InstallPaths, String> {
    #[cfg(target_os = "windows")]
    let data_base = env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "LOCALAPPDATA is not set".to_owned())?;
    #[cfg(target_os = "macos")]
    let data_base = home()?.join("Library/Application Support");
    #[cfg(target_os = "linux")]
    let data_base = env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or(home()?.join(".local/share"));

    #[cfg(target_os = "windows")]
    let config_base = env::var_os("APPDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "APPDATA is not set".to_owned())?;
    #[cfg(target_os = "macos")]
    let config_base = data_base.clone();
    #[cfg(target_os = "linux")]
    let config_base = env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .unwrap_or(home()?.join(".config"));

    let data_dir = data_base.join("rankmiso-mcp");
    let config_dir = config_base.join("rankmiso-mcp");
    Ok(InstallPaths {
        bin_dir: data_dir.join("bin"),
        audit_dir: data_dir.join("audits"),
        config_file: config_dir.join(CONFIG_NAME),
        data_dir,
        config_dir,
    })
}

fn binary_file_name(name: &str) -> OsString {
    if cfg!(windows) {
        OsString::from(format!("{name}.exe"))
    } else {
        OsString::from(name)
    }
}

fn ensure_private_dir(path: &Path) -> Result<(), String> {
    if path.exists() {
        let metadata =
            fs::symlink_metadata(path).map_err(|_| format!("Cannot inspect {}", path.display()))?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(format!(
                "{} must be a real directory, not a symlink",
                path.display()
            ));
        }
    } else {
        fs::create_dir_all(path)
            .map_err(|error| format!("Cannot create {}: {error}", path.display()))?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Cannot restrict {}: {error}", path.display()))?;
    }
    Ok(())
}

fn verify_config(paths: &InstallPaths) -> Result<(), String> {
    let expected = fs::canonicalize(&paths.audit_dir)
        .map_err(|_| "Cannot resolve the persistent RankMiso audit directory".to_owned())?;
    match fs::symlink_metadata(&paths.config_file) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink()
                || !metadata.is_file()
                || metadata.len() > 16 * 1024
            {
                return Err(format!(
                    "Existing config at {} is not a regular RankMiso config file; it was left unchanged",
                    paths.config_file.display()
                ));
            }
            let current: NativeConfig = serde_json::from_slice(
                &fs::read(&paths.config_file)
                    .map_err(|_| "Cannot read existing RankMiso config")?,
            )
            .map_err(|_| "Existing RankMiso config is invalid; it was left unchanged")?;
            let current_dir = PathBuf::from(current.audit_dir);
            if current_dir != expected {
                return Err(format!(
                    "Existing RankMiso config selects {}. Existing audits were not moved. Back up that folder, then point the config to {} before installing.",
                    current_dir.display(), expected.display()
                ));
            }
            Ok(())
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            let config = NativeConfig {
                audit_dir: expected.to_string_lossy().into_owned(),
            };
            write_private_file(
                &paths.config_file,
                &serde_json::to_vec(&config).map_err(|_| "Cannot encode RankMiso config")?,
                false,
            )
        }
        Err(_) => Err("Cannot inspect RankMiso config".to_owned()),
    }
}

fn write_private_file(path: &Path, bytes: &[u8], replace: bool) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "A file path has no parent".to_owned())?;
    ensure_private_dir(parent)?;
    let tick = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temporary = parent.join(format!(".rankmiso-{}-{tick}.tmp", std::process::id()));
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&temporary).map_err(|error| {
        format!(
            "Cannot create temporary file in {}: {error}",
            parent.display()
        )
    })?;
    if let Err(error) = file.write_all(bytes).and_then(|()| file.sync_all()) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Cannot write {}: {error}", path.display()));
    }
    drop(file);
    if replace && path.exists() {
        let metadata =
            fs::symlink_metadata(path).map_err(|_| format!("Cannot inspect {}", path.display()))?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            let _ = fs::remove_file(&temporary);
            return Err(format!(
                "Refusing to replace non-regular file {}",
                path.display()
            ));
        }
        fs::remove_file(path)
            .map_err(|error| format!("Cannot replace {}: {error}", path.display()))?;
    }
    if let Err(error) = fs::hard_link(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Cannot publish {}: {error}", path.display()));
    }
    fs::remove_file(&temporary)
        .map_err(|error| format!("Cannot clean a temporary file: {error}"))?;
    Ok(())
}

fn replace_binary(source: &Path, destination: &Path) -> Result<(), String> {
    let bytes =
        fs::read(source).map_err(|error| format!("Cannot read {}: {error}", source.display()))?;
    let parent = destination
        .parent()
        .ok_or_else(|| "Binary path has no parent".to_owned())?;
    ensure_private_dir(parent)?;
    let tick = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temporary = parent.join(format!(".rankmiso-bin-{}-{tick}.tmp", std::process::id()));
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o700);
    }
    let mut file = options
        .open(&temporary)
        .map_err(|error| format!("Cannot stage binary in {}: {error}", parent.display()))?;
    if let Err(error) = file.write_all(&bytes).and_then(|()| file.sync_all()) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Cannot stage {}: {error}", destination.display()));
    }
    drop(file);
    match fs::symlink_metadata(destination) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
            let _ = fs::remove_file(&temporary);
            return Err(format!(
                "Refusing to replace non-regular binary {}",
                destination.display()
            ));
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(_) => return Err(format!("Cannot inspect {}", destination.display())),
        Ok(_) => {}
    }
    #[cfg(unix)]
    {
        if let Err(error) = fs::rename(&temporary, destination) {
            let _ = fs::remove_file(&temporary);
            return Err(format!(
                "Cannot atomically install {}: {error}",
                destination.display()
            ));
        }
    }
    #[cfg(windows)]
    {
        let backup = parent.join(format!(".rankmiso-old-{}-{tick}.tmp", std::process::id()));
        let had_destination = destination.exists();
        if had_destination {
            let metadata = fs::symlink_metadata(destination)
                .map_err(|_| format!("Cannot inspect {}", destination.display()))?;
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                let _ = fs::remove_file(&temporary);
                return Err(format!(
                    "Refusing to replace non-regular binary {}",
                    destination.display()
                ));
            }
            fs::rename(destination, &backup).map_err(|error| {
                let _ = fs::remove_file(&temporary);
                format!(
                    "Cannot replace {}. Close RankMiso and AI clients, then retry: {error}",
                    destination.display()
                )
            })?;
        }
        if let Err(error) = fs::rename(&temporary, destination) {
            if had_destination {
                let _ = fs::rename(&backup, destination);
            }
            let _ = fs::remove_file(&temporary);
            return Err(format!("Cannot install {}: {error}", destination.display()));
        }
        if had_destination {
            fs::remove_file(&backup).map_err(|error| {
                format!("Cannot remove old binary {}: {error}", backup.display())
            })?;
        }
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(destination, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Cannot secure {}: {error}", destination.display()))?;
    }
    Ok(())
}

fn archive_dir() -> Result<PathBuf, String> {
    env::current_exe()
        .map_err(|_| "Cannot determine the setup utility path".to_owned())?
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "Setup utility has no containing directory".to_owned())
}

fn host_binary(dir: &Path) -> PathBuf {
    dir.join(binary_file_name("rankmiso-mcp-native-host"))
}

fn mcp_binary(dir: &Path) -> PathBuf {
    dir.join(binary_file_name("rankmiso-mcp"))
}

fn manifest_dirs() -> Result<Vec<(&'static str, PathBuf)>, String> {
    #[cfg(target_os = "windows")]
    {
        Ok(vec![
            ("chrome", PathBuf::new()),
            ("firefox", PathBuf::new()),
        ])
    }
    #[cfg(target_os = "macos")]
    {
        let home = home()?;
        Ok(vec![
            (
                "chrome",
                home.join("Library/Application Support/Google/Chrome/NativeMessagingHosts"),
            ),
            (
                "firefox",
                home.join("Library/Application Support/Mozilla/NativeMessagingHosts"),
            ),
        ])
    }
    #[cfg(target_os = "linux")]
    {
        let home = home()?;
        let chrome_root = env::var_os("CHROME_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| env::var_os("XDG_CONFIG_HOME").map(PathBuf::from))
            .unwrap_or(home.join(".config"));
        Ok(vec![
            (
                "chrome",
                chrome_root.join("google-chrome/NativeMessagingHosts"),
            ),
            ("firefox", home.join(".mozilla/native-messaging-hosts")),
        ])
    }
}

fn host_manifest(browser: &str, host_path: &Path) -> HostManifest {
    HostManifest {
        name: HOST_NAME.to_owned(),
        description: "RankMiso local audit sharing companion".to_owned(),
        path: host_path.to_string_lossy().into_owned(),
        kind: "stdio".to_owned(),
        allowed_origins: (browser == "chrome")
            .then(|| vec![format!("chrome-extension://{CHROME_EXTENSION_ID}/")]),
        allowed_extensions: (browser == "firefox").then(|| vec![FIREFOX_EXTENSION_ID.to_owned()]),
    }
}

fn manifest_file_path(dir: &Path) -> PathBuf {
    dir.join(format!("{HOST_NAME}.json"))
}

#[cfg(windows)]
fn registry_key(browser: &str) -> String {
    let root = if browser == "chrome" {
        r"HKCU\Software\Google\Chrome\NativeMessagingHosts"
    } else {
        r"HKCU\Software\Mozilla\NativeMessagingHosts"
    };
    format!(r"{root}\{HOST_NAME}")
}

#[cfg(windows)]
fn registry_api_subkey(key: &str) -> &str {
    key.strip_prefix("HKCU\\").unwrap_or(key)
}

#[cfg(windows)]
fn registry_default(key: &str) -> Result<Option<String>, String> {
    use std::{
        ffi::{c_void, OsStr},
        os::windows::ffi::OsStrExt,
        ptr,
    };

    type HKey = *mut c_void;
    const ERROR_SUCCESS: i32 = 0;
    const ERROR_FILE_NOT_FOUND: i32 = 2;
    const ERROR_MORE_DATA: i32 = 234;
    const KEY_QUERY_VALUE: u32 = 0x0001;
    const REG_SZ: u32 = 1;
    const HKEY_CURRENT_USER: HKey = (-2_147_483_647isize) as HKey;

    #[link(name = "advapi32")]
    unsafe extern "system" {
        fn RegOpenKeyExW(
            key: HKey,
            sub_key: *const u16,
            options: u32,
            access: u32,
            result: *mut HKey,
        ) -> i32;
        fn RegQueryValueExW(
            key: HKey,
            value_name: *const u16,
            reserved: *mut u32,
            value_type: *mut u32,
            data: *mut u8,
            data_len: *mut u32,
        ) -> i32;
        fn RegCloseKey(key: HKey) -> i32;
    }

    let sub_key: Vec<u16> = OsStr::new(registry_api_subkey(key))
        .encode_wide()
        .chain(Some(0))
        .collect();
    let mut opened = ptr::null_mut();
    // A missing RankMiso key is the only lookup failure interpreted as an
    // empty registration. Access and other errors must fail closed before a
    // later `reg add /f` can replace an unread value.
    let status = unsafe {
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            sub_key.as_ptr(),
            0,
            KEY_QUERY_VALUE,
            &mut opened,
        )
    };
    if status == ERROR_FILE_NOT_FOUND {
        return Ok(None);
    }
    if status != ERROR_SUCCESS {
        return Err(format!(
            "Cannot inspect the current-user browser registry (Windows error {status})"
        ));
    }

    let value = (|| {
        let mut value_type = 0;
        let mut byte_len = 0;
        let status = unsafe {
            RegQueryValueExW(
                opened,
                ptr::null(),
                ptr::null_mut(),
                &mut value_type,
                ptr::null_mut(),
                &mut byte_len,
            )
        };
        if status == ERROR_FILE_NOT_FOUND {
            return Ok(None);
        }
        if status != ERROR_SUCCESS && status != ERROR_MORE_DATA {
            return Err(format!(
                "Cannot read the current-user browser registry (Windows error {status})"
            ));
        }
        if value_type != REG_SZ || byte_len % 2 != 0 {
            return Err("The existing browser registry value is not a REG_SZ path".to_owned());
        }
        let mut data = vec![0u16; (byte_len / 2) as usize];
        let status = unsafe {
            RegQueryValueExW(
                opened,
                ptr::null(),
                ptr::null_mut(),
                &mut value_type,
                data.as_mut_ptr().cast(),
                &mut byte_len,
            )
        };
        if status != ERROR_SUCCESS || value_type != REG_SZ || byte_len % 2 != 0 {
            return Err(format!(
                "Cannot read the current-user browser registry value (Windows error {status})"
            ));
        }
        data.truncate((byte_len / 2) as usize);
        let value = String::from_utf16_lossy(&data);
        Ok(Some(value.trim_end_matches('\0').to_owned()))
    })();
    unsafe {
        RegCloseKey(opened);
    }
    value
}

#[cfg(windows)]
fn register_windows(browser: &str, manifest: &Path) -> Result<(), String> {
    let key = registry_key(browser);
    let manifest = manifest
        .canonicalize()
        .map_err(|_| "Cannot resolve the native host manifest path".to_owned())?;
    if let Some(existing) = registry_default(&key)? {
        if PathBuf::from(existing) != manifest {
            return Err(format!(
                "A different RankMiso registration exists for {browser}; it was left unchanged"
            ));
        }
    }
    let output = Command::new("reg.exe")
        .args([
            "add",
            &key,
            "/ve",
            "/t",
            "REG_SZ",
            "/d",
            manifest.to_string_lossy().as_ref(),
            "/f",
        ])
        .output()
        .map_err(|error| format!("Cannot register RankMiso for {browser}: {error}"))?;
    command_result(output, &format!("Cannot register RankMiso for {browser}"))
}

#[cfg(windows)]
fn unregister_windows(browser: &str, manifest: &Path) -> Result<(), String> {
    let key = registry_key(browser);
    let Some(existing) = registry_default(&key)? else {
        return Ok(());
    };
    let expected = manifest
        .canonicalize()
        .unwrap_or_else(|_| manifest.to_path_buf());
    if PathBuf::from(existing) != expected {
        return Err(format!(
            "The {browser} registry entry points elsewhere; it was left unchanged"
        ));
    }
    let output = Command::new("reg.exe")
        .args(["delete", &key, "/ve", "/f"])
        .output()
        .map_err(|error| format!("Cannot remove RankMiso's {browser} registry value: {error}"))?;
    command_result(
        output,
        &format!("Cannot remove RankMiso's {browser} registry value"),
    )
}

#[cfg(not(windows))]
fn register_windows(_browser: &str, _manifest: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(not(windows))]
fn unregister_windows(_browser: &str, _manifest: &Path) -> Result<(), String> {
    Ok(())
}

fn command_result(output: Output, message: &str) -> Result<(), String> {
    if output.status.success() {
        Ok(())
    } else {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        Err(if detail.is_empty() {
            format!("{message} (exit {})", output.status)
        } else {
            format!("{message}: {detail}")
        })
    }
}

fn write_manifest(browser: &str, path: &Path, host_path: &Path) -> Result<(), String> {
    let manifest = host_manifest(browser, host_path);
    let expected = serde_json::to_vec_pretty(&manifest)
        .map_err(|_| "Cannot encode the native messaging host manifest")?;
    if path.exists() || path.is_symlink() {
        let metadata =
            fs::symlink_metadata(path).map_err(|_| format!("Cannot inspect {}", path.display()))?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(format!(
                "{} is not a regular file; it was left unchanged",
                path.display()
            ));
        }
        let current: HostManifest = serde_json::from_slice(
            &fs::read(path).map_err(|_| format!("Cannot read {}", path.display()))?,
        )
        .map_err(|_| {
            format!(
                "{} is not a valid host manifest; it was left unchanged",
                path.display()
            )
        })?;
        if current.name != HOST_NAME || current.path != manifest.path {
            return Err(format!(
                "A different native messaging host is registered at {}; it was left unchanged",
                path.display()
            ));
        }
        write_private_file(path, &expected, true)?;
    } else {
        write_private_file(path, &expected, false)?;
    }
    Ok(())
}

fn install() -> Result<(), String> {
    let paths = install_paths()?;
    ensure_private_dir(&paths.data_dir)?;
    ensure_private_dir(&paths.bin_dir)?;
    ensure_private_dir(&paths.audit_dir)?;
    ensure_private_dir(&paths.config_dir)?;
    verify_config(&paths)?;

    let source_dir = archive_dir()?;
    let executable =
        env::current_exe().map_err(|_| "Cannot determine the running setup utility".to_owned())?;
    for binary in ["rankmiso-mcp", "rankmiso-mcp-native-host", "rankmiso-setup"] {
        let source = source_dir.join(binary_file_name(binary));
        if !source.is_file() {
            return Err(format!(
                "The installation archive is missing {}",
                source.file_name().unwrap_or_default().to_string_lossy()
            ));
        }
        let destination = paths.bin_dir.join(binary_file_name(binary));
        if binary == "rankmiso-setup" && executable == destination {
            continue;
        }
        replace_binary(&source, &destination)?;
    }
    let host_path = fs::canonicalize(host_binary(&paths.bin_dir))
        .map_err(|_| "Installed native messaging host is missing".to_owned())?;
    for (browser, directory) in manifest_dirs()? {
        if cfg!(windows) {
            let manifest_path = paths.data_dir.join(format!("{HOST_NAME}-{browser}.json"));
            let manifest_dir = manifest_path.parent().unwrap_or(&paths.data_dir);
            ensure_private_dir(manifest_dir)?;
            write_manifest(browser, &manifest_path, &host_path)?;
            register_windows(browser, &manifest_path)?;
        } else {
            ensure_private_dir(&directory)?;
            let manifest_path = manifest_file_path(&directory);
            write_manifest(browser, &manifest_path, &host_path)?;
        }
    }
    validate_install(&paths)?;
    println!("RankMiso companion installed for Chrome and Firefox.");
    println!("MCP server: {}", mcp_binary(&paths.bin_dir).display());
    println!("Private audit folder: {}", paths.audit_dir.display());
    if cfg!(windows) {
        println!("Next: .\\rankmiso-setup.exe configure codex  (or configure claude)");
    } else {
        println!("Next: ./rankmiso-setup configure codex  (or configure claude)");
    }
    println!("Browser Native Messaging permission remains an explicit RankMiso action.");
    Ok(())
}

fn validate_install(paths: &InstallPaths) -> Result<(), String> {
    let output = Command::new(mcp_binary(&paths.bin_dir))
        .arg("--version")
        .output()
        .map_err(|error| format!("Installed MCP binary did not start: {error}"))?;
    command_result(output, "Installed MCP binary did not validate")?;
    let host = host_binary(&paths.bin_dir);
    if !host.is_file() {
        return Err("Installed Native Messaging executable is missing".to_owned());
    }
    let host_check = Command::new(&host)
        .arg("--version")
        .output()
        .map_err(|error| format!("Installed Native Messaging executable did not start: {error}"))?;
    command_result(
        host_check,
        "Installed Native Messaging executable did not validate",
    )?;
    for (browser, directory) in manifest_dirs()? {
        let path = if cfg!(windows) {
            paths.data_dir.join(format!("{HOST_NAME}-{browser}.json"))
        } else {
            manifest_file_path(&directory)
        };
        let current: HostManifest = serde_json::from_slice(
            &fs::read(&path).map_err(|_| format!("Cannot validate {}", path.display()))?,
        )
        .map_err(|_| format!("Invalid host manifest at {}", path.display()))?;
        let expected = host_manifest(
            browser,
            &fs::canonicalize(&host).map_err(|_| "Cannot resolve installed host")?,
        );
        if serde_json::to_value(current).ok() != serde_json::to_value(expected).ok() {
            return Err(format!(
                "Native host manifest validation failed for {browser}"
            ));
        }
    }
    Ok(())
}

fn remove_registration(browser: &str, path: &Path, expected_host: &Path) -> Result<(), String> {
    unregister_windows(browser, path)?;
    #[cfg(not(windows))]
    {
        let expected_host =
            fs::canonicalize(expected_host).unwrap_or_else(|_| expected_host.to_path_buf());
        match fs::symlink_metadata(path) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() || !metadata.is_file() {
                    return Err(format!(
                        "Refusing to remove non-regular manifest {}",
                        path.display()
                    ));
                }
                let current: HostManifest = serde_json::from_slice(
                    &fs::read(path).map_err(|_| format!("Cannot read {}", path.display()))?,
                )
                .map_err(|_| {
                    format!("Invalid manifest {}; it was left in place", path.display())
                })?;
                if current.name != HOST_NAME || Path::new(&current.path) != expected_host {
                    return Err(format!("Manifest {} does not point to this RankMiso installation; it was left in place", path.display()));
                }
                fs::remove_file(path)
                    .map_err(|error| format!("Cannot remove {}: {error}", path.display()))?;
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(_) => return Err(format!("Cannot inspect {}", path.display())),
        }
    }
    Ok(())
}

fn uninstall() -> Result<(), String> {
    let paths = install_paths()?;
    for (browser, directory) in manifest_dirs()? {
        let path = if cfg!(windows) {
            paths.data_dir.join(format!("{HOST_NAME}-{browser}.json"))
        } else {
            manifest_file_path(&directory)
        };
        remove_registration(browser, &path, &host_binary(&paths.bin_dir))?;
        if cfg!(windows) && path.exists() {
            fs::remove_file(&path)
                .map_err(|error| format!("Cannot remove {}: {error}", path.display()))?;
        }
    }
    let executable = env::current_exe().ok();
    for binary in ["rankmiso-mcp", "rankmiso-mcp-native-host", "rankmiso-setup"] {
        let path = paths.bin_dir.join(binary_file_name(binary));
        if executable.as_deref() == Some(path.as_path()) {
            continue;
        }
        match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_file() => {
                return Err(format!(
                    "Refusing to remove non-regular binary {}",
                    path.display()
                ));
            }
            Ok(_) => fs::remove_file(&path)
                .map_err(|error| format!("Cannot remove {}: {error}", path.display()))?,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(_) => return Err(format!("Cannot inspect {}", path.display())),
        }
    }
    println!("RankMiso browser registrations and installed binaries were removed.");
    println!(
        "Audit files and local config remain at {}.",
        paths.data_dir.display()
    );
    println!("Remove the RankMiso entry in Codex/Claude separately if configured.");
    Ok(())
}

fn client_present(output: &str) -> bool {
    output.lines().any(|line| {
        let first = line
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .trim_matches(['*', ':', '`']);
        first == CLIENT_NAME || first.starts_with("rankmiso:")
    })
}

fn configure_client_with(name: &str, paths: &InstallPaths, client: &Path) -> Result<(), String> {
    if !matches!(name, "codex" | "claude") {
        return Err("Choose `codex` or `claude`".to_owned());
    }
    let mcp = fs::canonicalize(mcp_binary(&paths.bin_dir))
        .map_err(|_| "Install the RankMiso companion before configuring an AI client".to_owned())?;
    let audit_dir = fs::canonicalize(&paths.audit_dir).map_err(|_| {
        "The persistent RankMiso audit folder is missing; install the companion first".to_owned()
    })?;
    let listing = Command::new(client)
        .args(["mcp", "list"])
        .output()
        .map_err(|error| format!("Cannot run {name}; install it first: {error}"))?;
    if !listing.status.success() {
        let detail = String::from_utf8_lossy(&listing.stderr).trim().to_owned();
        return Err(if detail.is_empty() {
            format!("Cannot inspect the existing {name} MCP configuration")
        } else {
            format!("Cannot inspect the existing {name} MCP configuration: {detail}")
        });
    }
    let listing_text = format!(
        "{}\n{}",
        String::from_utf8_lossy(&listing.stdout),
        String::from_utf8_lossy(&listing.stderr)
    );
    if client_present(&listing_text) {
        return Err(format!(
            "{name} already has an MCP server named `rankmiso`. It was not changed; inspect it with `{name} mcp list` first."
        ));
    }
    let mut command = Command::new(client);
    if name == "codex" {
        command.args(["mcp", "add", CLIENT_NAME, "--"]);
    } else {
        command.args([
            "mcp",
            "add",
            "--transport",
            "stdio",
            "--scope",
            "user",
            CLIENT_NAME,
            "--",
        ]);
    }
    command
        .arg(mcp.as_os_str())
        .arg("--audit-dir")
        .arg(audit_dir);
    let output = command
        .output()
        .map_err(|error| format!("Cannot configure {name}: {error}"))?;
    command_result(
        output,
        &format!("{name} did not accept the RankMiso MCP configuration"),
    )?;
    println!(
        "RankMiso MCP was added to {name}. Restart the client, then verify with `{name} mcp list`."
    );
    println!("This configures the client; it does not claim that the client has connected.");
    Ok(())
}

fn configure_client(name: &str) -> Result<(), String> {
    let paths = install_paths()?;
    configure_client_with(name, &paths, Path::new(name))
}

pub fn run_cli(mut args: impl Iterator<Item = OsString>) -> Result<(), String> {
    let command = args.next();
    match command.as_ref().and_then(|value| value.to_str()) {
        Some("install") => install(),
        Some("uninstall") => uninstall(),
        Some("configure") => {
            let name = args
                .next()
                .and_then(|value| value.into_string().ok())
                .ok_or_else(|| "Usage: rankmiso-setup configure <codex|claude>".to_owned())?;
            configure_client(&name)
        }
        Some("--version") | Some("-V") => {
            println!("rankmiso-setup {}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        _ => {
            println!(
                "RankMiso MCP Companion\n\nUsage:\n  rankmiso-setup install\n  rankmiso-setup configure <codex|claude>\n  rankmiso-setup uninstall\n\nInstall creates private per-user storage and registers the exact Chrome and Firefox extension identities. Uninstall removes binaries and browser registrations but keeps audit data."
            );
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_paths(root: &Path) -> InstallPaths {
        InstallPaths {
            data_dir: root.join("local data/rankmiso-mcp"),
            bin_dir: root.join("local data/rankmiso-mcp/bin"),
            audit_dir: root.join("local data/rankmiso-mcp/audits"),
            config_dir: root.join("configuration/rankmiso-mcp"),
            config_file: root.join("configuration/rankmiso-mcp/native-host.json"),
        }
    }

    #[test]
    fn production_browser_identities_are_exact_and_non_wildcard() {
        assert_eq!(CHROME_EXTENSION_ID, "gdklhfalmmahhgimegjlfnhmacimeonl");
        assert_eq!(FIREFOX_EXTENSION_ID, "rankmiso@rankmiso.extension");
        let chrome = host_manifest("chrome", Path::new("/opt/rankmiso/host"));
        let firefox = host_manifest("firefox", Path::new("/opt/rankmiso/host"));
        assert_eq!(
            chrome.allowed_origins.unwrap(),
            [format!("chrome-extension://{CHROME_EXTENSION_ID}/")]
        );
        assert_eq!(firefox.allowed_extensions.unwrap(), [FIREFOX_EXTENSION_ID]);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_install_paths_follow_xdg_and_browser_user_directories() {
        let paths = install_paths().unwrap();
        let home = home().unwrap();
        let data = env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or(home.join(".local/share"));
        let config = env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or(home.join(".config"));
        assert_eq!(paths.data_dir, data.join("rankmiso-mcp"));
        assert_eq!(
            paths.config_file,
            config.join("rankmiso-mcp/native-host.json")
        );
        let directories = manifest_dirs().unwrap();
        let chrome_root = env::var_os("CHROME_CONFIG_HOME")
            .map(PathBuf::from)
            .unwrap_or(config);
        assert_eq!(
            directories[0].1,
            chrome_root.join("google-chrome/NativeMessagingHosts")
        );
        assert_eq!(
            directories[1].1,
            home.join(".mozilla/native-messaging-hosts")
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_install_paths_use_per_user_application_support() {
        let paths = install_paths().unwrap();
        let app_support = home().unwrap().join("Library/Application Support");
        assert_eq!(paths.data_dir, app_support.join("rankmiso-mcp"));
        assert_eq!(
            paths.config_file,
            app_support.join("rankmiso-mcp/native-host.json")
        );
        let directories = manifest_dirs().unwrap();
        assert_eq!(
            directories[0].1,
            app_support.join("Google/Chrome/NativeMessagingHosts")
        );
        assert_eq!(
            directories[1].1,
            app_support.join("Mozilla/NativeMessagingHosts")
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_registration_is_per_user_and_browser_specific() {
        assert_eq!(
            registry_key("chrome"),
            r"HKCU\Software\Google\Chrome\NativeMessagingHosts\com.misoecosystem.rankmiso"
        );
        assert_eq!(
            registry_api_subkey(&registry_key("chrome")),
            r"Software\Google\Chrome\NativeMessagingHosts\com.misoecosystem.rankmiso"
        );
        assert_eq!(
            registry_key("firefox"),
            r"HKCU\Software\Mozilla\NativeMessagingHosts\com.misoecosystem.rankmiso"
        );
        let paths = install_paths().unwrap();
        assert!(paths
            .data_dir
            .starts_with(PathBuf::from(env::var_os("LOCALAPPDATA").unwrap())));
        assert!(paths
            .config_file
            .starts_with(PathBuf::from(env::var_os("APPDATA").unwrap())));
    }

    #[test]
    fn browser_registry_lists_only_exact_identities() {
        let chrome = host_manifest("chrome", Path::new("/tmp/host"));
        let value = serde_json::to_value(chrome).unwrap();
        assert_eq!(value["name"], HOST_NAME);
        assert_eq!(value["type"], "stdio");
        assert_eq!(value["allowed_origins"].as_array().unwrap().len(), 1);
        assert!(value["allowed_origins"][0]
            .as_str()
            .unwrap()
            .contains(CHROME_EXTENSION_ID));
        assert!(value.get("allowed_extensions").is_none());
    }

    #[test]
    fn detects_only_the_rankmiso_client_name() {
        assert!(client_present(
            "Name  Transport  Command\nrankmiso stdio /x"
        ));
        assert!(client_present("rankmiso: connected"));
        assert!(!client_present("rankmiso-local stdio /x"));
        assert!(!client_present("other-server stdio /x"));
    }

    #[test]
    fn manifest_install_is_repeatable_and_refuses_a_different_host() {
        let root = tempfile::tempdir().unwrap();
        let path = manifest_file_path(&root.path().join("browser/NativeMessagingHosts"));
        let host = root.path().join("bin/rankmiso-mcp-native-host");
        write_manifest("chrome", &path, &host).unwrap();
        write_manifest("chrome", &path, &host).unwrap();
        let manifest: HostManifest = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(manifest.path, host.to_string_lossy());
        assert!(
            write_manifest("chrome", &path, &root.path().join("another-host"))
                .unwrap_err()
                .contains("different native messaging host")
        );
    }

    #[cfg(unix)]
    #[test]
    fn config_and_audit_directories_are_private_and_config_is_idempotent() {
        use std::os::unix::fs::PermissionsExt;
        let root = tempfile::tempdir().unwrap();
        let paths = test_paths(root.path());
        ensure_private_dir(&paths.data_dir).unwrap();
        ensure_private_dir(&paths.audit_dir).unwrap();
        ensure_private_dir(&paths.config_dir).unwrap();
        verify_config(&paths).unwrap();
        verify_config(&paths).unwrap();
        assert_eq!(
            fs::metadata(&paths.audit_dir).unwrap().permissions().mode() & 0o777,
            0o700
        );
        assert_eq!(
            fs::metadata(&paths.config_file)
                .unwrap()
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
        let config: NativeConfig =
            serde_json::from_slice(&fs::read(paths.config_file).unwrap()).unwrap();
        assert_eq!(
            PathBuf::from(config.audit_dir),
            fs::canonicalize(paths.audit_dir).unwrap()
        );
    }

    #[cfg(unix)]
    #[test]
    fn uninstall_removes_our_registration_and_keeps_audit_files() {
        let root = tempfile::tempdir().unwrap();
        let paths = test_paths(root.path());
        ensure_private_dir(&paths.audit_dir).unwrap();
        let audit = paths.audit_dir.join("rankmiso-shared-existing.json");
        fs::write(&audit, b"keep").unwrap();
        let manifest = manifest_file_path(&root.path().join("firefox"));
        let host = paths.bin_dir.join("rankmiso-mcp-native-host");
        write_manifest("firefox", &manifest, &host).unwrap();

        remove_registration("firefox", &manifest, &host).unwrap();

        assert!(!manifest.exists());
        assert_eq!(fs::read(audit).unwrap(), b"keep");
    }

    #[cfg(unix)]
    #[test]
    fn uninstall_resolves_host_paths_through_a_symlinked_data_home() {
        use std::os::unix::fs::symlink;
        let root = tempfile::tempdir().unwrap();
        let actual_bin = root.path().join("actual/bin");
        fs::create_dir_all(&actual_bin).unwrap();
        let host = actual_bin.join("rankmiso-mcp-native-host");
        fs::write(&host, b"native host").unwrap();
        let alias = root.path().join("data-home");
        symlink(root.path().join("actual"), &alias).unwrap();
        let manifest = manifest_file_path(&root.path().join("firefox"));
        write_manifest("firefox", &manifest, &host.canonicalize().unwrap()).unwrap();

        remove_registration(
            "firefox",
            &manifest,
            &alias.join("bin/rankmiso-mcp-native-host"),
        )
        .unwrap();

        assert!(!manifest.exists());
    }

    #[cfg(unix)]
    #[test]
    fn binary_upgrade_preserves_the_persistent_audit_folder() {
        use std::os::unix::fs::PermissionsExt;
        let root = tempfile::tempdir().unwrap();
        let paths = test_paths(root.path());
        ensure_private_dir(&paths.audit_dir).unwrap();
        let audit = paths.audit_dir.join("rankmiso-shared-existing.json");
        fs::write(&audit, b"keep").unwrap();
        let source = root.path().join("archive/rankmiso-mcp");
        let installed = paths.bin_dir.join("rankmiso-mcp");
        fs::create_dir_all(source.parent().unwrap()).unwrap();
        fs::create_dir_all(installed.parent().unwrap()).unwrap();
        fs::write(&source, b"v2").unwrap();
        fs::write(&installed, b"v1").unwrap();

        replace_binary(&source, &installed).unwrap();

        assert_eq!(fs::read(&installed).unwrap(), b"v2");
        assert_eq!(fs::read(audit).unwrap(), b"keep");
        assert_eq!(
            fs::metadata(installed).unwrap().permissions().mode() & 0o777,
            0o700
        );
    }

    #[cfg(unix)]
    #[test]
    fn client_setup_refuses_existing_name_and_passes_paths_as_separate_arguments() {
        use std::os::unix::fs::PermissionsExt;
        let root = tempfile::tempdir().unwrap();
        let paths = test_paths(root.path());
        ensure_private_dir(&paths.bin_dir).unwrap();
        ensure_private_dir(&paths.audit_dir).unwrap();
        fs::write(mcp_binary(&paths.bin_dir), b"stub").unwrap();

        let existing_file = root.path().join("existing");
        let existing_cli = root.path().join("existing-cli");
        fs::write(
            &existing_cli,
            format!(
                "#!/bin/sh\nif [ \"$2\" = list ]; then echo 'rankmiso stdio'; exit 0; fi\ntouch '{}'\n",
                existing_file.display()
            ),
        )
        .unwrap();
        fs::set_permissions(&existing_cli, fs::Permissions::from_mode(0o700)).unwrap();
        assert!(configure_client_with("codex", &paths, &existing_cli)
            .unwrap_err()
            .contains("already has an MCP server"));
        assert!(!existing_file.exists());

        let args_file = root.path().join("claude-args");
        let fresh_cli = root.path().join("fresh-cli");
        fs::write(
            &fresh_cli,
            format!(
                "#!/bin/sh\nif [ \"$2\" = list ]; then echo 'other-server stdio'; exit 0; fi\nprintf '%s\\n' \"$@\" > '{}'\n",
                args_file.display()
            ),
        )
        .unwrap();
        fs::set_permissions(&fresh_cli, fs::Permissions::from_mode(0o700)).unwrap();
        configure_client_with("claude", &paths, &fresh_cli).unwrap();
        let args = fs::read_to_string(args_file).unwrap();
        let args: Vec<_> = args.lines().collect();
        assert_eq!(
            &args[..8],
            [
                "mcp",
                "add",
                "--transport",
                "stdio",
                "--scope",
                "user",
                "rankmiso",
                "--"
            ]
        );
        assert_eq!(
            args[8],
            fs::canonicalize(mcp_binary(&paths.bin_dir))
                .unwrap()
                .to_string_lossy()
        );
        assert_eq!(args[9], "--audit-dir");
        assert_eq!(
            args[10],
            fs::canonicalize(paths.audit_dir).unwrap().to_string_lossy()
        );
    }

    #[cfg(unix)]
    #[test]
    fn refuses_to_overwrite_symlinked_configuration_directories() {
        use std::os::unix::fs::symlink;
        let root = tempfile::tempdir().unwrap();
        let actual = root.path().join("actual");
        fs::create_dir(&actual).unwrap();
        let link = root.path().join("linked");
        symlink(&actual, &link).unwrap();
        assert!(ensure_private_dir(&link).unwrap_err().contains("symlink"));
    }
}
