# RankMiso MCP Companion installation

The companion shares approved schema-v1 audits with the existing read-only MCP server. It runs locally; no account, service, daemon, or network access is installed.

## Install

No public companion download is available yet. Pull requests targeting `develop` run the **MCP companion artifacts** native build and installer checks on Linux, Windows, and both macOS architectures. Their archives are temporary GitHub Actions artifacts for review; they are not releases. A maintainer can also run the workflow manually to build preview artifacts. Manual dispatch appears only after the workflow is present on the repository's default branch (`master`); select the desired source branch for the run. Neither trigger publishes a release. Once an archive is provided, verify its SHA-256 sidecar, extract it, open a terminal in the extracted folder, and run:

| System | Command |
| --- | --- |
| Windows x86_64 | `.\rankmiso-setup.exe install` |
| macOS Apple Silicon or Intel | `./rankmiso-setup install` |
| Linux x86_64 | `./rankmiso-setup install` |

The installer is per-user and requires no administrator privileges. It installs the MCP server, Native Messaging host and setup utility, registers the exact RankMiso identities with Chrome and Firefox, and creates private local audit storage. It does not grant the extension's optional Native Messaging permission. Open RankMiso → **AI** and enable local sharing to grant that permission.

The public Chrome extension ID is `gdklhfalmmahhgimegjlfnhmacimeonl`; Firefox uses `rankmiso@rankmiso.extension`. No wildcard authorization is used.

## Configure an AI client

Install Codex CLI or Claude Code first. Then run one command from the extracted companion folder (or the installed companion's `bin` directory):

```sh
./rankmiso-setup configure codex
./rankmiso-setup configure claude
```

On Windows, run `.\rankmiso-setup.exe configure codex` or `.\rankmiso-setup.exe configure claude` from the installed `bin` directory. The setup utility checks for an existing `rankmiso` MCP entry and leaves it unchanged. It uses the client's supported CLI to add only the RankMiso server. Restart the client, then check `codex mcp list` or `claude mcp get rankmiso` / `claude mcp list`.

If setup reports that `rankmiso` already exists, inspect it before changing it. To configure manually, use the installed paths printed by the setup utility:

```sh
codex mcp add rankmiso -- /absolute/path/to/rankmiso-mcp --audit-dir /absolute/path/to/audits
claude mcp add --transport stdio --scope user rankmiso -- /absolute/path/to/rankmiso-mcp --audit-dir /absolute/path/to/audits
```

Client configuration means the client has an entry. It does not prove the client connected. Verify client status inside its own CLI. Browser **Connected** reports only the local Native Messaging companion.

## Local storage and privacy

Audit files remain on this device in the operating system's per-user application data directory:

- Windows: `%LOCALAPPDATA%\rankmiso-mcp\audits`
- macOS: `~/Library/Application Support/rankmiso-mcp/audits`
- Linux: `$XDG_DATA_HOME/rankmiso-mcp/audits` or `~/.local/share/rankmiso-mcp/audits`

Configuration is stored under the matching per-user application configuration directory. Linux directories are mode `0700` and files are mode `0600`; Windows uses the current user's application-data ACL. RankMiso does not enable synchronization or copy development snapshots into this location. The MCP client can send retrieved audit content to its configured model provider; that processing is controlled by the AI client.

## Upgrade and uninstall

Run `rankmiso-setup install` from the newly downloaded and extracted archive to upgrade. Close Codex/Claude and retry if Windows reports that an executable is in use. Existing audit files are not migrated, replaced, or removed.

Run `rankmiso-setup uninstall` from the extracted archive to remove the installed executables and browser registrations. Audit files and local configuration are deliberately preserved. Remove the MCP entry separately with `codex mcp remove rankmiso` or `claude mcp remove rankmiso`. To permanently delete stored audits, first uninstall and then delete the listed `rankmiso-mcp` data directory yourself.

## Platform notes and troubleshooting

Release archives are targeted for Windows x86_64, macOS Apple Silicon, macOS Intel, and Linux x86_64. Archives are currently unsigned and not notarized. Windows may show SmartScreen and macOS may show Gatekeeper warnings; verify the archive checksum and source before choosing to run it.

### Signing requirements (not implemented)

- **Windows:** Direct distribution requires Authenticode signatures on the executable files, issued from a code-signing certificate trusted by Windows. Signing does not guarantee immediate SmartScreen reputation. See [Microsoft's code-signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options) and [SmartScreen reputation guidance](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).
- **macOS:** Sign each executable with a valid **Developer ID Application** certificate and **Hardened Runtime**, then submit the software using Apple's supported notarization workflow and `notarytool`. The current `.tar.gz` companion archive is not a supported notarization container and cannot receive a stapled ticket. Apple can notarize ZIP archives, but ZIP files cannot be stapled; tickets for standalone command-line binaries also cannot be stapled directly. Before public macOS distribution, choose a supported outer container and confirm Gatekeeper behavior, including offline first launch. See [Apple's notarization requirements](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution), [custom notarization workflow and stapling limits](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow), and [Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates/).

These signing steps are release requirements, separate from installer and runtime verification. No certificate, account, paid service, or release has been configured.

If RankMiso reports **Companion Not Found**, rerun installation for the current user and browser, then restart the browser. If it reports **Connection Failed**, check that the installed host file exists and that the OS did not block it. If Chrome or Firefox permission is absent, enable local sharing from RankMiso and approve the browser prompt. MCP client setup and browser companion permission are separate steps.

Use the Codex and Claude Code MCP guides for current client commands: [Codex MCP](https://developers.openai.com/codex/mcp) and [Claude Code MCP](https://docs.anthropic.com/en/docs/claude-code/mcp).
