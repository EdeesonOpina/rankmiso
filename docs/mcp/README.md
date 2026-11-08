# RankMiso MCP Companion

RankMiso MCP is a local, read-only Rust companion for SEO audit JSON. The MCP executable reads only files in one explicitly configured directory. The v0.5.1 browser extension can optionally share an approved current audit through the separately installed Native Messaging host.

For beginner instructions, see [Using RankMiso with AI Coding Assistants](USER-GUIDE.md). For package commands and installation paths, see [Companion installation](INSTALL.md).

## Claude Code and Codex plugins

The recommended setup is the RankMiso plugin. It installs and verifies this companion for you. See [docs/integrations](../integrations/README.md). Use companion v0.5.1 or later: the v0.5.0 native host cannot be started by a real browser.

## Packaged installation

M6.3 adds cross-platform artifact builds for Windows x86_64, macOS Apple Silicon, macOS Intel, and Linux x86_64. Pull requests targeting `master` run the native build and installer checks; ordinary `develop` pull requests use standard repository CI. Manual runs build packages only when requested and upload artifacts only when the maintainer opts in. Neither path publishes a GitHub Release. No public download is currently available. See the [beginner's guide](USER-GUIDE.md) and [installation reference](INSTALL.md).

The installer registers the production Chrome ID `gdklhfalmmahhgimegjlfnhmacimeonl` and Firefox ID `rankmiso@rankmiso.extension`, creates private per-user audit storage, and uses the same audit directory for browser sharing and the MCP client command. Existing development snapshots are not copied. An existing nonstandard native-host config is preserved and requires explicit handling before install.

Native CI passed on all four supported targets, including package checks and installer lifecycle. These checks do not count as Windows/macOS browser runtime verification; actual browser sharing remains recorded separately below. Current CI artifacts are unsigned and are not public downloads. Windows SmartScreen and macOS Gatekeeper signing/notarization requirements remain open for release.

## Development setup

### Quick development test (Linux + Google Chrome)

From the repository root, run:

```sh
pnpm mcp:dev
```

This builds the existing MCP server and browser companion, creates a temporary audit folder and Chrome profile, registers the exact extension ID only in that profile, and opens a local test page beside RankMiso. It does not touch the normal Chrome profile or production registration. In the opened RankMiso window, open **AI Integrations** and click **Enable local sharing**, and approve Chrome's Native Messaging prompt; RankMiso checks the companion after the grant, including if Chrome resolves the prompt after the waiting message appears. Then open the test page's full report, choose **Export → Share with MCP**, and confirm. **AI Integrations** will show the connection and saved snapshot. Close the isolated Chrome window to remove its temporary registration and files. If the prompt is denied or dismissed, use **Enable local sharing** again after Chrome closes the prompt.

Keep the Chrome window open. In a second terminal at the repository root, run:

```sh
pnpm mcp:codex
```

This starts a new local Codex CLI session with the existing `rankmiso-mcp` executable and the exact audit folder created by `pnpm mcp:dev`. It supplies Codex's standard `mcp_servers` configuration as per-process `-c` overrides; it does not edit `~/.codex/config.toml` or replace other MCP registrations. Ask that Codex session to retrieve the latest shared audit. Close Codex first, then close Chrome so the development helper can clean up its temporary data. An already-running Codex session does not receive new MCP settings; start it with `pnpm mcp:codex` after sharing.

To verify retrieval/removal through the existing MCP server, use the browser integration test described under [M6.2 browser verification](../testing/manual-checklist.md#m62-browser-to-mcp-audit-sharing). The automated test pregrants permission because headless Chrome cannot operate the native prompt; it does not count as prompt verification.

Firefox does not use this Chrome launcher. Use the Firefox steps in the manual checklist on a visible desktop session and a temporary profile. The helper must register Firefox's fixed add-on ID, `rankmiso@rankmiso.extension`.

### Manual source installation for development

Requirements: Rust 1.88 or later. The rest of the workspace retains its Rust 1.85 minimum.

```sh
cargo build --release -p rankmiso-mcp --locked
```

This builds `rankmiso-mcp`, `rankmiso-mcp-native-host`, and `rankmiso-setup` under `target/release` (with `.exe` on Windows). Use this setup binary for per-user source installation, or use the individual binaries for development. Requirements: Rust 1.88 or later. The rest of the workspace retains its Rust 1.85 minimum.

The MCP executable reads the configured directory using `--audit-dir` or `RANKMISO_MCP_AUDIT_DIR`. There is no default path; a missing directory stops startup. For browser sharing, create the chosen directory first, then use that exact directory in the companion registration and MCP client configuration.

```sh
rankmiso-mcp --help
rankmiso-mcp --audit-dir /absolute/path/to/rankmiso-exports
```

The second command is for a direct smoke check; MCP clients launch the same command as a persistent stdio process. Do not launch two instances against separate directories for one client entry.

## Supported exports and tools

The extension's **Audit → JSON** download is the complete `AuditResult` at `schemaVersion: 1`. It includes stable rule IDs, measured status, score summary/disclaimer, page metadata, headings, links, images, structured data, technical observations, performance observations, and source limitations. Optional measurements remain `UNAVAILABLE` or not applicable; they are not passes.

The **History → JSON** download is a `schemaVersion: 2` History envelope of intentionally summarized saved comparisons. It does not contain full audits or all measured evidence, so M6.1 does not list it as an audit or claim to reconstruct audits from it. The **Site Explorer → JSON** download is a separate `schemaVersion: 1` crawl export with per-page observations and partial/completion state; it is exposed as a crawl entry.

| Tool                         | What it returns                                                                                                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rankmiso_list_audits`       | Sorted supported audit and crawl export metadata with opaque IDs, `kind`, timestamp, schema version, pagination, and a count of ignored malformed/unsupported JSON files.                     |
| `rankmiso_get_audit`         | Selected sections of schema-version-1 audit JSON as structured data. Large arrays are paginated with `offset` and `limit` (default 100, maximum 100); `sections` can select top-level fields. |
| `rankmiso_get_issues`        | Measured ERROR/WARNING checks, with optional status/category filtering and pagination.                                                                                                        |
| `rankmiso_compare_audits`    | Issue state changes by stable check ID and score delta only when ruleset and measured rule-ID coverage match.                                                                                 |
| `rankmiso_get_crawl_results` | Completion/partial status, origin, duplicate metadata and paginated per-page observations from a separate Site Explorer JSON export using `crawl_id`.                                         |

Issue results carry RankMiso rule text and evidence; the server does not generate recommendations. Comparison status changes do not imply ranking or traffic changes. Score comparison also requires the same page URL after removing its fragment. IDs are local to the directory and derive from filenames; they are not path parameters. A file rename changes its ID. Tool errors use structured results with an error message and no filesystem paths.

## Direct browser sharing (development preview)

The extension adds **Share with MCP** to the full report. The user sees the website, audit time, audit type, approximate size, local destination and AI-client privacy notice, then must approve. The report snapshots the existing JSON serializer output and checks that the inspected tab still matches before transfer. Automatic Checks, Smart Refresh, history, popup opening and crawling never share data.

In **AI Integrations → Local MCP Companion**, choose **Enable local sharing**. RankMiso stores this opt-in in extension-local storage. When AI Integrations opens, it rechecks the current optional `nativeMessaging` permission and, if enabled and still granted, checks the companion and loads shared audit metadata automatically. No permission prompt runs during startup. If permission is absent or revoked, RankMiso shows **Permission Required** and waits for an explicit enable action. **Disable local sharing** clears the preference without revoking browser permission or deleting snapshots.

Companion pings and shared-list metadata are reused for at most 15 seconds to avoid launching duplicate short-lived native processes during quick tab changes. The **Connected** label expires after the same interval while AI Integrations stays open; it returns to a retryable state without polling. A manual check forces a fresh ping and list; sharing, removal, and permission revocation invalidate the shared-list cache. There is no background polling or persistent native process. A successful explicit connection, confirmed share, or acknowledged removal appears in the existing accessible, dismissible success toast. Permission revocation immediately clears the status and hides the shared list.

AI Integrations lists approved shared audits in pages of 50, newest shared first. The shared timestamp comes from the saved file's modification time; the analyzed timestamp remains the audit's own `analyzedAt`. Each row shows the website, both timestamps, and a short snapshot-ID suffix so repeated shares of one URL can be distinguished. Removal requires a second confirmation and targets that exact snapshot ID; after the host acknowledges deletion, the list refreshes without another companion check. Browser permission revocation prevents later calls and leaves prior snapshots in place.

Permission and installation are separate: granting `nativeMessaging` lets RankMiso ask the browser to start its companion, but does not install or register that companion. If the host manifest is missing or registered for another profile, Chrome returns `Specified native messaging host not found.` AI Integrations directs users to the package's platform-specific `README-INSTALL.md`. A successful ping shows **Connected**; other failures are shown beside the Check Companion action.

On Chrome, granting an optional permission can leave an already-open extension page without `runtime.connectNative`. If RankMiso sees permission but neither browser runtime namespace exposes that API, it reloads the extension and displays that recovery action. The delayed-permission event also resumes the companion check automatically. These recovery paths have unit coverage; the final visible run did not remain open long enough to verify them after granting.

If the browser leaves its optional permission request unresolved, RankMiso stops showing “Checking…” after 10 seconds and displays an awaiting-decision message. AI Integrations offers a permission-status recheck; while the original request remains pending, it does not issue another prompt or native-host request. The share confirmation also returns to the UI with a pending message instead of waiting indefinitely. A timeout is not treated as denial; actual permission state remains browser-controlled.

### AI Integrations and tab lifecycle

The workbench's **AI Integrations** utility destination is the single place to check the local companion and inspect or remove shared snapshots. Settings contains only general preferences and links to that destination. RankMiso does not discover or verify AI clients. Client setup commands and manual fallbacks are in [the install guide](INSTALL.md), with links to the [official Codex MCP instructions](https://developers.openai.com/codex/mcp) and [Claude Code MCP instructions](https://docs.anthropic.com/en/docs/claude-code/mcp).

When the integration is enabled, opening AI Integrations reads the saved local preference, checks current browser permission, and verifies the companion. The Connected label expires after 15 seconds. If the destination remains open, the next active-tab event triggers one quiet recheck after expiry; fresh status suppresses checks on immediate tab switches. Concurrent pings remain deduplicated. These events never request permissions or share an audit. The AI Integrations screen provides **View Shared Audits** after a successful share and refreshes the selected snapshot list after removal.

No vendor logo files are bundled. Anthropic's [Anthropic Trademark Guidelines](https://assets.claude.com/f7874b435aabdaee5f836e888b4439b9b56a934b.pdf) limit logo/mark use to specifically permitted assets supplied by Anthropic; no such approval or asset was available. OpenAI's [brand guidelines](https://openai.com/brand/) require exact, unmodified marks and prohibit implied endorsement; a Codex-specific asset with established redistribution terms was not available. The UI therefore uses the client names and a neutral integration icon.

### Linux development registration

Choose an existing dedicated directory. It is the same directory MCP will read; the native host does not create or search directories.

```sh
mkdir -p "$HOME/RankMiso/audits"
cargo build --release -p rankmiso-mcp --locked
```

Load the unpacked development extension, then copy its exact ID from `chrome://extensions` (Developer mode). This repository does not contain a confirmed Chrome Web Store extension ID, so none is guessed or placed in a production allowlist. Register Chrome with that exact ID:

```sh
python3 scripts/native-host/install.py install \
  --browser chrome \
  --extension-id EXACT_32_CHARACTER_CHROME_ID \
  --executable "$PWD/target/release/rankmiso-mcp-native-host" \
  --audit-dir "$HOME/RankMiso/audits"
```

For Chromium, use `--browser chromium`; its user-level manifest goes under `~/.config/chromium/NativeMessagingHosts/`. Chrome uses `~/.config/google-chrome/NativeMessagingHosts/`. Firefox registration uses its fixed add-on ID:

```sh
python3 scripts/native-host/install.py install \
  --browser firefox \
  --extension-id rankmiso@rankmiso.extension \
  --executable "$PWD/target/release/rankmiso-mcp-native-host" \
  --audit-dir "$HOME/RankMiso/audits"
```

The helper writes a user-level native host manifest and a 0600 config file at `${XDG_CONFIG_HOME:-$HOME/.config}/rankmiso-mcp/native-host.json`. The config contains the explicitly selected `auditDir`; the native process also accepts `RANKMISO_MCP_AUDIT_DIR` and `RANKMISO_MCP_NATIVE_CONFIG`. The browser process must inherit the same `XDG_CONFIG_HOME` when customized. The helper refuses to overwrite an existing host registration or a configuration that selects a different directory.

### Browser-specific Linux paths and isolated profiles

The native host name is `com.misoecosystem.rankmiso`; the filename must therefore be `com.misoecosystem.rankmiso.json`. User-level default locations differ by browser:

| Browser                        | Helper selector      | Linux user-level manifest directory                                                                        |
| ------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Google Chrome                  | `chrome`             | `${CHROME_CONFIG_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}}/google-chrome/NativeMessagingHosts/`             |
| Google Chrome for Testing 146+ | `chrome-for-testing` | `${CHROME_CONFIG_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}}/google-chrome-for-testing/NativeMessagingHosts/` |
| Chromium                       | `chromium`           | `${CHROME_CONFIG_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}}/chromium/NativeMessagingHosts/`                  |
| Firefox                        | `firefox`            | `$HOME/.mozilla/native-messaging-hosts/`                                                                   |

Chrome for Testing versions before 146 used Chrome's directory. Chrome documents separate Chrome, Chrome for Testing, and Chromium paths from 146 onward. Current Chromium derives `DIR_USER_NATIVE_MESSAGING` by appending `NativeMessagingHosts` to the effective user-data directory. Therefore a launch with `--user-data-dir=/isolated/profile` looks for `/isolated/profile/NativeMessagingHosts/`; changing `HOME` alone does not override it.

The failing Playwright `channel: "chromium"` executable was **Google Chrome for Testing 156.0.8078.4**. The isolated test used a custom profile but registered under Chromium's default directory, producing the exact API error `Specified native messaging host not found.` The corrected E2E now runs sandboxed **Google Chrome 156.0.8078.47** from `/usr/bin/google-chrome`, with extension ID `fefdclmdaficlhhagamdacojbkhickke`. The wrong registration was placed only in a temporary Chromium profile and reproduced the failure; registration under the active temporary Chrome profile's `NativeMessagingHosts/com.misoecosystem.rankmiso.json` allowed ping and share. Its 32,638-byte schema-version-1 snapshot was listed, retrieved, and removed through the existing MCP integration. No matching native-messaging lines were emitted in Chrome's narrowly enabled diagnostic log; the browser API lookup result is the direct diagnostic. The copied headless test extension pregrants the optional permission; native grant/deny/revocation prompts remain manual.

For an explicitly isolated Chromium profile, the helper supports `--user-data-dir` on install and uninstall. The directory must already exist; registration still refuses to overwrite any existing manifest. Keep the helper's `HOME`/`CHROME_CONFIG_HOME` temporary too, or explicitly set `RANKMISO_MCP_AUDIT_DIR` in the browser process environment. Never point this option at a normal profile. Firefox uses `allowed_extensions: ["rankmiso@rankmiso.extension"]`; it does not use Chromium's `allowed_origins` format.

System-wide defaults are `/etc/opt/chrome/native-messaging-hosts/` (Chrome), `/etc/opt/chrome_for_testing/native-messaging-hosts/` (Chrome for Testing), and `/etc/chromium/native-messaging-hosts/` (Chromium). The package installer creates per-user registrations on supported systems. The Python helper remains a Linux development utility.

To remove a default registration, use `python3 scripts/native-host/install.py uninstall --browser chrome` (or `chromium`/`firefox`). For an isolated custom profile, pass the same `--user-data-dir` used at install. This removes only that browser's RankMiso manifest. It leaves the config and approved audits unchanged; remove the config manually only after all browser registrations are removed. Shared JSON files can be removed in RankMiso Settings. The host reads no browser profiles or unrelated paths.

After registration, open RankMiso Settings and check/enable the companion. Open a page's full report, select Export, click **Share with MCP**, review the dialog, then approve. The new `rankmiso-shared-*.json` file becomes available through the existing MCP tools configured with the same `--audit-dir`. The extension and Rust host reject individual audit transfers over 900 KiB and page title/URL metadata over 1 KiB; use the normal JSON export as the fallback. No observations are truncated.

Native Messaging host manifests are different by browser: Chrome requires `allowed_origins` containing `chrome-extension://<exact-id>/`; Firefox requires `allowed_extensions` containing `rankmiso@rankmiso.extension`. The packaged installer generates the correct format for Chrome and Firefox. The browser allowlist limits which extension can launch the host, but it is not a complete OS sandbox; the host otherwise has the user's process privileges. Native builds, installer lifecycle, and host protocol passed on Linux, Windows x86_64, macOS ARM64, and macOS Intel. This does not verify browser-generated audit sharing on Windows/macOS or live Firefox communication.

For a browser error, distinguish host lookup from host launch and protocol errors. `Specified native messaging host not found.` means the browser did not find the named manifest in its selected lookup directory. `Access to the specified native messaging host is forbidden.` points to the extension identity allowlist. A host-startup/disconnect error means the manifest was found but the executable did not return a valid framed response; check the executable, inherited `HOME`/`XDG_CONFIG_HOME`, explicit native config, and stderr. Invalid protocol version/request IDs or a truncated frame are host protocol errors. Keep Chromium logging enabled in isolated diagnostics with `--enable-logging=stderr` and a narrow `--vmodule=native_messaging*=2,native_message_process_host*=2`; do not publish audit payloads in logs.

The installer's Windows per-user Chrome manifest path is registered through `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.misoecosystem.rankmiso`; Firefox uses `HKCU\Software\Mozilla\NativeMessagingHosts\com.misoecosystem.rankmiso`. On macOS, user manifests go under Chrome's `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/` or Firefox's `~/Library/Application Support/Mozilla/NativeMessagingHosts/`. The macOS manifests use the per-user directories listed above.

## Claude Code

Build the executable, choose an absolute export directory, then register the local stdio command:

```sh
claude mcp add --transport stdio rankmiso \
  --env RANKMISO_MCP_AUDIT_DIR=/absolute/path/to/rankmiso-exports \
  -- /absolute/path/to/rankmiso-mcp
```

On Windows, use the absolute `.exe` path and a Windows path for the directory. Check it with `claude mcp list`, `claude mcp get rankmiso`, or `/mcp` inside Claude Code. Remove it with `claude mcp remove rankmiso`. If startup fails, confirm that the configured folder exists, is readable, and contains exported `.json` files; inspect Claude's MCP connection details and the server's stderr. A close before `initialize` can be Claude's version probe; check whether Claude restarted the process and whether the later attempt connected. If your shell sandbox prevents stdio child-process startup, test from a normal local Claude Code session. No configuration is changed automatically by RankMiso.

## Codex

For the isolated browser-development flow above, use `pnpm mcp:codex`; it points the existing Rust server at the same temporary audit directory used by the Native Messaging host. The browser's Native Messaging connection and Codex's stdio MCP connection are separate: permission and a successful share do not register an MCP server in Codex. The launcher adds the server only to the Codex process it starts, without editing the normal config or disturbing other servers.

Add a local stdio server with the Codex CLI:

```sh
codex mcp add rankmiso \
  --env RANKMISO_MCP_AUDIT_DIR=/absolute/path/to/rankmiso-exports \
  -- /absolute/path/to/rankmiso-mcp
```

Then add `default_tools_approval_mode = "writes"` to the `[mcp_servers.rankmiso]` section in `~/.codex/config.toml`; this tells Codex to auto-approve only tools annotated as read-only and continue prompting for write-capable tools.

Or add this to `~/.codex/config.toml` (use a TOML-escaped absolute path):

```toml
[mcp_servers.rankmiso]
command = "/absolute/path/to/rankmiso-mcp"
args = []
default_tools_approval_mode = "writes"

[mcp_servers.rankmiso.env]
RANKMISO_MCP_AUDIT_DIR = "/absolute/path/to/rankmiso-exports"
```

Use the `.exe` path on Windows. Verify with `codex mcp list` or `/mcp` in the Codex TUI. Remove the entry with `codex mcp remove rankmiso` or delete its TOML section. If it does not connect, run the executable with `--help`, verify both absolute paths, and inspect stderr. RankMiso does not edit global Codex configuration.

The `writes` approval mode auto-approves tools marked read-only and still prompts for tools that can write. RankMiso marks all five tools as read-only, idempotent, non-destructive, and local-only. This avoids Codex CLI's `approval policy is never` failure when run non-interactively without weakening approval for write-capable tools.

## Privacy and security

The MCP tool process reads only direct `.json` regular files in the explicitly configured directory. It does not recurse, follow symlinks, read browser profiles, read saved History automatically, modify exports, access the network, launch a browser, crawl a website, or contact Miso servers. The separate native host is the only component that writes, and it writes only an explicitly approved, schema-validated audit snapshot with a RankMiso-managed filename in that same directory. Both processes enforce file/path bounds. MCP rejects invalid IDs, unsupported schemas, malformed JSON/UTF-8, paths outside the directory, and files larger than 5 MiB. It indexes at most 500 JSON files and reads at most 50 MiB across one listing scan. Tool pages are limited to 100 results, and structured responses to 512 KiB. File and JSON parsing are bounded; serde_json's recursion limit remains enabled. Native Messaging requests and responses are capped at 900 KiB.

The process runs with the operating-system privileges of the MCP client. Path checks do not form an OS sandbox. Use a dedicated export directory and, where needed, run the client under restricted filesystem permissions or an appropriate OS sandbox. Local stdio does not itself constrain filesystem privileges.

Titles, descriptions, links, structured data, and other text were collected from websites and must be treated as untrusted source content, never as tool instructions. RankMiso MCP preserves this provenance and does not execute or follow embedded instructions.

RankMiso MCP reads local exports and does not transmit them to Miso Ecosystem servers. However, your connected AI assistant may process retrieved audit information through its configured model provider, depending on that client's settings and privacy policy. A local MCP server does not guarantee local-only AI processing.

## Limits and follow-up

On 2026-10-31 the isolated Google Chrome 156.0.8078.47 sharing E2E was rerun after the bounded permission-waiting UI changes. It passed host discovery, ping, cancellation without a file, explicit share, schema-v1 persistence, all five existing MCP tools, managed removal and post-removal retrieval failure. The test copy pregranted `nativeMessaging`; this is not runtime permission grant/denial/revocation evidence. A later visible run showed **Permission Required → Awaiting Permission** and the user-facing prompt guidance; its window closed before a permission grant was observed. The optional permission lifecycle and the new Chrome extension-reload recovery remain unverified in a live run.

MCP sharing ships in the v0.5.0 extension. The notes in this section are the original development verification. The stdio protocol passes local tests for both the legacy `initialize` lifecycle and modern `server/discover` lifecycle. Claude Code 2.1.314 connected and invoked all five tools against synthetic audit and crawl exports. Its first sandboxed health check reported `CONNECTION_CLOSED`; debug output showed the server process had started, then stdin was closed before any MCP request during Claude's version-negotiation probe. The SDK reported this as a pre-initialize transport closure; Claude attempted its legacy restart. Outside the restrictive shell sandbox, Claude reported **Connected** and invoked all tools. This was a test-environment process restriction, not a RankMiso protocol failure. Codex CLI 0.166.0 also invoked all five tools against the same synthetic exports after RankMiso marked them read-only and the isolated Codex configuration used its documented `writes` approval mode.

As of 2026-11-02, PR #28 native CI passed on Linux x86_64, Windows x86_64, macOS ARM64, and macOS Intel. These native jobs verify compilation, Rust tests, archive contents and checksums, installer lifecycle, Native Messaging registration/protocol handshake, and local MCP protocol tests; they do not verify browser-generated audit sharing. The latest repository Rust and extension CI also passed on the same PR head. See the [MCP companion workflow](https://github.com/EdeesonOpina/rankmiso/actions/runs/41270512259) and [repository CI](https://github.com/EdeesonOpina/rankmiso/actions/runs/41270512246). Artifacts are temporary Actions artifacts, not public downloads.

The isolated sandboxed Google Chrome 156.0.8078.47 test verifies a real Native Messaging ping, explicit share acknowledgment, schema-version-1 file persistence, all five existing MCP tool calls, and removal. It reproduces host-not-found with a registration in the wrong isolated profile, then passes with the active profile. Its copied test manifest pregrants the optional permission. This test used a development extension ID; production Chrome ID integration and the Chrome permission grant, denial, and revocation flows remain unverified. A separate fresh-profile permission attempt started from `nativeMessaging` absent; the Settings button invoked `permissions.request`, but the browser left it pending and no decision was observed. The UI has a bounded waiting state and permission recheck, covered by Vitest; real grant, denial, and revocation remain unverified because this environment could not operate the browser prompt.

Windows and macOS browser runtime behavior is not established by native CI. An official Mozilla Firefox 159.0 binary was extracted under `/tmp`, and geckodriver 0.37.1 installed the built extension temporarily with ID `rankmiso@rankmiso.extension`. Standard WebDriver navigation to `moz-extension:` and `about:debugging` was rejected; accessing the privileged browser context required `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1`, which was not enabled. The Firefox manifest was separately installed and removed under an isolated HOME at `$HOME/.mozilla/native-messaging-hosts/`, with the exact `allowed_extensions` identity, but Firefox-to-host communication, sharing, retrieval, and deletion were not verified. History exports are deliberately unsupported by these tools because they contain summaries, not complete audits. The server performs no SEO analysis itself, exposes no search traffic/ranking/backlink/index-coverage/rich-result measurements, and never applies fixes.

Release-mode synthetic measurements on Linux (20 generated audit exports; 20 repetitions per tool) were: listing 20 exports 4.659 ms average, audit retrieval 0.545 ms, issues 0.264 ms, and comparison 0.551 ms. Across 20 fresh server processes, time from launch to initialize response averaged 1.822 ms (1.411–3.554 ms). A waiting server process used 4.740 MiB RSS after 500 ms. These local samples are directional, not cross-platform or production guarantees. Files larger than 5 MiB are rejected in tests; large-file rejection latency was not separately benchmarked.
