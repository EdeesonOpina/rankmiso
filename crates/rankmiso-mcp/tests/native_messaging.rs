use std::{
    io::{BufRead, BufReader, Write},
    process::{Command, Stdio},
};

use serde_json::{json, Value};

fn frame(value: &Value) -> Vec<u8> {
    let bytes = serde_json::to_vec(value).expect("request JSON");
    let mut framed = (bytes.len() as u32).to_ne_bytes().to_vec();
    framed.extend(bytes);
    framed
}

fn run_native_host(audit_dir: &std::path::Path, request: Value) -> Value {
    let mut child = Command::new(env!("CARGO_BIN_EXE_rankmiso-mcp-native-host"))
        .env("RANKMISO_MCP_AUDIT_DIR", audit_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("native host launches");
    child
        .stdin
        .take()
        .expect("stdin")
        .write_all(&frame(&request))
        .expect("request written");
    let output = child
        .wait_with_output()
        .expect("native host exits after one request");
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    let length = u32::from_ne_bytes(output.stdout[..4].try_into().expect("frame prefix")) as usize;
    assert_eq!(
        output.stdout.len(),
        length + 4,
        "stdout is exactly one native frame"
    );
    serde_json::from_slice(&output.stdout[4..]).expect("JSON response frame")
}

#[test]
fn native_share_is_discovered_by_existing_mcp_tools() {
    let temp = tempfile::tempdir().expect("audit directory");
    let mut audit = seo_rules::analyze(
        &seo_core::PageSnapshot::default(),
        &seo_core::AnalyzeOptions::default(),
    )
    .expect("synthetic audit");
    audit.page.url = "https://mcp-share.example/".to_owned();
    audit.page.title = Some("Synthetic native share".to_owned());
    let response = run_native_host(
        temp.path(),
        json!({"protocolVersion":1,"requestId":"share1","type":"share_audit","audit":audit}),
    );
    assert_eq!(response["ok"], true);
    assert_eq!(
        response["result"]["snapshot"]["pageUrl"],
        "https://mcp-share.example/"
    );

    let mut child = Command::new(env!("CARGO_BIN_EXE_rankmiso-mcp"))
        .args([
            "--audit-dir",
            temp.path().to_str().expect("UTF-8 test path"),
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("existing MCP server launches");
    let mut input = child.stdin.take().expect("MCP stdin");
    let mut output = BufReader::new(child.stdout.take().expect("MCP stdout"));
    writeln!(input, r#"{{"jsonrpc":"2.0","id":1,"method":"initialize","params":{{"protocolVersion":"2025-11-25","capabilities":{{}},"clientInfo":{{"name":"native-host-test","version":"1"}}}}}}"#).expect("initialize");
    let mut line = String::new();
    output.read_line(&mut line).expect("initialize response");
    let init: Value = serde_json::from_str(&line).expect("MCP JSON");
    assert_eq!(init["result"]["serverInfo"]["name"], "rankmiso-mcp");
    writeln!(
        input,
        r#"{{"jsonrpc":"2.0","method":"notifications/initialized"}}"#
    )
    .expect("initialized notification");
    writeln!(input, r#"{{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{{"name":"rankmiso_list_audits","arguments":{{"kind":"audit"}}}}}}"#).expect("audit listing request");
    input.flush().expect("flush");
    line.clear();
    output.read_line(&mut line).expect("list response");
    let list: Value = serde_json::from_str(&line).expect("list JSON");
    let item = &list["result"]["structuredContent"]["items"][0];
    assert_eq!(item["pageUrl"], "https://mcp-share.example/");
    let id = item["id"].as_str().expect("opaque MCP ID");

    writeln!(input, "{}", json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"rankmiso_get_issues","arguments":{"audit_id":id,"limit":5}}})).expect("issues request");
    input.flush().expect("flush");
    line.clear();
    output.read_line(&mut line).expect("issues response");
    let issues: Value = serde_json::from_str(&line).expect("issues JSON");
    assert_eq!(issues["result"]["structuredContent"]["auditId"], id);
    drop(input);
    assert!(child.wait().expect("MCP exits").success());
}

#[test]
fn native_host_rejects_missing_directory_without_stdout() {
    let temp = tempfile::tempdir().expect("temporary root");
    let output = Command::new(env!("CARGO_BIN_EXE_rankmiso-mcp-native-host"))
        .env("RANKMISO_MCP_AUDIT_DIR", temp.path().join("missing"))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .expect("native host launches");
    assert!(!output.status.success());
    assert!(output.stdout.is_empty());
    assert!(String::from_utf8_lossy(&output.stderr).contains("audit directory"));
}
