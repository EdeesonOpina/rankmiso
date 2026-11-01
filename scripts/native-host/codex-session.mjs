import { access, lstat, readFile, readdir, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sessionPrefix = "rankmiso-mcp-dev-";
const sessionFile = "codex-session.json";

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function readActiveSession(root) {
  const rootStat = await lstat(root);
  if (
    !rootStat.isDirectory() ||
    rootStat.uid !== process.getuid?.() ||
    (rootStat.mode & 0o077) !== 0
  ) {
    throw new Error("The active RankMiso session directory is not private and owned by this user.");
  }

  const metadataPath = join(root, sessionFile);
  const metadataStat = await lstat(metadataPath);
  if (
    !metadataStat.isFile() ||
    metadataStat.uid !== process.getuid?.() ||
    (metadataStat.mode & 0o077) !== 0
  ) {
    throw new Error("The active RankMiso Codex session metadata is not private.");
  }

  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  const sessionRoot = await realpath(root);
  const auditDir = join(sessionRoot, "audits");
  const mcpExecutable = join(repository, "target/release/rankmiso-mcp");
  if (
    metadata.schemaVersion !== 1 ||
    metadata.sessionRoot !== sessionRoot ||
    metadata.auditDir !== auditDir ||
    metadata.mcpExecutable !== mcpExecutable ||
    !Number.isSafeInteger(metadata.processId) ||
    metadata.processId <= 0
  ) {
    throw new Error("The active RankMiso Codex session metadata is invalid.");
  }
  if (!isProcessRunning(metadata.processId)) return null;

  const auditStat = await lstat(auditDir);
  const executableStat = await lstat(mcpExecutable);
  if (!auditStat.isDirectory() || executableStat.isSymbolicLink() || !executableStat.isFile()) {
    throw new Error("The active audit directory or RankMiso MCP executable is unavailable.");
  }
  await access(auditDir, constants.R_OK | constants.X_OK);
  await access(mcpExecutable, constants.X_OK);
  return { auditDir, mcpExecutable };
}

export async function findActiveSession(directory = tmpdir()) {
  const sessions = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.name.startsWith(sessionPrefix) || !entry.isDirectory()) continue;
    const root = join(directory, entry.name);
    try {
      const session = await readActiveSession(root);
      if (session) sessions.push(session);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  if (sessions.length === 0) {
    throw new Error(
      "No active isolated RankMiso session. Start `pnpm mcp:dev` and leave Chrome open.",
    );
  }
  if (sessions.length > 1) {
    throw new Error(
      "More than one RankMiso dev session is active. Close the extra Chrome sessions and retry.",
    );
  }
  return sessions[0];
}

export function codexArgs(session, additionalArgs = []) {
  const overrides = [
    `mcp_servers.rankmiso.command=${JSON.stringify(session.mcpExecutable)}`,
    "mcp_servers.rankmiso.args=[]",
    `mcp_servers.rankmiso.env.RANKMISO_MCP_AUDIT_DIR=${JSON.stringify(session.auditDir)}`,
    'mcp_servers.rankmiso.default_tools_approval_mode="writes"',
  ];
  return ["-C", repository, ...overrides.flatMap((value) => ["-c", value]), ...additionalArgs];
}

async function main() {
  try {
    const session = await findActiveSession();
    console.log("Starting Codex with the active isolated RankMiso MCP session.");
    console.log(
      "This adds a per-process stdio server connection; your Codex config file is unchanged.",
    );
    await new Promise((resolveExit, reject) => {
      const codex = spawn("codex", codexArgs(session, process.argv.slice(2)), { stdio: "inherit" });
      codex.once("error", reject);
      codex.once("exit", (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
    }).then((code) => {
      process.exitCode = code;
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Could not start connected Codex.");
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
