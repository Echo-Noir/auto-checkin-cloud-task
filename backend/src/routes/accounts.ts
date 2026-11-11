import { Router } from "express";
import { getData, isCorrupted, mutate } from "../store/jsonStore.js";
import { fail, isBlank, maskCredential, newId, nowIso, ok } from "../util.js";
import { isSiteId, type AccountPublic, type SiteId } from "../types.js";
import { nextRunAt, stopJob, syncAccountJobs } from "../scheduler/cron.js";

export const accountsRouter = Router();

function toPublic(): AccountPublic[] {
  const data = getData();
  return data.accounts.map((account) => {
    const task = data.tasks.find((t) => t.accountId === account.id && t.enabled);
    const last = [...data.records].reverse().find((r) => r.accountId === account.id);
    return {
      id: account.id,
      name: account.name,
      site: account.site,
      enabled: account.enabled,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      credentialMasked: maskCredential(account.credential),
      lastStatus: last ? last.status : null,
      nextRunAt: task && account.enabled ? nextRunAt(task.cron, task.timezone) : null,
    };
  });
}

accountsRouter.get("/", (_req, res) => {
  res.json(
    ok({
      accounts: toPublic(),
      corrupted: isCorrupted(),
    }),
  );
});

accountsRouter.post("/", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const credential = typeof req.body?.credential === "string" ? req.body.credential : "";
  const enabled = req.body?.enabled !== false;
  const site: SiteId = isSiteId(req.body?.site) ? req.body.site : "monkeycode-cn";
  if (isBlank(credential)) {
    res.status(400).json(fail("会话凭证不能为空"));
    return;
  }
  const ts = nowIso();
  const account = {
    id: newId("acc"),
    name: name || "未命名账号",
    site,
    credential: credential.trim(),
    enabled,
    createdAt: ts,
    updatedAt: ts,
  };
  await mutate((data) => {
    data.accounts.push(account);
  });
  syncAccountJobs(account.id);
  res.json(ok({ id: account.id }));
});

accountsRouter.put("/:id", async (req, res) => {
  const { id } = req.params;
  const data = getData();
  const existing = data.accounts.find((a) => a.id === id);
  if (!existing) {
    res.status(404).json(fail("账号不存在"));
    return;
  }
  if (req.body?.credential !== undefined && isBlank(req.body.credential)) {
    res.status(400).json(fail("会话凭证不能为空"));
    return;
  }
  await mutate((store) => {
    const acc = store.accounts.find((a) => a.id === id);
    if (!acc) return;
    if (typeof req.body?.name === "string" && req.body.name.trim()) acc.name = req.body.name.trim();
    if (typeof req.body?.credential === "string") acc.credential = req.body.credential.trim();
    if (typeof req.body?.enabled === "boolean") acc.enabled = req.body.enabled;
    if (isSiteId(req.body?.site)) acc.site = req.body.site;
    acc.updatedAt = nowIso();
  });
  syncAccountJobs(id);
  res.json(ok({ id }));
});

accountsRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const existing = getData().accounts.find((a) => a.id === id);
  if (!existing) {
    res.status(404).json(fail("账号不存在"));
    return;
  }
  stopJob(id);
  await mutate((store) => {
    store.accounts = store.accounts.filter((a) => a.id !== id);
    store.tasks = store.tasks.filter((t) => t.accountId !== id);
  });
  res.json(ok({ id }));
});
