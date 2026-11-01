//! One-request browser Native Messaging bridge. This framing is deliberately
//! separate from the MCP stdio transport.

use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use serde_json::{json, Value};

use crate::{parse_audit, MAX_FILES, MAX_FILE_BYTES, MAX_SCAN_BYTES};

pub const BRIDGE_PROTOCOL_VERSION: u64 = 1;
/// Kept below Chrome's native-host response ceiling and applied symmetrically.
pub const MAX_NATIVE_MESSAGE_BYTES: usize = 900 * 1024;
const MAX_SHARED_AUDITS: usize = 500;
const MAX_SHARED_METADATA_BYTES: usize = 1024;
const DEFAULT_LIST_LIMIT: usize = 50;
const MAX_LIST_LIMIT: usize = 50;
const SHARED_PREFIX: &str = "rankmiso-shared-";
static NEXT_NONCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone)]
pub struct SharedAuditStore {
    root: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SharedAuditSummary {
    snapshot_id: String,
    page_url: String,
    page_title: Option<String>,
    analyzed_at: String,
    shared_at_unix_ms: u128,
    audit_type: &'static str,
}

impl SharedAuditStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
        let root = fs::canonicalize(path.as_ref())
            .map_err(|_| "Configured audit directory does not exist or cannot be accessed")?;
        if !root.is_dir() {
            return Err("Configured audit path is not a directory".to_owned());
        }
        Ok(Self { root })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    fn list(
        &self,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<SharedAuditSummary>, usize), String> {
        if !(1..=MAX_LIST_LIMIT).contains(&limit) || offset > MAX_SHARED_AUDITS {
            return Err(
                "Shared audit page must use a limit from 1 to 50 and an offset no greater than 500"
                    .to_owned(),
            );
        }
        let mut snapshots = Vec::new();
        let mut scanned_bytes = 0u64;
        for item in
            fs::read_dir(&self.root).map_err(|_| "Cannot read configured audit directory")?
        {
            let item = item.map_err(|_| "Cannot inspect configured audit directory")?;
            let name = item.file_name().to_string_lossy().into_owned();
            if !name.starts_with(SHARED_PREFIX) || !name.ends_with(".json") {
                continue;
            }
            if snapshots.len() >= MAX_SHARED_AUDITS {
                return Err("Shared audit directory exceeds the 500-snapshot limit".to_owned());
            }
            let path = item.path();
            let metadata =
                fs::symlink_metadata(&path).map_err(|_| "Cannot inspect shared audit")?;
            if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
                continue;
            }
            scanned_bytes = scanned_bytes.saturating_add(metadata.len());
            if scanned_bytes > MAX_SCAN_BYTES {
                return Err("Shared audit directory exceeds the configured scan limit".to_owned());
            }
            let bytes = read_bounded(&path, &self.root, metadata.len())?;
            let value: Value = match serde_json::from_slice(&bytes) {
                Ok(value) => value,
                Err(_) => continue,
            };
            let Ok(audit) = parse_audit(&value) else {
                continue;
            };
            let shared_at_unix_ms = metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis())
                .unwrap_or_default();
            snapshots.push(SharedAuditSummary {
                snapshot_id: name.trim_end_matches(".json").to_owned(),
                page_url: audit.page.url,
                page_title: audit.page.title,
                analyzed_at: audit.analyzed_at,
                shared_at_unix_ms,
                audit_type: "audit",
            });
        }
        snapshots.sort_by(|left, right| {
            right
                .shared_at_unix_ms
                .cmp(&left.shared_at_unix_ms)
                .then_with(|| left.snapshot_id.cmp(&right.snapshot_id))
        });
        let total = snapshots.len();
        Ok((
            snapshots.into_iter().skip(offset).take(limit).collect(),
            total,
        ))
    }

    fn save(&self, value: &Value) -> Result<SharedAuditSummary, String> {
        let audit = parse_audit(value)?;
        if audit.page.url.len() > MAX_SHARED_METADATA_BYTES
            || audit
                .page
                .title
                .as_ref()
                .is_some_and(|title| title.len() > MAX_SHARED_METADATA_BYTES)
            || audit.analyzed_at.len() > 128
        {
            return Err("Audit page metadata exceeds the supported size limit".to_owned());
        }
        let payload = serde_json::to_vec(value).map_err(|_| "Audit could not be serialized")?;
        if payload.len() > MAX_FILE_BYTES as usize {
            return Err(format!(
                "Audit exceeds the {MAX_FILE_BYTES}-byte storage limit"
            ));
        }
        if payload.len() > MAX_NATIVE_MESSAGE_BYTES.saturating_sub(512) {
            return Err(format!("Audit exceeds the {MAX_NATIVE_MESSAGE_BYTES}-byte Native Messaging limit; use the JSON export instead"));
        }
        // Keep the existing MCP reader's file bound across manual exports and
        // managed snapshots together.
        let mut managed_count = 0usize;
        let mut json_count = 0usize;
        for entry in
            fs::read_dir(&self.root).map_err(|_| "Cannot read configured audit directory")?
        {
            let entry = entry.map_err(|_| "Cannot inspect configured audit directory")?;
            if !entry
                .file_type()
                .map_err(|_| "Cannot inspect an audit entry")?
                .is_file()
                || entry
                    .path()
                    .extension()
                    .is_none_or(|extension| extension != "json")
            {
                continue;
            }
            json_count += 1;
            if entry
                .file_name()
                .to_string_lossy()
                .starts_with(SHARED_PREFIX)
            {
                managed_count += 1;
            }
        }
        if managed_count >= MAX_SHARED_AUDITS || json_count >= MAX_FILES {
            return Err("Shared audit directory is full".to_owned());
        }
        let mut total = payload.len() as u64;
        for entry in
            fs::read_dir(&self.root).map_err(|_| "Cannot read configured audit directory")?
        {
            let entry = entry.map_err(|_| "Cannot inspect configured audit directory")?;
            if entry
                .file_type()
                .map_err(|_| "Cannot inspect an audit entry")?
                .is_file()
            {
                total = total.saturating_add(
                    entry
                        .metadata()
                        .map_err(|_| "Cannot inspect an audit entry")?
                        .len(),
                );
            }
        }
        if total > MAX_SCAN_BYTES {
            return Err("Configured audit directory is at its scan-size limit".to_owned());
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "System clock is before the Unix epoch")?;
        let nonce = NEXT_NONCE.fetch_add(1, Ordering::Relaxed);
        let snapshot_id = format!("{SHARED_PREFIX}{}-{nonce}", now.as_nanos());
        let final_name = format!("{snapshot_id}.json");
        let temp_name = format!(".{snapshot_id}.tmp");
        let temp_path = self.root.join(&temp_name);
        let final_path = self.root.join(&final_name);

        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&temp_path)
            .map_err(|_| "Cannot create a temporary audit snapshot")?;
        let write_result = file.write_all(&payload).and_then(|()| file.sync_all());
        if let Err(error) = write_result {
            drop(file);
            let _ = fs::remove_file(&temp_path);
            return Err(format!("Cannot finish audit snapshot: {error}"));
        }
        drop(file);
        // A hard link publishes a complete file atomically and fails if the
        // destination already exists, avoiding overwrite races on all platforms.
        if let Err(error) = fs::hard_link(&temp_path, &final_path) {
            let _ = fs::remove_file(&temp_path);
            return Err(format!("Cannot publish audit snapshot: {error}"));
        }
        fs::remove_file(&temp_path)
            .map_err(|_| "Audit was saved but its temporary file could not be removed")?;

        let modified = fs::metadata(&final_path)
            .ok()
            .and_then(|meta| meta.modified().ok())
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis())
            .unwrap_or_default();
        Ok(SharedAuditSummary {
            snapshot_id,
            page_url: audit.page.url,
            page_title: audit.page.title,
            analyzed_at: audit.analyzed_at,
            shared_at_unix_ms: modified,
            audit_type: "audit",
        })
    }

    fn remove(&self, snapshot_id: &str) -> Result<(), String> {
        if !valid_snapshot_id(snapshot_id) {
            return Err("Invalid shared audit identifier".to_owned());
        }
        let path = self.root.join(format!("{snapshot_id}.json"));
        let metadata = fs::symlink_metadata(&path).map_err(|_| "Shared audit was not found")?;
        if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
            return Err("Shared audit is not a regular file".to_owned());
        }
        let canonical = fs::canonicalize(&path).map_err(|_| "Cannot resolve shared audit")?;
        if canonical.parent() != Some(self.root.as_path()) {
            return Err("Shared audit is outside the configured directory".to_owned());
        }
        let bytes = read_bounded(&canonical, &self.root, metadata.len())?;
        let value: Value = serde_json::from_slice(&bytes).map_err(|_| "Shared audit is invalid")?;
        parse_audit(&value)?;
        fs::remove_file(canonical).map_err(|_| "Cannot remove shared audit".to_owned())
    }
}

