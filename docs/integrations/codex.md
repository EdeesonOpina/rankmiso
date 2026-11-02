# RankMiso for Codex

Requires a Codex version with plugin support, running locally on Linux x86_64 or macOS. RankMiso uses a local stdio MCP server, so it does not work in Codex cloud tasks. See [supported platforms](README.md#supported-platforms).

## Install

```sh
codex plugin marketplace add EdeesonOpina/rankmiso
codex plugin add rankmiso@rankmiso
```

You can also open `/plugins` in Codex and install RankMiso from the RankMiso marketplace. Add `--ref <branch>` to the marketplace source until the plugin is on the default branch.

## Connect

Start a new Codex session and ask "Connect RankMiso". Codex runs the plugin's `connect` skill. It shows the setup plan, asks for approval, and then runs the launcher at `<plugin root>/bin/rankmiso`. Codex may ask to run the command outside the sandbox, because setup downloads the companion and writes to your user folders. Start a new session afterwards so Codex starts the MCP server.

`codex mcp list` shows the server as `rankmiso`, run as `sh ./bin/rankmiso mcp` from the plugin folder. No change to `~/.codex/config.toml` is needed beyond what `codex plugin add` writes.

## Use

1. In Chrome or Firefox, open RankMiso, audit a page, and choose Share with AI.
2. Ask Codex to analyze the latest RankMiso audit, or to fix its findings in your code.

## Troubleshoot

Ask "Troubleshoot RankMiso". The skill reads `rankmiso status` and fixes what it can with your approval.

## Remove

`codex plugin remove rankmiso@rankmiso` removes the plugin only. The shared companion stays. See [updates and removal](README.md#updates-and-removal).

## Public plugin directory

OpenAI's public directory accepts local MCP plugins only from approved partners. RankMiso has not been submitted. The plugin is available through this repository's marketplace.
