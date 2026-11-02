<script setup lang="ts">
import { browser } from "wxt/browser";
import { ArrowLeft, ArrowUpRight, BookOpen } from "lucide-vue-next";

const aiUrl = browser.runtime.getURL("/dashboard.html?section=ai-integrations");
</script>

<template>
  <main class="mcp-guide-page">
    <a class="mcp-guide-back" :href="aiUrl"><ArrowLeft aria-hidden="true" /> Back to AI</a>
    <header class="mcp-guide-header">
      <BookOpen aria-hidden="true" />
      <div>
        <p class="overline">RankMiso MCP</p>
        <h1>Using RankMiso with AI Coding Assistants</h1>
        <p class="mcp-guide-lede">
          Share an SEO audit from RankMiso, then ask Codex or Claude Code to read it.
        </p>
      </div>
    </header>

    <p class="mcp-guide-notice" role="note">
      Use the RankMiso MCP companion v0.5.1 or later. The v0.5.0 companion cannot be started by
      Chrome or Firefox, so sharing fails with <strong>Connection Failed</strong>. The plugin below
      installs or upgrades it for you.
    </p>
    <a
      class="mcp-guide-site-link"
      href="https://github.com/EdeesonOpina/rankmiso/blob/master/docs/integrations/README.md"
      target="_blank"
      rel="noreferrer noopener"
    >
      Full setup guide on GitHub <ArrowUpRight aria-hidden="true" />
    </a>

    <section>
      <h2>What MCP does</h2>
      <p>
        MCP (Model Context Protocol) connects an AI client to tools. RankMiso provides a local
        companion because the browser and your AI client are separate applications. The companion
        stores only audits you explicitly share. Its five tools can list audits, read an audit, find
        issues, compare compatible audits, and read exported crawl results.
      </p>
      <p>
        RankMiso MCP reads existing exports. It cannot open a website or start a new scan. The MCP
        tools are read-only; your AI assistant may have separate project tools that can edit files.
      </p>
    </section>

    <section>
      <h2>1. Install the RankMiso plugin</h2>
      <p>In Claude Code, run each command on its own line:</p>
      <pre><code>/plugin marketplace add EdeesonOpina/rankmiso
/plugin install rankmiso@rankmiso</code></pre>
      <p>In Codex, run in a terminal:</p>
      <pre><code>codex plugin marketplace add EdeesonOpina/rankmiso
codex plugin add rankmiso@rankmiso</code></pre>
    </section>

    <section>
      <h2>2. Connect once</h2>
      <ol>
        <li>Ask your assistant: <strong>Connect RankMiso</strong>.</li>
        <li>
          It shows what it will install and asks for your approval. After you approve, it downloads
          the companion from the RankMiso GitHub release, checks its SHA-256, installs it for your
          user, and registers Chrome and Firefox. You don't edit any files.
        </li>
        <li>
          <strong>Restart your AI client</strong> so it loads the RankMiso tools: quit and reopen
          Claude Code (or open <code>/mcp</code> and reconnect RankMiso), or start a new Codex
          session.
        </li>
        <li>Quit and reopen your browser so it finds the companion.</li>
      </ol>
    </section>

    <section>
      <h2>3. Share an audit</h2>
      <ol>
        <li>Analyze a website in RankMiso.</li>
        <li>
          Open <strong>AI Integrations</strong>, choose <strong>Enable local sharing</strong>, and
          approve the Native Messaging permission. Firefox also asks you to approve optional
          audit-data access.
        </li>
        <li>
          Open the audit's <strong>Export</strong> view and choose <strong>Share with MCP</strong>.
        </li>
        <li>Review the details and confirm. Sharing never happens automatically.</li>
        <li>
          Return to <strong>AI Integrations</strong> to check the companion status and the Shared
          Audits list.
        </li>
      </ol>
      <p>
        <strong>Connected</strong> means the browser reached the local companion. Your AI client
        connects separately, through the plugin.
      </p>
    </section>

    <section>
      <h2>Try these prompts</h2>
      <ul class="mcp-guide-prompts">
        <li>Analyze my latest RankMiso audit. Explain errors, warnings, and unavailable checks.</li>
        <li>Read my audit and prioritize the most important technical SEO issues.</li>
        <li>Compare my two shared audits and explain which findings improved or regressed.</li>
        <li>
          Use the audit to recommend fixes for this project. Show me the changes before applying
          them.
        </li>
      </ul>
      <p>The prompts use existing shared data; they do not start a new website scan.</p>
    </section>

    <section>
      <h2>Supported systems</h2>
      <ul>
        <li>Linux x86_64 with Google Chrome: verified.</li>
        <li>macOS: not yet tested on a Mac.</li>
        <li>Windows: the plugin cannot set up the companion yet. Use manual setup below.</li>
        <li>Firefox, including Snap Firefox: sharing is not verified yet.</li>
      </ul>
    </section>

    <section>
      <h2>Shared audits, privacy, and help</h2>
      <p>
        The AI Integrations page lists snapshots with analyzed and shared times. Remove one from its
        row. Removing a snapshot stops future retrieval from this folder; it cannot retract content
        an AI provider already received.
      </p>
      <p>
        RankMiso stores snapshots locally, requires no RankMiso cloud account, and does not collect
        MCP telemetry. Sharing requires your confirmation. Your selected AI provider may process
        retrieved audit content according to its own settings and privacy terms; local storage does
        not guarantee local AI processing.
      </p>
      <p>
        For <strong>Companion Not Found</strong>, connect RankMiso for the same OS user and restart
        the browser. For <strong>Connection Failed</strong>, ask your assistant to connect RankMiso
        again; it upgrades an old companion. For <strong>Permission Required</strong>, enable
        sharing and approve Native Messaging. For <strong>No shared audits</strong>, analyze a page
        and confirm Share with MCP. If your assistant has no RankMiso tools, restart it, or ask it
        to <strong>troubleshoot RankMiso</strong>.
      </p>
    </section>

    <section>
      <h2>Manual setup (advanced)</h2>
      <p>
        Download the archive for your system from the
        <a
          href="https://github.com/EdeesonOpina/rankmiso/releases/tag/v0.5.1"
          target="_blank"
          rel="noreferrer noopener"
          >v0.5.1 GitHub release</a
        >, verify its SHA-256 checksum, and extract it. In a terminal in that folder, run
        <code>./rankmiso-setup install</code> (<code>.\rankmiso-setup.exe install</code> in
        PowerShell on Windows), then <code>./rankmiso-setup configure codex</code> or
        <code>./rankmiso-setup configure claude</code>, and restart the client.
      </p>
      <p>
        The packages are unsigned. Do not bypass SmartScreen or Gatekeeper for a file you have not
        verified. <code>rankmiso-setup uninstall</code> removes the binaries and browser
        registrations but keeps your audits. Remove a manually added client entry with
        <code>codex mcp remove rankmiso</code> or <code>claude mcp remove rankmiso</code>.
      </p>
    </section>
  </main>
