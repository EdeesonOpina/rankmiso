import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { codexArgs, findActiveSession } from "./codex-session.mjs";

const repository = resolve(fileURLToPath(new URL("../..", import.meta.url)));

test("finds the active private session and configures Codex for its exact audit directory", async () => {
  const temp = await mkdtemp(join(tmpdir(), "rankmiso-mcp-codex-test-"));
  const privateTmp = join(temp, "tmp");
  const sessionRoot = join(privateTmp, "rankmiso-mcp-dev-test");
  const auditDir = join(sessionRoot, "audits");
  const mcpExecutable = join(repository, "target/release/rankmiso-mcp");
  await mkdir(auditDir, { recursive: true, mode: 0o700 });
  await chmod(privateTmp, 0o700);
  await chmod(sessionRoot, 0o700);
  const metadataPath = join(sessionRoot, "codex-session.json");
  await writeFile(
    metadataPath,
    JSON.stringify({
      schemaVersion: 1,
      processId: process.pid,
      sessionRoot,
      auditDir,
      mcpExecutable,
    }),
    { mode: 0o600 },
  );

  try {
    const session = await findActiveSession(privateTmp);
    const args = codexArgs(session);
    assert.deepEqual(session, { auditDir, mcpExecutable });
    assert.equal((await stat(sessionRoot)).mode & 0o077, 0);
    assert.equal((await stat(metadataPath)).mode & 0o077, 0);
    assert.ok(args.includes(repository));
    assert.ok(args.includes(`mcp_servers.rankmiso.command=${JSON.stringify(mcpExecutable)}`));
    assert.ok(
      args.includes(`mcp_servers.rankmiso.env.RANKMISO_MCP_AUDIT_DIR=${JSON.stringify(auditDir)}`),
    );
    assert.ok(args.includes('mcp_servers.rankmiso.default_tools_approval_mode="writes"'));
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
