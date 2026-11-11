import { getData, mutate } from "../store/jsonStore.js";
import type { RecordStatus } from "../types.js";
import { newId, nowIso, redact } from "../util.js";
import {
  getCheckinStatus,
  getWallet,
  normalizeCookie,
  postChallenge,
  postCheckin,
  postRedeem,
  readBalance,
} from "./client.js";
import { readChallenge, solveChallengeYielding } from "./pow.js";

const locks = new Set<string>();

export class BusyError extends Error {
  constructor() {
    super("该账号签到正在进行");
    this.name = "BusyError";
  }
}

export type RunResult = {
  status: RecordStatus;
  pointsDelta: number;
  error: string | null;
};

function note(accountId: string, startedAt: string, result: RunResult) {
  return mutate((data) => {
    data.records.push({
      id: newId("rec"),
      accountId,
      startedAt,
      finishedAt: nowIso(),
      status: result.status,
      pointsDelta: result.pointsDelta,
      error: result.error,
    });
  });
}

async function execute(accountId: string, credential: string): Promise<RunResult> {
  const cookie = normalizeCookie(credential);
  if (!cookie) {
    return { status: "failed", pointsDelta: 0, error: "会话凭证不能为空" };
  }

  const statusRes = await getCheckinStatus(cookie);
  if (!statusRes.ok) {
    if (statusRes.unauthorized) {
      return { status: "auth_failed", pointsDelta: 0, error: "凭证失效" };
    }
    return { status: "failed", pointsDelta: 0, error: redact(statusRes.error, credential) };
  }
  const checkedIn =
    statusRes.data !== null &&
    typeof statusRes.data === "object" &&
    (statusRes.data as { checked_in?: unknown }).checked_in === true;
  if (checkedIn) {
    return { status: "skipped", pointsDelta: 0, error: null };
  }

  const challengeRes = await postChallenge(cookie);
  if (!challengeRes.ok) {
    if (challengeRes.unauthorized) {
      return { status: "auth_failed", pointsDelta: 0, error: "凭证失效" };
    }
    return { status: "failed", pointsDelta: 0, error: redact(challengeRes.error, credential) };
  }
  const parsed = readChallenge(challengeRes.data);
  if ("error" in parsed) {
    return { status: "failed", pointsDelta: 0, error: parsed.error };
  }

  let solutions: number[];
  try {
    solutions = await solveChallengeYielding(parsed.token, parsed.challenge);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "failed", pointsDelta: 0, error: msg };
  }

  const redeemRes = await postRedeem(cookie, parsed.token, solutions);
  if (!redeemRes.ok) {
    if (redeemRes.unauthorized) {
      return { status: "auth_failed", pointsDelta: 0, error: "凭证失效" };
    }
    return { status: "failed", pointsDelta: 0, error: redact(redeemRes.error, credential) };
  }
  const redeemData = redeemRes.data as { token?: unknown; success?: unknown } | null;
  const captchaToken =
    redeemData && typeof redeemData.token === "string" ? redeemData.token.trim() : "";
  if (captchaToken.length === 0 || redeemData?.success === false) {
    return { status: "failed", pointsDelta: 0, error: "captcha_invalid" };
  }

  const walletBefore = await getWallet(cookie);
  const before = walletBefore.ok ? readBalance(walletBefore.data) : undefined;

  const checkinRes = await postCheckin(cookie, captchaToken);
  if (!checkinRes.ok) {
    if (checkinRes.unauthorized) {
      return { status: "auth_failed", pointsDelta: 0, error: "凭证失效" };
    }
    return { status: "failed", pointsDelta: 0, error: redact(checkinRes.error, credential) };
  }

  const walletAfter = await getWallet(cookie);
  const after = walletAfter.ok ? readBalance(walletAfter.data) : undefined;
  if (before === undefined || after === undefined) {
    return { status: "success", pointsDelta: 0, error: "余额读取失败" };
  }
  const delta = Math.round((after - before) * 1000) / 1000;
  return { status: "success", pointsDelta: delta > 0 ? delta : 0, error: null };
}

export async function runCheckin(accountId: string): Promise<RunResult> {
  if (locks.has(accountId)) {
    throw new BusyError();
  }
  locks.add(accountId);
  const startedAt = nowIso();
  try {
    const account = getData().accounts.find((a) => a.id === accountId);
    if (!account) {
      const result: RunResult = { status: "failed", pointsDelta: 0, error: "账号不存在" };
      await note(accountId, startedAt, result);
      return result;
    }
    const result = await execute(accountId, account.credential);
    await note(accountId, startedAt, result);
    return result;
  } catch (err) {
    const result: RunResult = {
      status: "failed",
      pointsDelta: 0,
      error: redact(err instanceof Error ? err.message : String(err)),
    };
    await note(accountId, startedAt, result);
    return result;
  } finally {
    locks.delete(accountId);
  }
}

export function isBusy(accountId: string): boolean {
  return locks.has(accountId);
}
