import { Router } from "express";
import { BusyError, runCheckin } from "../checkin/executor.js";
import { isValidCron, nextRunAt, syncAccountJobs } from "../scheduler/cron.js";
import { getData, mutate } from "../store/jsonStore.js";
import { fail, newId, nowIso, ok } from "../util.js";
import type { TaskPublic } from "../types.js";

export const tasksRouter = Router();

function toPublic(): TaskPublic[] {
  return getData().tasks.map((task) => ({
    ...task,
    nextRunAt: task.enabled ? nextRunAt(task.cron, task.timezone) : null,
  }));
}

tasksRouter.get("/", (_req, res) => {
  res.json(ok({ tasks: toPublic() }));
});

tasksRouter.put("/:accountId", async (req, res) => {
  const { accountId } = req.params;
  const account = getData().accounts.find((a) => a.id === accountId);
  if (!account) {
    res.status(404).json(fail("账号不存在"));
    return;
  }
  const cronExpr = typeof req.body?.cron === "string" ? req.body.cron.trim() : "";
  const timezone =
    typeof req.body?.timezone === "string" && req.body.timezone.trim()
      ? req.body.timezone.trim()
      : "Asia/Shanghai";
  const enabled = req.body?.enabled !== false;
  if (!isValidCron(cronExpr)) {
    res.status(400).json(fail("Cron 表达式格式无效"));
    return;
  }
  await mutate((store) => {
    const existing = store.tasks.find((t) => t.accountId === accountId);
    const ts = nowIso();
    if (existing) {
      existing.cron = cronExpr;
      existing.timezone = timezone;
      existing.enabled = enabled;
      existing.updatedAt = ts;
    } else {
      store.tasks.push({
        id: newId("task"),
        accountId,
        cron: cronExpr,
        timezone,
        enabled,
        updatedAt: ts,
      });
    }
  });
  syncAccountJobs(accountId);
  res.json(ok({ accountId, nextRunAt: enabled ? nextRunAt(cronExpr, timezone) : null }));
});

tasksRouter.post("/:accountId/run", async (req, res) => {
  const { accountId } = req.params;
  const account = getData().accounts.find((a) => a.id === accountId);
  if (!account) {
    res.status(404).json(fail("账号不存在"));
    return;
  }
  try {
    const result = await runCheckin(accountId);
    res.json(ok(result));
  } catch (err) {
    if (err instanceof BusyError) {
      res.status(409).json(fail(err.message));
      return;
    }
    res.status(500).json(fail(err instanceof Error ? err.message : String(err)));
  }
});