fn read_bounded(path: &Path, root: &Path, size: u64) -> Result<Vec<u8>, String> {
    if size > MAX_FILE_BYTES {
        return Err(format!(
            "Audit exceeds the {MAX_FILE_BYTES}-byte storage limit"
        ));
    }
    let canonical = fs::canonicalize(path).map_err(|_| "Cannot resolve shared audit")?;
    if canonical.parent() != Some(root) {
        return Err("Shared audit is outside the configured directory".to_owned());
    }
    let file = File::open(&canonical).map_err(|_| "Cannot read shared audit")?;
    if !file
        .metadata()
        .map_err(|_| "Cannot inspect shared audit")?
        .is_file()
    {
        return Err("Shared audit is not a regular file".to_owned());
    }
    let mut bytes = Vec::with_capacity(size as usize);
    file.take(MAX_FILE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Cannot read shared audit")?;
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(format!(
            "Audit exceeds the {MAX_FILE_BYTES}-byte storage limit"
        ));
    }
    Ok(bytes)
}

fn valid_snapshot_id(id: &str) -> bool {
    id.starts_with(SHARED_PREFIX)
        && id.len() <= 100
        && id[SHARED_PREFIX.len()..]
            .bytes()
            .all(|byte| byte.is_ascii_digit() || byte == b'-')
}

