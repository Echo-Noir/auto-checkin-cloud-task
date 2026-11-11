import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadStore, mutate } from "./store/jsonStore.js";
import { runCheckin } from "./checkin/executor.js";
import { newId, nowIso } from "./util.js";

const DEFAULT_CRON = "0 8 * * *";
const DEFAULT_TZ = "Asia/Shanghai";

function envCredential(): string {
  const fromEnv =
    process.env.MONKEYCODE_SESSION?.trim() ||
    process.env.MONKEYCODE_COOKIE?.trim() ||
    "";
  return fromEnv;
}

async function ensureAccountFromEnv(): Promise<string> {
  await loadStore();
  const credential = envCredential();
  if (!credential) {
    throw new Error("缺少环境变量 MONKEYCODE_SESSION（或 MONKEYCODE_COOKIE）");
  }
  const { getData } = await import("./store/jsonStore.js");
  const existing = getData().accounts.find((a) => a.enabled);
  if (existing) {
    if (existing.credential !== credential) {
      await mutate((data) => {
        const acc = data.accounts.find((a) => a.id === existing.id);
        if (acc) {
          acc.credential = credential;
          acc.updatedAt = nowIso();
        }
      });
    }
    return existing.id;
  }
  const ts = nowIso();
  const id = newId("acc");
  await mutate((data) => {
    data.accounts.push({
      id,
      name: "ci",
      site: "monkeycode-cn",
      credential,
      enabled: true,
      createdAt: ts,
      updatedAt: ts,
    });
    data.tasks.push({
      id: newId("task"),
      accountId: id,
      cron: DEFAULT_CRON,
      timezone: DEFAULT_TZ,
      enabled: true,
      updatedAt: ts,
    });
  });
  return id;
}

const accountId = await ensureAccountFromEnv();
const result = await runCheckin(accountId);
const summary = `${result.status} pointsDelta=${result.pointsDelta}${result.error ? ` error=${result.error}` : ""}`;
console.log(summary);

const outDir = path.resolve("data");
await mkdir(outDir, { recursive: true });
const stamp = nowIso();
await writeFile(
  path.join(outDir, "last-run.json"),
  JSON.stringify({ at: stamp, accountId, ...result }, null, 2),
  "utf8",
);

try {
  const logFile = path.join(outDir, "cli.log");
  const prev = await readFile(logFile, "utf8").catch(() => "");
  await writeFile(logFile, `${prev}${stamp} ${summary}\n`, "utf8");
} catch {
  /* ignore */
}

if (result.status === "failed" || result.status === "auth_failed") {
  process.exit(1);
}
