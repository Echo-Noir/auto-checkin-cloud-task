import { platformRequest } from "./http.js";

const PLATFORM = "https://baizhi.cloud";
const SESSION = "baizhi_session";
const SL = "sl-session";

export function normalizeBaizhiCookie(raw: string): string | undefined {
  let text = raw.trim().replace(/^cookie\s*:\s*/i, "").trim();
  if (text.length === 0) return undefined;
  if (text.includes("=")) {
    const parts = text.split(";").map((p) => p.trim()).filter(Boolean);
    const picked: string[] = [];
    for (const name of [SESSION, SL]) {
      const hit = parts.find((p) => p.toLowerCase().startsWith(`${name}=`));
      if (hit) picked.push(`${name}=${hit.slice(name.length + 1)}`);
    }
    if (picked.length > 0) return picked.join("; ");
    if (parts.length === 1) {
      const eq = text.indexOf("=");
      return `${SESSION}=${text.slice(eq + 1)}`;
    }
  }
  return `${SESSION}=${text}`;
}

export async function getBaizhiWallet(cookieHeader: string) {
  return platformRequest(cookieHeader, PLATFORM, "/api/v1/user/wallet/balance", { method: "GET" });
}

export async function postBaizhiChallenge(cookieHeader: string) {
  return platformRequest(cookieHeader, PLATFORM, "/api/v1/public/captcha/challenge", {
    method: "POST",
    body: {},
  });
}

export async function postBaizhiRedeem(cookieHeader: string, token: string, solutions: number[]) {
  return platformRequest(cookieHeader, PLATFORM, "/api/v1/public/captcha/redeem", {
    method: "POST",
    body: { token, solutions },
  });
}

export async function postDailyCredit(cookieHeader: string, captchaToken: string) {
  return platformRequest(cookieHeader, PLATFORM, "/api/v1/user/wallet/daily-temporary-credit", {
    method: "POST",
    body: { captcha_token: captchaToken },
  });
}

export function readTemporaryCredit(data: unknown): number | undefined {
  if (data === null || typeof data !== "object") return undefined;
  const cents = Number((data as { temporary_credit_cents?: unknown }).temporary_credit_cents);
  if (!Number.isFinite(cents)) return undefined;
  return Math.round(cents) / 100;
}

export function isDailyClaimed(data: unknown): boolean {
  return (
    data !== null &&
    typeof data === "object" &&
    (data as { daily_temporary_credit_claimed?: unknown }).daily_temporary_credit_claimed === true
  );
}
