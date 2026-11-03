# RankMiso for Claude Code and Codex: product page copy

Website handoff for the RankMiso page on misoecosystem.com. Do not hardcode release versions or marketplace commands into presentation components; use the site's backend-driven product configuration. Current verified source baseline: Chrome and Firefox extension v0.5.1 published, companion v0.5.1, Claude Code and Codex plugins v0.1.1. Linux x86_64 plugin-assisted installation was previously verified. Firefox Native Messaging sharing remains runtime-unverified; the local Snap Firefox launcher is blocked by missing AppArmor confinement support. Manual companion installation remains an advanced alternative. Website repository changes and deployment are outside this milestone.

## Use RankMiso with your AI coding assistant

Share a RankMiso audit with Claude Code or Codex, then ask it to explain the findings or fix them in your code. Everything runs on your computer. No account, no Miso servers, and nothing is shared until you choose to.

**1. Install the plugin**

Claude Code:

```text
/plugin marketplace add EdeesonOpina/rankmiso
/plugin install rankmiso@rankmiso
```

Codex:

```sh
codex plugin marketplace add EdeesonOpina/rankmiso
codex plugin add rankmiso@rankmiso
```

**2. Connect once**

Ask your assistant: **Connect RankMiso**. It shows what it will install and asks for your approval. Then it downloads the RankMiso companion, verifies it, and connects it to Chrome and Firefox. You don't download or configure anything yourself. Afterwards, restart Claude Code (or reconnect RankMiso in `/mcp`), or start a new Codex session, and restart your browser.

**3. Share an audit**

In RankMiso, audit a page. The first time, open **AI Integrations** and choose **Enable local sharing**, then approve the browser's permission. Choose **Share with MCP** and confirm. Then ask your assistant to analyze your latest RankMiso audit.

**Good to know**

- Works today on Linux (x86_64) with Google Chrome. macOS has not been tested yet. Windows needs the [manual install](https://github.com/EdeesonOpina/rankmiso/blob/master/docs/mcp/INSTALL.md) for now. Sharing from Firefox is not verified yet.
- Your AI assistant may send the audit content it reads to its model provider.
- Requires RankMiso v0.5.1 from the Chrome Web Store or Firefox Add-ons.
