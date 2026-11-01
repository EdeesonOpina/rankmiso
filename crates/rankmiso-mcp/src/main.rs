use std::{env, ffi::OsStr, path::PathBuf, process::ExitCode};

use rankmiso_mcp::{AuditStore, RankMisoServer};
use rmcp::ServiceExt;

fn audit_dir() -> Result<Option<PathBuf>, String> {
    let mut args = env::args_os().skip(1);
    match args.next() {
        Some(arg) if arg == OsStr::new("--help") || arg == OsStr::new("-h") => {
            println!("rankmiso-mcp {}\n\nUsage: rankmiso-mcp --audit-dir <directory>\n\nReads RankMiso JSON exports from one explicitly configured directory.\nAlternatively set RANKMISO_MCP_AUDIT_DIR. No default directory is used.\n", env!("CARGO_PKG_VERSION"));
            Ok(None)
        }
        Some(arg) if arg == OsStr::new("--version") || arg == OsStr::new("-V") => {
            println!("rankmiso-mcp {}", env!("CARGO_PKG_VERSION"));
            Ok(None)
        }
        Some(arg) if arg == OsStr::new("--audit-dir") => {
            let path = args
                .next()
                .ok_or_else(|| "--audit-dir requires a directory".to_owned())?;
            if args.next().is_some() {
                return Err("Unexpected additional argument".to_owned());
            }
            Ok(Some(PathBuf::from(path)))
        }
        Some(other) => Err(format!(
            "Unknown argument: {}. Use --help for usage.",
            other.to_string_lossy()
        )),
        None => env::var_os("RANKMISO_MCP_AUDIT_DIR")
            .map(PathBuf::from)
            .map(Some)
            .ok_or_else(|| {
                "Set --audit-dir or RANKMISO_MCP_AUDIT_DIR; no default directory is used".to_owned()
            }),
    }
}

#[tokio::main]
async fn main() -> ExitCode {
    let path = match audit_dir() {
        Ok(Some(path)) => path,
        Ok(None) => return ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("rankmiso-mcp: {error}");
            return ExitCode::FAILURE;
        }
    };
    let store = match AuditStore::open(path) {
        Ok(store) => store,
        Err(error) => {
            eprintln!("rankmiso-mcp: {error}");
            return ExitCode::FAILURE;
        }
    };
    match RankMisoServer::new(store)
        .serve(rmcp::transport::stdio())
        .await
    {
        Ok(service) => match service.waiting().await {
            Ok(rmcp::service::QuitReason::Closed | rmcp::service::QuitReason::Cancelled) => {
                ExitCode::SUCCESS
            }
            Ok(rmcp::service::QuitReason::JoinError(error)) => {
                eprintln!("rankmiso-mcp: MCP session task failed: {error}");
                ExitCode::FAILURE
            }
            Ok(_) => ExitCode::SUCCESS,
            Err(error) => {
                eprintln!("rankmiso-mcp: MCP session ended with an error: {error}");
                ExitCode::FAILURE
            }
        },
        Err(rmcp::service::ServerInitializeError::ConnectionClosed(_)) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("rankmiso-mcp: could not start MCP stdio transport: {error}");
            ExitCode::FAILURE
        }
    }
}
