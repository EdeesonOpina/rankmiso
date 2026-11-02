# RankMiso for Claude Code

Requires Claude Code with plugin support, on Linux x86_64 or macOS. See [supported platforms](README.md#supported-platforms).

## Install

In Claude Code:

```text
/plugin marketplace add EdeesonOpina/rankmiso
/plugin install rankmiso@rankmiso
```

Or from a terminal: `claude plugin marketplace add EdeesonOpina/rankmiso`, then `claude plugin install rankmiso@rankmiso`.

The marketplace is read from the repository's default branch, so these commands work after the plugin is merged there.

## Connect

Run `/rankmiso:connect`, or ask "Connect RankMiso". Approve the setup when asked. Claude Code also asks before it runs the setup command. Then run `/reload-plugins`, or reconnect `plugin:rankmiso:rankmiso` in `/mcp`.

The MCP server appears as `plugin:rankmiso:rankmiso`. Its tools are named `mcp__plugin_rankmiso_rankmiso__rankmiso_list_audits`, and so on. The `bin/rankmiso` launcher is on the Bash tool's `PATH` while the plugin is enabled, so `rankmiso status` works in the terminal tool.

## Use

1. In Chrome or Firefox, open RankMiso, audit a page, and choose Share with AI.
2. Ask Claude Code to analyze the latest RankMiso audit (`/rankmiso:analyze-audit`), or to fix the findings in your code (`/rankmiso:fix-seo`).

## Troubleshoot

Run `/rankmiso:troubleshoot`. It reads `rankmiso status` and fixes what it can with your approval.

## Remove

`/plugin uninstall rankmiso@rankmiso` removes the plugin only. The shared companion stays for Codex, the browser, and any manual setup. See [updates and removal](README.md#updates-and-removal).
