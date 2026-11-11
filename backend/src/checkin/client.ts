import { platformRequest, type PlatformResult } from "./http.js";

const PLATFORM = "https://monkeycode-ai.com";
const COOKIE_NAME = "monkeycode_ai_session";

export type { PlatformResult };

export function normalizeCookie(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.includes("=")) {
    const parts = trimmed.split(";").map((p) => p.trim()).filter(Boolean);
    const hit = parts.find((p) => p.toLowerCase().startsWith(`${COOKIE_NAME}=`));
    if (hit) return `${COOKIE_NAME}=${hit.slice(COOKIE_NAME.length + 1)}`;
    if (parts.length === 1) {
      const eq = trimmed.indexOf("=");
      return `${COOKIE_NAME}=${trimmed.slice(eq + 1)}`;
    }
  }
  return `${COOKIE_NAME}=${trimmed}`;
}

export async function getCheckinStatus(cookieHeader: string) {
  return platformRequest(cookieHeader, PLATFORM, "/api/v1/users/wallet/checkin", { method: "GET" });
}

export async function getWallet(cookieHeader: string) {
  return platformRequest(cookieHeader, PLATFORM, "/api/v1/users/wallet", { method: "GET" });
}

export async function postChallenge(cookieHeader: string) {
  return platformRequest(cookieHeader, PLATFORM, "/api/v1/public/captcha/challenge", {
    method: "POST",
    body: {},
  });
}

export async function postRedeem(cookieHeader: string, token: string, solutions: number[]) {
  return platformRequest(cookieHeader, PLATFORM, "/api/v1/public/captcha/redeem", {
    method: "POST",
    body: { token, solutions },
  });
}

export async function postCheckin(cookieHeader: string, captchaToken: string) {
  return platformRequest(cookieHeader, PLATFORM, "/api/v1/users/wallet/checkin", {
    method: "POST",
    body: { captcha_token: captchaToken },
  });
}

export function readBalance(data: unknown): number | undefined {
  if (data === null || typeof data !== "object") return undefined;
  const milli = Number((data as { balance?: unknown }).balance);
  if (!Number.isFinite(milli)) return undefined;
  return Math.round(milli) / 1000;
}
