# RankMiso MCP Companion installation

The companion shares approved schema-v1 audits with the existing read-only MCP server. It runs locally; no account, service, daemon, or network access is installed.

## Install

No public companion download is available yet. The full **MCP companion artifacts** matrix runs for pull requests targeting `master`; ordinary development pull requests targeting `develop` use the separate repository CI and do not run native packaging. A maintainer can also run the native workflow manually from an authorized branch. Manual dispatch appears only after the workflow exists on the repository's default branch (`master`); select the source branch in the Actions form, preferably `master` for release preparation. Manual artifact upload defaults off. If explicitly enabled, platform archives and SHA-256 sidecars are kept for one day. Neither automatic nor manual builds publish a release.

When an official archive becomes available, verify its SHA-256 sidecar, extract it, open a terminal in the extracted folder, and run:

| System | Command |
| --- | --- |
| Windows x86_64 | `.\rankmiso-setup.exe install` |
| macOS Apple Silicon or Intel | `./rankmiso-setup install` |
| Linux x86_64 | `./rankmiso-setup install` |

The installer is per-user and requires no administrator privileges. It installs the MCP server, Native Messaging host and setup utility, registers the exact RankMiso identities with Chrome and Firefox, and creates private local audit storage. It does not grant browser permissions. Open RankMiso → **AI** and enable local sharing to approve Native Messaging; Firefox also requests optional consent for the page address and website content included in shared audits.

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

### PR #28 native CI artifact record

The successful PR #28 matrix uploaded four temporary artifacts. Each downloaded bundle's GitHub Actions SHA-256 digest was checked, its included platform archive matched its SHA-256 sidecar, and its contents were verified. These are workflow artifacts, not GitHub Release assets:

| Artifact | GitHub Actions artifact SHA-256 |
| --- | --- |
| `rankmiso-mcp-companion-v0.5.0-pr28-linux-x86_64` | `7b747d88d99584054375487aca3dee4e2a0a3197497fb91c23fd12974f80213a` |
| `rankmiso-mcp-companion-v0.5.0-pr28-macos-aarch64` | `c580cc7e989441a052de9dd35219bb082ab98272f2a9918b46d6b58d10609385` |
| `rankmiso-mcp-companion-v0.5.0-pr28-macos-x86_64` | `0ddcdf925d1e1da61995ee2c8303988fe2f374e60ad3e5df18d12a5034acee31` |
| `rankmiso-mcp-companion-v0.5.0-pr28-windows-x86_64` | `fdffb1ca32fa9a534173ed96b7d19630303eeafc5c217a7f2a4618fd74a3aea0` |

After review is complete, an authorized repository maintainer can remove only these four artifacts from the [PR #28 workflow run](https://github.com/EdeesonOpina/rankmiso/actions/runs/41270512259) using the run's artifact menu. Do not delete the workflow run or unrelated artifacts. This does not affect published GitHub Release assets; the PR #28 artifacts were never published as releases.

Use the Codex and Claude Code MCP guides for current client commands: [Codex MCP](https://developers.openai.com/codex/mcp) and [Claude Code MCP](https://docs.anthropic.com/en/docs/claude-code/mcp).
