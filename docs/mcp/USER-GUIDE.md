# Using RankMiso with AI Coding Assistants

RankMiso MCP lets Codex or Claude Code read SEO audits that you choose to share. The browser extension saves a confirmed audit to a private folder on your computer. A local companion connects the browser to the MCP server used by your AI client.

## What it can do

MCP means **Model Context Protocol**. It is a standard way for an AI client to call tools provided by another application. RankMiso exposes five read-only tools:

- `rankmiso_list_audits` — list supported audit and crawl exports in the configured folder.
- `rankmiso_get_audit` — read an audit and selected sections.
- `rankmiso_get_issues` — filter measured findings.
- `rankmiso_compare_audits` — compare two compatible audits.
- `rankmiso_get_crawl_results` — read pages from an exported site crawl.

The tools can read existing RankMiso exports. They cannot open a website, start a new scan, change SEO settings, or edit your project. Your AI coding assistant may have separate project tools that can edit files; review and approve those changes yourself.

## Requirements and verification status

- A RankMiso browser extension build that includes MCP (the published v0.4.0 extension does not include it).
- The optional RankMiso companion for Windows x86_64, macOS Apple Silicon, macOS Intel, or Linux x86_64.
- Chrome or Firefox for browser sharing. The companion registers both, but Firefox live Native Messaging has not been verified.
- Codex CLI or Claude Code for the AI-client connection.

All four companion targets passed native CI for builds, tests, archives, checksums, installer lifecycle, registration, and a Native Messaging protocol handshake. Linux packaged installation and protocol use were also verified locally. Isolated Chrome browser sharing was verified with a development extension ID. Production Chrome-ID sharing, Firefox browser use, and Windows/macOS browser sharing remain unverified. Native CI is not browser E2E.

## Install the companion

**Easiest:** install the RankMiso plugin in Claude Code or Codex and ask it to “Connect RankMiso”. It downloads, verifies, and installs the companion after you approve ([Claude Code](../integrations/claude-code.md), [Codex](../integrations/codex.md)).