fn optional_page_number(
    request: &Value,
    key: &str,
    default: usize,
    min: usize,
    max: usize,
) -> Result<usize, String> {
    let Some(value) = request.get(key) else {
        return Ok(default);
    };
    value
        .as_u64()
        .and_then(|number| usize::try_from(number).ok())
        .filter(|number| (min..=max).contains(number))
        .ok_or_else(|| format!("{key} must be an integer from {min} to {max}"))
}

/// Processes exactly one framed request, matching `runtime.sendNativeMessage`.
/// An empty stdin is a clean shutdown; a truncated frame is an error.
pub fn run<R: Read, W: Write>(
    mut input: R,
    mut output: W,
    store: &SharedAuditStore,
) -> io::Result<()> {
    let mut prefix = [0u8; 4];
    match input.read(&mut prefix[..1]) {
        Ok(0) => return Ok(()),
        Ok(1) => input.read_exact(&mut prefix[1..])?,
        Ok(_) => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "Invalid Native Messaging frame prefix",
            ))
        }
        Err(error) => return Err(error),
    }
    let length = u32::from_ne_bytes(prefix) as usize;
    if length == 0 || length > MAX_NATIVE_MESSAGE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Native Messaging frame length is invalid",
        ));
    }
    let mut bytes = vec![0; length];
    input.read_exact(&mut bytes)?;
    let response = match serde_json::from_slice::<Value>(&bytes) {
        Ok(request) => handle_request(store, &request),
        Err(_) => {
            json!({"protocolVersion": BRIDGE_PROTOCOL_VERSION, "requestId": null, "ok": false, "error": "Malformed JSON request"})
        }
    };
    write_frame(&mut output, &response)
}

