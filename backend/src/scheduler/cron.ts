import cron from "node-cron";
import parser from "cron-parser";
import { getData } from "../store/jsonStore.js";
import { runCheckin } from "../checkin/executor.js";

const jobs = new Map<string, cron.ScheduledTask>();

export function isValidCron(expr: string): boolean {
  return cron.validate(expr);
}

export function nextRunAt(expr: string, timezone: string): string | null {
  try {
    const it = parser.parseExpression(expr, { tz: timezone });
    return it.next().toISOString();
  } catch {
    return null;
  }
}

export function stopJob(accountId: string): void {
  const job = jobs.get(accountId);
  if (job) {
    job.stop();
    jobs.delete(accountId);
  }
}

export function startJob(accountId: string, expr: string, timezone: string): void {
  stopJob(accountId);
  if (!cron.validate(expr)) return;
  const job = cron.schedule(
    expr,
    () => {
      void runCheckin(accountId).catch(() => undefined);
    },
    { timezone },
  );
  jobs.set(accountId, job);
}

export function restoreJobs(): void {
  for (const accountId of jobs.keys()) {
    stopJob(accountId);
  }
  const data = getData();
  for (const task of data.tasks) {
    if (!task.enabled) continue;
    const account = data.accounts.find((a) => a.id === task.accountId);
    if (!account || !account.enabled) continue;
    startJob(task.accountId, task.cron, task.timezone);
  }
}

export function syncAccountJobs(accountId: string): void {
  const data = getData();
  const account = data.accounts.find((a) => a.id === accountId);
  const task = data.tasks.find((t) => t.accountId === accountId);
  if (!account || !account.enabled || !task || !task.enabled) {
    stopJob(accountId);
    return;
  }
  startJob(accountId, task.cron, task.timezone);
}
