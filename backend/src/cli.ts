import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getData, loadStore, mutate } from "./store/jsonStore.js";
import { runCheckin, type RunResult } from "./checkin/executor.js";
import type { SiteId } from "./types.js";
import { newId, nowIso } from "./util.js";

const DEFAULT_CRON = "0 8 * * *";
const DEFAULT_TZ = "Asia/Shanghai";

type Target = {
  site: SiteId;
  name: string;
  credential: string;
};

function collectTargets(): Target[] {
  const monkey =
    process.env.MONKEYCODE_SESSION?.trim() || process.env.MONKEYCODE_COOKIE?.trim() || "";
  const baizhi = process.env.BAIZHI_SESSION?.trim() || process.env.BAIZHI_COOKIE?.trim() || "";
  const targets: Target[] = [];
  if (monkey) {
    targets.push({
      site: "monkeycode-cn",
      name: "ci-monkeycode",
      credential: monkey,
    });
  }
  if (baizhi) {
    targets.push({
      site: "baizhi",
      name: "ci-baizhi",
      credential: baizhi,
    });
  }
  return targets;
}

async function ensureAccount(target: Target): Promise<string> {
  const existing = getData().accounts.find((a) => a.site === target.site && a.enabled);
  if (existing) {
    if (existing.credential !== target.credential) {
      await mutate((data) => {
        const acc = data.accounts.find((a) => a.id === existing.id);
        if (acc) {
          acc.credential = target.credential;
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
      name: target.name,
      site: target.site,
      credential: target.credential,
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

await loadStore();
const targets = collectTargets();
if (targets.length === 0) {
  throw new Error("缺少环境变量 MONKEYCODE_SESSION 或 BAIZHI_SESSION（也可用 *_COOKIE）");
}

const results: { site: SiteId; accountId: string; result: RunResult }[] = [];
let failed = false;
for (const target of targets) {
  const accountId = await ensureAccount(target);
  const result = await runCheckin(accountId);
  const summary = `${target.site} ${result.status} pointsDelta=${result.pointsDelta}${result.error ? ` error=${result.error}` : ""}`;
  console.log(summary);
  results.push({ site: target.site, accountId, result });
  if (result.status === "failed" || result.status === "auth_failed") failed = true;
}

const outDir = path.resolve("data");
await mkdir(outDir, { recursive: true });
const stamp = nowIso();
await writeFile(
  path.join(outDir, "last-run.json"),
  JSON.stringify({ at: stamp, results }, null, 2),
  "utf8",
);

try {
  const logFile = path.join(outDir, "cli.log");
  const prev = await readFile(logFile, "utf8").catch(() => "");
  const lines = results
    .map(
      ({ site, result }) =>
        `${stamp} ${site} ${result.status} pointsDelta=${result.pointsDelta}${result.error ? ` error=${result.error}` : ""}`,
    )
    .join("\n");
  await writeFile(logFile, `${prev}${lines}\n`, "utf8");
} catch {
  /* ignore */
}

if (failed) process.exit(1);
