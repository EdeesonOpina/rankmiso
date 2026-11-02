# RankMiso plugins for Claude Code and Codex

The RankMiso plugin connects Claude Code or Codex to SEO audits you share from the RankMiso browser extension. It is a thin layer over the existing Rust MCP companion. It adds no server, account, telemetry, or network service.

- [Claude Code](claude-code.md)
- [Codex](codex.md)

## What the plugin contains

| Path | Purpose |
| --- | --- |
| `plugins/rankmiso/bin/rankmiso` | POSIX `sh` launcher. `mcp` starts the installed companion, `status` checks the setup, `connect` installs or repairs it. |
| `plugins/rankmiso/.mcp.json` | Claude Code MCP entry: `sh ${CLAUDE_PLUGIN_ROOT}/bin/rankmiso mcp`. |
| `plugins/rankmiso/mcp.json` | Codex MCP entry: `sh ./bin/rankmiso mcp`, run from the plugin folder. |
| `plugins/rankmiso/skills/` | `connect`, `troubleshoot`, `analyze-audit`, `fix-seo`. |
| `.claude-plugin/marketplace.json` | Claude Code marketplace catalog. |
| `.agents/plugins/marketplace.json` | Codex marketplace catalog. |

Plugin version: 0.1.0. It is versioned separately from the extension and the companion.

## One-time setup

Ask the assistant to **Connect RankMiso**. In Claude Code you can also run `/rankmiso:connect`. The assistant runs `rankmiso status`. If the companion is missing, it shows you the plan and asks for approval. After you approve, it runs `rankmiso connect --yes`, which:

1. Downloads `rankmiso-mcp-companion-v0.5.1-<platform>.tar.gz` from the RankMiso GitHub release over HTTPS.
2. Checks it against a SHA-256 value pinned in the plugin. A mismatch deletes the file and stops.
3. Checks that the archive holds exactly the five release files as regular files. Paths, links, and extra files are refused.
4. Runs the archive's own `rankmiso-setup install`. That installer copies the binaries atomically into your user folder, creates the private audit folder, registers the browser host for the exact Chrome ID `gdklhfalmmahhgimegjlfnhmacimeonl` and Firefox ID `rankmiso@rankmiso.extension`, and validates the result.
5. Prints a status report.

No administrator rights are used. No Claude or Codex config file is edited, because the plugin's own MCP entry runs the launcher. Setup never shares an audit. You still choose Share with AI in the extension.

If a current compatible companion is already installed, it is reused. Nothing is downloaded or overwritten, and saved audits are kept. A missing or wrong browser registration is repaired with the installed companion. A companion with an unsupported version, an audit folder configured elsewhere, or a host registration that points at another program is left unchanged and reported.

## Status report

`rankmiso status` checks the companion binaries and version, the audit folder config, a real MCP `initialize` and `tools/list`, the exact Chrome and Firefox host manifests, and the number of shared audits. Example:

```text
RankMiso Integration

Plugin: rankmiso 0.1.0 (companion release v0.5.1)
Platform: linux-x86_64
MCP Companion: Installed (rankmiso-mcp 0.1.1) at ~/.local/share/rankmiso-mcp/bin
Audit folder: ~/.local/share/rankmiso-mcp/audits
MCP Server: Ready (5 read-only tools)
Chrome: Registered
Firefox: Registered
Shared Audit: None yet. Open RankMiso in your browser, audit a page, and choose Share with AI.

Status: READY
```

"None yet" is not a failure. It means no audit has been shared.

## Companion versions

The plugin installs companion **v0.5.1** (binaries report 0.1.1). The v0.5.0 native host exited whenever a browser started it, because Chrome and Firefox always pass launch arguments, so browser sharing failed with "Connection Failed". v0.5.1 accepts exactly the browser launch arguments.

If an earlier companion is installed, `rankmiso status` reports `Browser sharing: Blocked`, and **Connect RankMiso** offers the upgrade. After approval, the new archive is downloaded and verified first. The release installer then replaces the binaries. If it fails, the launcher restores the previous binaries. Audits, config, and browser registrations are kept.

To pin a later release, update `RELEASE`, the three SHA-256 values, and `PINNED_PATCH` in `bin/rankmiso`, checked against the GitHub asset digests and an independent download.

## Supported platforms

| Platform | Plugin setup | Notes |
| --- | --- | --- |
| Linux x86_64 | Verified: clean install and v0.5.0 → v0.5.1 upgrade from the published archives, Claude Code 2.1.316, Codex 0.166.0, and Google Chrome 156 sharing with the Chrome Web Store extension 0.5.0 | Google Chrome and `~/.mozilla` Firefox are registered. Snap Firefox isolates native hosts and is not verified. Chromium, Brave, and Edge are not registered by this release. |
| macOS Apple Silicon, macOS Intel | Implemented, not run on a Mac | Pinned v0.5.1 archives passed native CI. Binaries are not notarized. Files downloaded with `curl` are not quarantined, but this has not been checked on a Mac. |
| Windows x86_64 | Not supported by the plugin | The launcher needs `sh`. Use the Windows package and `docs/mcp/INSTALL.md`. |
| Linux ARM64, Windows ARM64 | Not supported | No companion build exists. The launcher says so. |

## Updates and removal

- Plugin updates come from the marketplace (`claude plugin update rankmiso@rankmiso`, `codex plugin marketplace upgrade`). The companion is updated only through `connect`, with approval.
- Removing the plugin from one client removes only that client's plugin. The companion is shared by Claude Code, Codex, any manual MCP setup, and both browsers, so it stays installed.
- To remove the companion as well, ask the assistant, or run `rankmiso uninstall` to see what will be removed and `rankmiso uninstall --yes` to do it. Audit files are kept.

## Manual installation

Manual installation is still supported. See [docs/mcp/INSTALL.md](../mcp/INSTALL.md). A manual install is detected and reused by the plugin. If you also added a server named `rankmiso` with `claude mcp add` or `codex mcp add`, both work, but the tools appear twice. You can remove the manual entry.

## Testing

- `node scripts/plugin/chrome-acceptance.mjs <home> <extension-dir> <public-key>`: real Google Chrome share through the plugin-installed companion, using the store build under its production ID. Run it from the repository root after `rankmiso connect --yes` in that HOME.
- `python3 scripts/plugin/test_plugin.py`: manifests and skills, the no-change plan, unsupported platforms, offline download, checksum mismatch, path traversal, absolute paths, symlinks and extra archive files, fresh install, repeat install and reuse, repair without download, wrong extension ID, foreign registration left unchanged, incompatible companion, v0.5.0 host upgrade, verified upgrade with rollback on failure, permission denied, uninstall keeping audits, and a shared audit read through the plugin's MCP entry. Run `cargo build -p rankmiso-mcp --bins` first.
- `claude plugin validate .` and `claude plugin validate plugins/rankmiso --strict`.
