# RankMiso for Claude Code and Codex: product page copy

Copy for the RankMiso page on misoecosystem.com. Verified on 2026-11-02 against extension v0.5.0, companion v0.5.1, and plugin 0.1.0.

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

Ask your assistant: **Connect RankMiso**. It shows what it will install and asks for your approval. Then it downloads the RankMiso companion, verifies it, and connects it to Chrome and Firefox. You don't download or configure anything yourself. Afterwards, run `/reload-plugins` in Claude Code, or start a new Codex session.

**3. Share an audit**

In RankMiso, audit a page. The first time, open **AI Integrations** and choose **Enable local sharing**, then approve the browser's permission. Choose **Share with MCP** and confirm. Then ask your assistant to analyze your latest RankMiso audit.

**Good to know**

- Works today on Linux (x86_64) with Google Chrome. macOS has not been tested yet. Windows needs the [manual install](https://github.com/EdeesonOpina/rankmiso/blob/master/docs/mcp/INSTALL.md) for now. Sharing from Firefox is not verified yet.
- Your AI assistant may send the audit content it reads to its model provider.
- Requires RankMiso v0.5.0 from the Chrome Web Store or Firefox Add-ons.