fn handle_request(store: &SharedAuditStore, request: &Value) -> Value {
    let request_id = request
        .get("requestId")
        .and_then(Value::as_str)
        .filter(|id| {
            !id.is_empty()
                && id.len() <= 64
                && id
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || b"-_".contains(&byte))
        });
    let Some(request_id) = request_id else {
        return failure(Value::Null, "Invalid request identifier");
    };
    if request.get("protocolVersion").and_then(Value::as_u64) != Some(BRIDGE_PROTOCOL_VERSION) {
        return failure(
            json!(request_id),
            "Unsupported Native Messaging protocol version",
        );
    }
    let result = match request.get("type").and_then(Value::as_str) {
        Some("ping") => Ok(json!({"status": "ready"})),
        Some("share_audit") => request
            .get("audit")
            .ok_or_else(|| "Audit payload is required".to_owned())
            .and_then(|audit| {
                store
                    .save(audit)
                    .map(|summary| json!({"snapshot": summary}))
            }),
        Some("list_shared_audits") => {
            let offset = optional_page_number(request, "offset", 0, 0, MAX_SHARED_AUDITS);
            let limit =
                optional_page_number(request, "limit", DEFAULT_LIST_LIMIT, 1, MAX_LIST_LIMIT);
            match (offset, limit) {
                (Ok(offset), Ok(limit)) => store.list(offset, limit).map(|(snapshots, total)| {
                    let next_offset = (offset + snapshots.len() < total).then_some(offset + snapshots.len());
                    json!({"snapshots": snapshots, "total": total, "offset": offset, "limit": limit, "nextOffset": next_offset})
                }),
                (Err(error), _) | (_, Err(error)) => Err(error),
            }
        }
        Some("remove_shared_audit") => request
            .get("snapshotId")
            .and_then(Value::as_str)
            .ok_or_else(|| "Snapshot identifier is required".to_owned())
            .and_then(|id| store.remove(id).map(|()| json!({"removed": true}))),
        _ => Err("Unsupported Native Messaging command".to_owned()),
    };
    match result {
        Ok(result) => {
            json!({"protocolVersion": BRIDGE_PROTOCOL_VERSION, "requestId": request_id, "ok": true, "result": result})
        }
        Err(error) => failure(json!(request_id), &error),
    }
}

fn failure(request_id: Value, error: &str) -> Value {
    json!({"protocolVersion": BRIDGE_PROTOCOL_VERSION, "requestId": request_id, "ok": false, "error": error})
}

