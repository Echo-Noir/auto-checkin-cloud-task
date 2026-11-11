const PLATFORM = "https://monkeycode-ai.com";
const COOKIE_NAME = "monkeycode_ai_session";
const TIMEOUT_MS = 10_000;

export type PlatformResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; unauthorized: boolean };

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

function unwrap(data: unknown): unknown {
  if (data !== null && typeof data === "object" && "data" in (data as object)) {
    const env = data as { code?: number; data?: unknown; message?: string };
    if (typeof env.code === "number" && env.code !== 0) {
      throw Object.assign(new Error(env.message || `code ${env.code}`), { code: env.code });
    }
    if (env.data !== undefined) return env.data;
  }
  return data;
}

export async function platformRequest(
  cookieHeader: string,
  path: string,
  init: { method: string; body?: unknown } = { method: "GET" },
): Promise<PlatformResult<unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${PLATFORM}${path}`, {
      method: init.method,
      headers: {
        Cookie: cookieHeader,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text.slice(0, 200) };
      }
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, error: "凭证失效", unauthorized: true };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `HTTP ${res.status}`,
        unauthorized: false,
      };
    }
    try {
      return { ok: true, status: res.status, data: unwrap(parsed) };
    } catch (err) {
      return {
        ok: false,
        status: res.status,
        error: err instanceof Error ? err.message : String(err),
        unauthorized: false,
      };
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      error: aborted ? "请求超时" : err instanceof Error ? err.message : String(err),
      unauthorized: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getCheckinStatus(cookieHeader: string) {
  return platformRequest(cookieHeader, "/api/v1/users/wallet/checkin", { method: "GET" });
}

export async function getWallet(cookieHeader: string) {
  return platformRequest(cookieHeader, "/api/v1/users/wallet", { method: "GET" });
}

export async function postChallenge(cookieHeader: string) {
  return platformRequest(cookieHeader, "/api/v1/public/captcha/challenge", { method: "POST", body: {} });
}

export async function postRedeem(cookieHeader: string, token: string, solutions: number[]) {
  return platformRequest(cookieHeader, "/api/v1/public/captcha/redeem", {
    method: "POST",
    body: { token, solutions },
  });
}

export async function postCheckin(cookieHeader: string, captchaToken: string) {
  return platformRequest(cookieHeader, "/api/v1/users/wallet/checkin", {
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
