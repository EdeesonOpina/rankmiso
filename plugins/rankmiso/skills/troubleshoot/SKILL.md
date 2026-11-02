---
name: troubleshoot
description: Diagnose RankMiso connection problems. Use when RankMiso tools are missing, fail, return no audits, or the extension cannot reach the companion.
---

# Troubleshoot RankMiso

Run `rankmiso status` (`sh <plugin root>/bin/rankmiso status`; the plugin root is two folders above this file). Report the result in plain words, then handle each line that is not OK. Fix things with the launcher. Do not ask the user to edit JSON, TOML, or registry entries.

| Status line | Meaning and action |
| --- | --- |
| `MCP Companion: Not installed` | Use the connect skill. |
| `MCP Companion: Incompatible` | A different companion version is installed. It was left unchanged. Explain this. Replacing it needs the user's approval: `rankmiso uninstall` (shows what it removes), then `rankmiso uninstall --yes` and the connect skill. |
| `Audit folder: Config missing or points elsewhere` | An earlier setup uses another audit folder. The installer refuses to move audits. Show the path and let the user decide. |
| `MCP Server: Did not initialize` | Run `rankmiso mcp < /dev/null` and quote its error. |
| `Chrome:` or `Firefox:` `Not registered` / `Invalid` | Use the connect skill. It repairs the registration with the installed companion and downloads nothing. `Invalid` files that belong to another program are left unchanged. Report their path. |
| `Shared Audit: None yet` | Not a failure. The user opens RankMiso in the browser, audits a page, and chooses Share with AI. The first share asks for the browser's Native Messaging permission. |
| `Note: Snap Firefox` | Snap Firefox isolates native hosts. Suggest Chrome or a non-Snap Firefox. Do not weaken the sandbox. |

If the status is READY but the assistant has no RankMiso tools:
- Claude Code: run `/reload-plugins` or `/mcp` and reconnect `plugin:rankmiso:rankmiso`.
- Codex: start a new session.
- A manually added server named `rankmiso` from an older setup also works, but it duplicates the tools. Check with `claude mcp get rankmiso` or `codex mcp get rankmiso`. Remove it only if the user agrees.

If the extension says the companion is unavailable after setup, restart the browser so it rereads native host registrations.
