use std::{
    io::{BufRead, BufReader, Write},
    process::{Command, Stdio},
};

#[test]
fn stdio_initializes_lists_tools_and_exits_without_non_protocol_stdout() {
    let dir = tempfile::tempdir().unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_rankmiso-mcp"))
        .args(["--audit-dir", dir.path().to_str().unwrap()])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let mut input = child.stdin.take().unwrap();
    let mut output = BufReader::new(child.stdout.take().unwrap());
    writeln!(input, r#"{{"jsonrpc":"2.0","id":1,"method":"initialize","params":{{"protocolVersion":"2025-11-25","capabilities":{{}},"clientInfo":{{"name":"protocol-test","version":"1"}}}}}}"#).unwrap();
    input.flush().unwrap();
    let mut line = String::new();
    output.read_line(&mut line).unwrap();
    let init: serde_json::Value =
        serde_json::from_str(&line).expect("stdout begins with MCP JSON-RPC");
    assert_eq!(init["id"], 1);
    assert_eq!(init["result"]["serverInfo"]["name"], "rankmiso-mcp");

    writeln!(
        input,
        r#"{{"jsonrpc":"2.0","method":"notifications/initialized"}}"#
    )
    .unwrap();
    writeln!(
        input,
        r#"{{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{{}}}}"#
    )
    .unwrap();
    input.flush().unwrap();
    line.clear();
    output.read_line(&mut line).unwrap();
    let tools: serde_json::Value = serde_json::from_str(&line).expect("tool discovery is JSON-RPC");
    let names: Vec<_> = tools["result"]["tools"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|tool| tool["name"].as_str())
        .collect();
    for tool in tools["result"]["tools"].as_array().unwrap() {
        assert_eq!(tool["inputSchema"]["type"], "object");
        assert_eq!(tool["outputSchema"]["type"], "object");
        assert_eq!(tool["annotations"]["readOnlyHint"], true);
        assert_eq!(tool["annotations"]["destructiveHint"], false);
    }
    assert_eq!(
        names,
        [
            "rankmiso_compare_audits",
            "rankmiso_get_audit",
            "rankmiso_get_crawl_results",
            "rankmiso_get_issues",
            "rankmiso_list_audits",
        ]
    );
    writeln!(input, r#"{{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{{"name":"rankmiso_list_audits","arguments":{{"limit":10}}}}}}"#).unwrap();
    input.flush().unwrap();
    line.clear();
    output.read_line(&mut line).unwrap();
    let empty: serde_json::Value = serde_json::from_str(&line).unwrap();
    assert_eq!(empty["result"]["structuredContent"]["total"], 0);
    assert!(empty["result"]["structuredContent"]["items"]
        .as_array()
        .unwrap()
        .is_empty());

    writeln!(input, r#"{{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{{"name":"rankmiso_get_audit","arguments":{{"audit_id":"../../etc/passwd"}}}}}}"#).unwrap();
    input.flush().unwrap();
    line.clear();
    output.read_line(&mut line).unwrap();
    let invalid: serde_json::Value = serde_json::from_str(&line).unwrap();
    assert_eq!(invalid["result"]["isError"], true);
    drop(input);
    assert!(child.wait().unwrap().success());
}

#[test]
fn stdio_disconnect_before_initialize_exits_cleanly() {
    let dir = tempfile::tempdir().unwrap();
    let output = Command::new(env!("CARGO_BIN_EXE_rankmiso-mcp"))
        .args(["--audit-dir", dir.path().to_str().unwrap()])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .unwrap();
    assert!(output.status.success());
    assert!(output.stdout.is_empty());
}

#[test]
fn stdio_discovery_lifecycle_lists_and_calls_tools() {
    let dir = tempfile::tempdir().unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_rankmiso-mcp"))
        .args(["--audit-dir", dir.path().to_str().unwrap()])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    let mut input = child.stdin.take().unwrap();
    let mut output = BufReader::new(child.stdout.take().unwrap());
    let meta = serde_json::json!({
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {"name":"protocol-test","version":"1"}
    });

    writeln!(
        input,
        "{}",
        serde_json::json!({
            "jsonrpc":"2.0", "id":1, "method":"server/discover", "params":{"_meta":meta}
        })
    )
    .unwrap();
    input.flush().unwrap();
    let mut line = String::new();
    output.read_line(&mut line).unwrap();
    let discovery: serde_json::Value = serde_json::from_str(&line).unwrap();
    assert_eq!(discovery["id"], 1);
    assert!(discovery["result"]["supportedVersions"]
        .as_array()
        .unwrap()
        .iter()
        .any(|version| version == "2026-07-28"));

    writeln!(
        input,
        "{}",
        serde_json::json!({
            "jsonrpc":"2.0", "id":2, "method":"tools/list", "params":{"_meta":meta}
        })
    )
    .unwrap();
    input.flush().unwrap();
    line.clear();
    output.read_line(&mut line).unwrap();
    let tools: serde_json::Value = serde_json::from_str(&line).unwrap();
    assert_eq!(tools["id"], 2);
    assert_eq!(tools["result"]["tools"].as_array().unwrap().len(), 5);

    writeln!(
        input,
        "{}",
        serde_json::json!({
            "jsonrpc":"2.0", "id":3, "method":"tools/call", "params":{
                "name":"rankmiso_list_audits", "arguments":{"limit":10}, "_meta":meta
            }
        })
    )
    .unwrap();
    input.flush().unwrap();
    line.clear();
    output.read_line(&mut line).unwrap();
    let result: serde_json::Value = serde_json::from_str(&line).unwrap();
    assert_eq!(result["result"]["structuredContent"]["total"], 0);
    drop(input);
    assert!(child.wait().unwrap().success());
}
