<script setup lang="ts">
import { browser } from "wxt/browser";
import { ArrowLeft, BookOpen } from "lucide-vue-next";

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
      Public companion downloads are not available yet. The published v0.4.0 extension does not
      include MCP. Do not install temporary CI artifacts as public software.
    </p>

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
      <h2>1. Install the companion</h2>
      <p>
        When the official companion download is released, download the package for your system,
        verify its SHA-256 checksum, and extract it. Open a terminal in the extracted folder:
      </p>
      <ul>
        <li>Windows x86_64: run <code>.\rankmiso-setup.exe install</code> in PowerShell.</li>
        <li>macOS Apple Silicon or Intel: run <code>./rankmiso-setup install</code>.</li>
        <li>Linux x86_64: run <code>./rankmiso-setup install</code>.</li>
      </ul>
      <p>
        The installer is per-user and registers Chrome and Firefox. Windows and macOS native
        installer checks passed in CI, but browser audit sharing on those systems is not verified.
        Firefox live Native Messaging is also not verified. The unsigned CI packages are for
        controlled testing only; do not bypass SmartScreen or Gatekeeper for an unverified file.
      </p>
    </section>

    <section>
      <h2>2. Connect RankMiso and share</h2>
      <ol>
        <li>Analyze a website in RankMiso.</li>
        <li>
          Open <strong>AI</strong>, choose <strong>Enable local sharing</strong>, and approve the
          Native Messaging permission. Firefox also asks you to approve optional audit-data access.
        </li>
        <li>
          Open the audit's <strong>Export</strong> view and choose <strong>Share with MCP</strong>.
        </li>
        <li>Review the details and confirm. Sharing never happens automatically.</li>
        <li>Return to <strong>AI</strong> to check the companion status and Shared Audits list.</li>
      </ol>
      <p>
        <strong>Connected</strong> means the browser reached the local companion. It does not mean
        the AI client is configured or connected.
      </p>
    </section>

    <section>
      <h2>3. Configure your AI client</h2>
      <p>
        From the extracted companion folder, run the matching command after installing Codex CLI or
        Claude Code:
      </p>
      <pre><code>./rankmiso-setup configure codex
./rankmiso-setup configure claude</code></pre>
      <p>On Windows, run the `.exe` commands in PowerShell:</p>
      <pre><code>.\rankmiso-setup.exe configure codex
.\rankmiso-setup.exe configure claude</code></pre>
      <p>
        Setup adds only the RankMiso server. If a server named <code>rankmiso</code> already exists,
        setup stops and leaves it unchanged. After setup, restart the client. Check Codex with
        <code>codex mcp list</code>; check Claude Code with <code>claude mcp list</code> and
        <code>claude mcp get rankmiso</code> or <code>/mcp</code>.
      </p>
      <p>
        Client registration and client connectivity are separate. The companion needs no API key;
        signing in to the AI provider selected by Codex or Claude Code may still be required.
      </p>
    </section>

    <section>
      <h2>Try these prompts</h2>
      <ul class="mcp-guide-prompts">
        <li>
          Using RankMiso MCP, retrieve my latest shared audit. Explain errors, warnings, and
          unavailable checks.
        </li>
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
      <h2>Shared audits, privacy, and help</h2>
      <p>
        The AI page lists snapshots with analyzed and shared times. Remove one from its row. The
        companion uninstall keeps snapshots and local configuration. Removing a snapshot stops
        future retrieval from this folder; it cannot retract content an AI provider already
        received.
      </p>
      <p>
        RankMiso stores snapshots locally, requires no RankMiso cloud account, and does not collect
        MCP telemetry. Sharing requires your confirmation. Your selected AI provider may process
        retrieved audit content according to its own settings and privacy terms; local storage does
        not guarantee local AI processing.
      </p>
      <p>
        For <strong>Companion Not Found</strong>, install for the same OS user and restart the
        browser. For <strong>Permission Required</strong>, enable sharing in AI and approve Native
        Messaging (and Firefox's audit-data consent). For <strong>No shared audits</strong>, analyze
        a page and explicitly confirm Share with MCP. For a missing AI server, check the client's
        MCP list and restart it. Browser-to-companion and AI-client-to-MCP are separate connections.
      </p>
      <p>
        Uninstall from the extracted official package with
        <code>rankmiso-setup uninstall</code> (add <code>.exe</code> on Windows). It removes
        binaries and browser registrations but preserves audits and local configuration. Remove the
        separate client entry with <code>codex mcp remove rankmiso</code> or
        <code>claude mcp remove rankmiso</code>.
      </p>
      <p class="mcp-guide-doc-link">
        Windows/macOS browser sharing and Firefox live connection remain unverified.
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