</template>

<style scoped>
.mcp-guide-page {
  width: min(100%, 860px);
  margin: 0 auto;
  padding: 24px clamp(16px, 4vw, 36px) 48px;
  color: var(--ink);
}
.mcp-guide-site-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  margin: 8px 0 16px;
  padding: 8px 16px;
  border-radius: 999px;
  background: var(--accentsoft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}
.mcp-guide-site-link:hover {
  background: var(--accent);
  color: var(--canvas);
}
.mcp-guide-site-link svg {
  width: 15px;
  height: 15px;
}
.mcp-guide-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  color: var(--muted);
  font-size: 12px;
  text-decoration: none;
}
.mcp-guide-back svg {
  width: 15px;
  height: 15px;
}
.mcp-guide-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin: 18px 0;
}
.mcp-guide-header > svg {
  width: 22px;
  height: 22px;
  margin-top: 3px;
  color: var(--accent);
}
.mcp-guide-header .overline {
  margin: 0 0 5px;
  color: var(--muted);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.mcp-guide-header h1 {
  margin: 0;
  font-size: clamp(22px, 4vw, 30px);
  line-height: 1.2;
}
.mcp-guide-lede {
  margin: 8px 0 0;
  color: var(--muted);
  line-height: 1.55;
}
.mcp-guide-notice {
  padding: 12px 14px;
  border-inline-start: 3px solid var(--warning);
  border-radius: 8px;
  background: var(--surface);
  line-height: 1.5;
}
.mcp-guide-site-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  margin: 8px 0 16px;
  padding: 8px 16px;
  border-radius: 999px;
  background: var(--accentsoft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}
.mcp-guide-site-link:hover {
  background: var(--accent);
  color: var(--canvas);
}
.mcp-guide-site-link svg {
  width: 15px;
  height: 15px;
}
.mcp-guide-page section {
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}
.mcp-guide-page h2 {
  margin: 0 0 8px;
  font-size: 16px;
}
.mcp-guide-page p,
.mcp-guide-page li {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.65;
}
.mcp-guide-page p {
  margin: 8px 0;
}
.mcp-guide-page ul,
.mcp-guide-page ol {
  display: grid;
  gap: 6px;
  padding-inline-start: 22px;
}
.mcp-guide-page code,
.mcp-guide-page pre {
  color: var(--ink);
  font-family: var(--font-mono, monospace);
}
.mcp-guide-page pre {
  overflow-x: auto;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  font-size: 12px;
  line-height: 1.6;
}
.mcp-guide-prompts li {
  padding-inline-start: 2px;
}
.mcp-guide-doc-link {
  font-size: 11px !important;
}
@media (max-width: 600px) {
  .mcp-guide-page {
    padding-top: 14px;
  }
}
</style>
