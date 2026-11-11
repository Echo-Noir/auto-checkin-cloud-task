import { getData, mutate } from "../store/jsonStore.js";
import type { RecordStatus, SiteId } from "../types.js";
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
import {
  getBaizhiWallet,
  isDailyClaimed,
  normalizeBaizhiCookie,
  postBaizhiChallenge,
  postBaizhiRedeem,
  postDailyCredit,
  readTemporaryCredit,
} from "./baizhi.js";
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

function failAuth(): RunResult {
  return { status: "auth_failed", pointsDelta: 0, error: "凭证失效" };
}

function failMsg(error: string, credential: string): RunResult {
  return { status: "failed", pointsDelta: 0, error: redact(error, credential) };
}

async function solveCaptcha(
  credential: string,
  challengeRes: Awaited<ReturnType<typeof postChallenge>>,
  redeem: (token: string, solutions: number[]) => ReturnType<typeof postRedeem>,
): Promise<{ ok: true; captchaToken: string } | { ok: false; result: RunResult }> {
  if (!challengeRes.ok) {
    if (challengeRes.unauthorized) return { ok: false, result: failAuth() };
    return { ok: false, result: failMsg(challengeRes.error, credential) };
  }
  const parsed = readChallenge(challengeRes.data);
  if ("error" in parsed) {
    return { ok: false, result: { status: "failed", pointsDelta: 0, error: parsed.error } };
  }
  let solutions: number[];
  try {
    solutions = await solveChallengeYielding(parsed.token, parsed.challenge);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, result: { status: "failed", pointsDelta: 0, error: msg } };
  }
  const redeemRes = await redeem(parsed.token, solutions);
  if (!redeemRes.ok) {
    if (redeemRes.unauthorized) return { ok: false, result: failAuth() };
    return { ok: false, result: failMsg(redeemRes.error, credential) };
  }
  const redeemData = redeemRes.data as { token?: unknown; success?: unknown } | null;
  const captchaToken =
    redeemData && typeof redeemData.token === "string" ? redeemData.token.trim() : "";
  if (captchaToken.length === 0 || redeemData?.success === false) {
    return { ok: false, result: { status: "failed", pointsDelta: 0, error: "captcha_invalid" } };
  }
  return { ok: true, captchaToken };
}

async function executeMonkeyCode(credential: string): Promise<RunResult> {
  const cookie = normalizeCookie(credential);
  if (!cookie) {
    return { status: "failed", pointsDelta: 0, error: "会话凭证不能为空" };
  }

  const statusRes = await getCheckinStatus(cookie);
  if (!statusRes.ok) {
    if (statusRes.unauthorized) return failAuth();
    return failMsg(statusRes.error, credential);
  }
  const checkedIn =
    statusRes.data !== null &&
    typeof statusRes.data === "object" &&
    (statusRes.data as { checked_in?: unknown }).checked_in === true;
  if (checkedIn) {
    return { status: "skipped", pointsDelta: 0, error: null };
  }

  const captcha = await solveCaptcha(credential, await postChallenge(cookie), (token, solutions) =>
    postRedeem(cookie, token, solutions),
  );
  if (!captcha.ok) return captcha.result;

  const walletBefore = await getWallet(cookie);
  const before = walletBefore.ok ? readBalance(walletBefore.data) : undefined;

  const checkinRes = await postCheckin(cookie, captcha.captchaToken);
  if (!checkinRes.ok) {
    if (checkinRes.unauthorized) return failAuth();
    return failMsg(checkinRes.error, credential);
  }

  const walletAfter = await getWallet(cookie);
  const after = walletAfter.ok ? readBalance(walletAfter.data) : undefined;
  if (before === undefined || after === undefined) {
    return { status: "success", pointsDelta: 0, error: "余额读取失败" };
  }
  const delta = Math.round((after - before) * 1000) / 1000;
  return { status: "success", pointsDelta: delta > 0 ? delta : 0, error: null };
}

async function executeBaizhi(credential: string): Promise<RunResult> {
  const cookie = normalizeBaizhiCookie(credential);
  if (!cookie) {
    return { status: "failed", pointsDelta: 0, error: "会话凭证不能为空" };
  }

  const walletBefore = await getBaizhiWallet(cookie);
  if (!walletBefore.ok) {
    if (walletBefore.unauthorized) return failAuth();
    return failMsg(walletBefore.error, credential);
  }
  if (isDailyClaimed(walletBefore.data)) {
    return { status: "skipped", pointsDelta: 0, error: null };
  }

  const captcha = await solveCaptcha(
    credential,
    await postBaizhiChallenge(cookie),
    (token, solutions) => postBaizhiRedeem(cookie, token, solutions),
  );
  if (!captcha.ok) return captcha.result;

  const claimRes = await postDailyCredit(cookie, captcha.captchaToken);
  if (!claimRes.ok) {
    if (claimRes.unauthorized) return failAuth();
    return failMsg(claimRes.error, credential);
  }
  const claimed =
    claimRes.data !== null &&
    typeof claimRes.data === "object" &&
    (claimRes.data as { claimed?: unknown }).claimed;
  if (claimed === false) {
    return { status: "skipped", pointsDelta: 0, error: null };
  }
  if (claimed !== true) {
    return { status: "failed", pointsDelta: 0, error: "领取响应缺少 claimed" };
  }

  const before = readTemporaryCredit(walletBefore.data);
  const walletAfter = await getBaizhiWallet(cookie);
  const after = walletAfter.ok ? readTemporaryCredit(walletAfter.data) : undefined;
  if (before === undefined || after === undefined) {
    return { status: "success", pointsDelta: 0, error: "余额读取失败" };
  }
  const delta = Math.round((after - before) * 100) / 100;
  return { status: "success", pointsDelta: delta > 0 ? delta : 0, error: null };
}

async function execute(site: SiteId, credential: string): Promise<RunResult> {
  if (site === "baizhi") return executeBaizhi(credential);
  return executeMonkeyCode(credential);
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
    const result = await execute(account.site, account.credential);
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