fn write_frame<W: Write>(output: &mut W, value: &Value) -> io::Result<()> {
    let bytes = serde_json::to_vec(value).map_err(io::Error::other)?;
    if bytes.len() > MAX_NATIVE_MESSAGE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Native Messaging response exceeds the message limit",
        ));
    }
    let length = u32::try_from(bytes.len()).map_err(|_| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "Native Messaging response is too large",
        )
    })?;
    output.write_all(&length.to_ne_bytes())?;
    output.write_all(&bytes)?;
    output.flush()
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> Value {
        let mut audit = seo_rules::analyze(
            &seo_core::PageSnapshot::default(),
            &seo_core::AnalyzeOptions::default(),
        )
        .expect("synthetic audit");
        audit.page.url = "https://example.test/".to_owned();
        serde_json::to_value(audit).expect("serializable audit")
    }

    fn frame(value: &Value) -> Vec<u8> {
        let bytes = serde_json::to_vec(value).expect("serialized request");
        let mut frame = (bytes.len() as u32).to_ne_bytes().to_vec();
        frame.extend(bytes);
        frame
    }

    fn invoke(store: &SharedAuditStore, request: Value) -> Value {
        let mut output = Vec::new();
        run(frame(&request).as_slice(), &mut output, store).expect("valid frame");
        let length = u32::from_ne_bytes(output[..4].try_into().expect("prefix")) as usize;
        serde_json::from_slice(&output[4..4 + length]).expect("valid response")
    }

    #[test]
    fn framed_ping_and_mcp_discovery_share_the_same_directory() {
        let temp = tempfile::tempdir().expect("temporary directory");
        let store = SharedAuditStore::open(temp.path()).expect("store opens");
        let response = invoke(
            &store,
            json!({"protocolVersion": 1, "requestId": "r1", "type": "ping"}),
        );
        assert_eq!(response["result"]["status"], "ready");
        let snapshot = invoke(
            &store,
            json!({"protocolVersion": 1, "requestId": "r2", "type": "share_audit", "audit": fixture()}),
        );
        let snapshot_id = snapshot["result"]["snapshot"]["snapshotId"]
            .as_str()
            .expect("snapshot id");
        let id = crate::make_id(&format!("{snapshot_id}.json"));
        let mcp = crate::AuditStore::open(temp.path()).expect("MCP store");
        assert_eq!(
            mcp.entries().expect("list")[0].page_url.as_deref(),
            Some("https://example.test/")
        );
        assert_eq!(
            mcp.audit(&id).expect("audit").page.url,
            "https://example.test/"
        );
    }

    #[test]
    fn invalid_schema_and_protocol_are_rejected_without_writing() {
        let temp = tempfile::tempdir().expect("temporary directory");
        let store = SharedAuditStore::open(temp.path()).expect("store opens");
        let response = invoke(
            &store,
            json!({"protocolVersion": 99, "requestId": "r1", "type": "ping"}),
        );
        assert_eq!(response["ok"], false);
        let response = invoke(
            &store,
            json!({"protocolVersion": 1, "requestId": "r2", "type": "share_audit", "audit": {"schemaVersion": 3}}),
        );
        assert_eq!(response["ok"], false);
        assert_eq!(
            fs::read_dir(temp.path()).expect("read directory").count(),
            0
        );
    }

    #[test]
    fn can_list_remove_and_reject_traversal_ids() {
        let temp = tempfile::tempdir().expect("temporary directory");
        let store = SharedAuditStore::open(temp.path()).expect("store opens");
        let saved = invoke(
            &store,
            json!({"protocolVersion": 1, "requestId": "r1", "type": "share_audit", "audit": fixture()}),
        );
        let id = saved["result"]["snapshot"]["snapshotId"]
            .as_str()
            .expect("snapshot id")
            .to_owned();
        let second = store.save(&fixture()).expect("second snapshot is saved");
        assert_ne!(id, second.snapshot_id);
        let listing = invoke(
            &store,
            json!({"protocolVersion": 1, "requestId": "r2", "type": "list_shared_audits"}),
        );
        assert_eq!(
            listing["result"]["snapshots"]
                .as_array()
                .expect("snapshots")
                .len(),
            2
        );
        let traversal = invoke(
            &store,
            json!({"protocolVersion": 1, "requestId": "r3", "type": "remove_shared_audit", "snapshotId": "rankmiso-shared-../../audit"}),
        );
        assert_eq!(traversal["ok"], false);
        let removed = invoke(
            &store,
            json!({"protocolVersion": 1, "requestId": "r4", "type": "remove_shared_audit", "snapshotId": id}),
        );
        assert_eq!(removed["result"]["removed"], true);
        let remaining = store.list(0, 50).expect("list").0;
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].snapshot_id, second.snapshot_id);
    }

    #[test]
    fn rejects_oversized_exports_and_never_lists_incomplete_temp_files() {
        let temp = tempfile::tempdir().expect("temporary directory");
        let store = SharedAuditStore::open(temp.path()).expect("store opens");
        let mut audit = fixture();
        audit["unmeasuredExtra"] = Value::String("x".repeat(MAX_NATIVE_MESSAGE_BYTES));
        assert!(store
            .save(&audit)
            .expect_err("oversized audit rejected")
            .contains("Native Messaging limit"));
        fs::write(
            temp.path().join(".rankmiso-shared-interrupted.tmp"),
            serde_json::to_vec(&fixture()).expect("audit JSON"),
        )
        .expect("partial staging file");
        assert_eq!(store.list(0, 50).expect("list").0.len(), 0);
        assert_eq!(fs::read_dir(temp.path()).expect("directory").count(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn managed_listing_and_removal_reject_symlink_entries() {
        let temp = tempfile::tempdir().expect("temporary directory");
        let outside = tempfile::tempdir().expect("outside directory");
        let store = SharedAuditStore::open(temp.path()).expect("store opens");
        let saved = store.save(&fixture()).expect("audit saved");
        let managed = temp.path().join(format!("{}.json", saved.snapshot_id));
        let external = outside.path().join("external.json");
        fs::write(
            &external,
            serde_json::to_vec(&fixture()).expect("audit JSON"),
        )
        .expect("external audit");
        fs::remove_file(&managed).expect("managed file removed for symlink fixture");
        std::os::unix::fs::symlink(&external, &managed).expect("symlink fixture");
        assert_eq!(store.list(0, 50).expect("list").0.len(), 0);
        assert!(store.remove(&saved.snapshot_id).is_err());
        assert!(external.exists());
    }

    #[test]
    fn handles_clean_eof_truncation_and_bad_json() {
        let temp = tempfile::tempdir().expect("temporary directory");
        let store = SharedAuditStore::open(temp.path()).expect("store opens");
        assert!(run(&[][..], Vec::new(), &store).is_ok());
        assert!(run(&[1, 2][..], Vec::new(), &store).is_err());
        let mut output = Vec::new();
        let invalid = [1u32.to_ne_bytes().as_slice(), b"{"].concat();
        run(invalid.as_slice(), &mut output, &store).expect("malformed JSON gets response");
        let response: Value = serde_json::from_slice(&output[4..]).expect("response");
        assert_eq!(response["ok"], false);
    }
}
