---
name: connect
description: Connect RankMiso. Use when the user asks to connect, set up, install, or enable RankMiso, or when RankMiso MCP tools are missing or fail because the companion is not installed.
---

# Connect RankMiso

Set up the local RankMiso companion so this assistant can read SEO audits the user shares from the RankMiso browser extension. The user must not have to download, extract, or configure anything themselves.

The launcher is `bin/rankmiso` in this plugin, two folders above this file. Run it with `sh <plugin root>/bin/rankmiso ...`. In Claude Code it is also on `PATH` as `rankmiso`.

1. Run `rankmiso status`.
   - `Status: READY`: tell the user RankMiso is connected and stop. Nothing needs to be installed.
   - An unsupported-platform message: tell the user exactly what it says and stop.
2. Run `rankmiso connect`. It changes nothing and prints the setup plan.
3. Show the user a short summary of the plan: what is downloaded and from where, the pinned SHA-256 check, the install folder, and the Chrome and Firefox registrations. Ask for approval. In Claude Code use the AskUserQuestion tool. Otherwise ask and wait for the reply.
4. Only after the user approves in this conversation, run `rankmiso connect --yes`. If they decline, stop and say nothing was changed.
5. Report the result from the final status lines. If it says `Status: READY`, say:

   **RankMiso is connected.** Your browser and AI assistant can now exchange SEO audit results through the local companion. Open RankMiso in Chrome or Firefox, audit a page, and choose Share with MCP.

   Then tell the user to load the RankMiso tools: restart Claude Code (or open `/mcp` and reconnect `plugin:rankmiso:rankmiso`), or start a new Codex session. `/reload-plugins` alone does not restart a server that is already running. Also tell them to quit and reopen the browser.

Rules:
- Never pass `--yes` without approval given in this conversation.
- Never download or run anything else, never bypass the checksum, and never edit Claude, Codex, or browser config files by hand.
- If setup fails, quote the error and use the troubleshoot skill. Do not retry with different flags.
- Setup never shares an audit. Sharing is always a separate action the user takes in the extension.