**Manual:** download the archive for your system from the [v0.5.1 pre-release](https://github.com/EdeesonOpina/rankmiso/releases/tag/v0.5.1) (v0.5.0 cannot be started by browsers), verify its SHA-256 checksum, extract it, then open a terminal in the extracted folder. Do not use a CI artifact as an installer.

Run the installer for your system:

| System | Command |
| --- | --- |
| Windows x86_64 | `.\rankmiso-setup.exe install` in PowerShell |
| macOS Apple Silicon | `./rankmiso-setup install` |
| macOS Intel | `./rankmiso-setup install` |
| Linux x86_64 | `./rankmiso-setup install` |

On macOS and Linux, package extraction should preserve executable permissions. If the official archive did not, run `chmod +x rankmiso-setup rankmiso-mcp rankmiso-mcp-native-host` before installation. Windows does not use this command.

The installer works for the current user and does not need administrator access. It installs the server, Native Messaging host, and setup utility; registers the browser host; and creates a private local audit folder. The current archives are unsigned development artifacts. If Windows SmartScreen or macOS Gatekeeper warns about an official future download, verify the publisher and checksum. Do not bypass a warning for an unverified file. Windows signing and macOS signing/notarization are still release requirements.

## Connect RankMiso and share an audit

1. Open a website in Chrome or Firefox and analyze it with RankMiso.
2. Open **AI** in RankMiso and select **Enable local sharing**. Approve the browser's optional Native Messaging permission when asked.
3. Return to the audit's **Export** view and choose **Share with MCP**.
4. Review the confirmation and select **Share audit**. Sharing never happens automatically.
5. Return to **AI**. A successful companion connection appears as **Connected**; shared snapshots appear in **Shared audits**.

The browser's **Connected** state means the browser can reach the local companion. It does not mean Codex or Claude Code is configured or connected.

## Configure Codex

Install Codex CLI first. From the extracted companion folder, run:

```sh
# macOS or Linux
./rankmiso-setup configure codex

# Windows PowerShell
.\rankmiso-setup.exe configure codex
```

The setup utility checks for an existing server named `rankmiso`. If it already exists, the utility stops and leaves it unchanged; inspect it before making any manual changes. On success, restart Codex and run:

```sh
codex mcp list
```

This confirms the entry is configured. In Codex, ask it to list the RankMiso audits or retrieve an audit to verify the MCP connection. The companion itself does not need an OpenAI API key. Codex may require you to sign in to use your selected model.

## Configure Claude Code

Install Claude Code first. From the extracted companion folder, run:

```sh
# macOS or Linux
./rankmiso-setup configure claude

# Windows PowerShell
.\rankmiso-setup.exe configure claude
```

The setup utility uses Claude Code's supported CLI and a user-level server entry. It preserves other MCP servers and refuses to replace an existing `rankmiso` entry. Restart Claude Code, then run:

```sh
claude mcp list
claude mcp get rankmiso
```

The first command lists configured servers; the second reports the connection status. You can also run `/mcp` inside Claude Code. The companion itself does not need an Anthropic API key. Claude Code may require its own account or provider authentication.

## Example prompts

**Analyze my website**

> Using RankMiso MCP, retrieve the latest shared SEO audit for my website. Explain its SEO score, errors, warnings, and unavailable checks.

**Find technical SEO issues**

> Read my RankMiso audit and identify the most important technical SEO problems. Prioritize actionable fixes.

**Fix my website**

> Use the existing RankMiso SEO findings to inspect my current project. Recommend fixes and implement approved code changes.

RankMiso MCP only reads the audits you shared. Your assistant's separate project tools may inspect or edit project files; review its proposed changes before accepting them.

**Compare audits**

> Compare my two shared RankMiso audits and explain which SEO findings improved or regressed.

## Manage shared audits

The **Shared audits** list shows snapshots saved by explicit sharing. More than one snapshot can belong to the same website: compare the **Analyzed** time (when RankMiso measured the page) with the **Shared** time (when you saved that snapshot). Use the row's **Remove** action to delete one local snapshot.

Snapshots are stored locally and are not automatically uploaded by RankMiso. Uninstalling the companion removes its binaries and browser registrations but preserves audit files and local configuration. Removing a snapshot stops future retrieval from that folder; it cannot retract content that an AI assistant has already received or processed.

## Troubleshooting

| Message or symptom | What to check |
| --- | --- |
| **Companion Not Found** | Install the companion for the same operating-system user that runs the browser. Restart the browser after installation. |
| **Permission Required** | In RankMiso → **AI**, enable local sharing and approve the Native Messaging permission. If you denied it, allow it in the browser's extension settings, then check permission again. |
| **Connection Failed** | Check that the companion is installed and the browser has not blocked it. Re-run `rankmiso-setup install` from the official extracted archive. |
| **No shared audits** | Analyze a supported page, choose **Export → Share with MCP**, and confirm the share. Connecting alone does not share an audit. |
| **RankMiso is missing in Codex** | Run `codex mcp list`. If the name already exists, inspect it instead of running setup over it. Restart Codex after configuring. |
| **RankMiso is missing or disconnected in Claude Code** | Run `claude mcp list` and `claude mcp get rankmiso`, then restart Claude Code. Follow its connection or authentication status. |
| **Browser profile mismatch** | The registration belongs to the OS user and browser profile paths used by the installer. Install for the browser profile you actually use; do not copy a host manifest from another profile. |
| **Extension ID mismatch** | The manifest must authorize the exact RankMiso extension identity. Do not use wildcard origins or edit the allowlist to an unknown ID. |

There are two separate connections: **browser → local companion** for explicit sharing and snapshot management; **AI client → MCP server** for tool calls. A green browser status does not verify the AI client's connection. A configured AI-client entry does not verify browser sharing. Windows and macOS browser sharing and Firefox live Native Messaging remain unverified.

## Privacy and security

The companion stores shared snapshots in the current user's application data folder. Sharing requires your confirmation. RankMiso's MCP tools are read-only and use the configured local audit folder. RankMiso requires no cloud account and does not send audit data to RankMiso servers or collect MCP telemetry.

When an AI client retrieves an audit, that client may send its contents to the model provider selected in its settings. Check that provider's privacy terms. Local RankMiso storage does not mean that AI processing is local. Removing a snapshot does not delete information the AI provider or assistant has already received.

For platform paths, installer details, upgrades, and uninstall instructions, see [Companion installation](INSTALL.md). For current client CLI behavior, see the official [Codex MCP guide](https://developers.openai.com/codex/mcp) and [Claude Code MCP guide](https://code.claude.com/docs/en/mcp).
