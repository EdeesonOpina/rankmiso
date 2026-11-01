use std::process::ExitCode;

use rankmiso_mcp::installer;

fn main() -> ExitCode {
    match installer::run_cli(std::env::args_os().skip(1)) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("rankmiso-setup: {error}");
            ExitCode::FAILURE
        }
    }
}
