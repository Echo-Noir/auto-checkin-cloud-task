const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const TIMEOUT_MS = 10_000;

export type PlatformResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; unauthorized: boolean };

export function unwrap(data: unknown): unknown {
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
  origin: string,
  path: string,
  init: { method: string; body?: unknown } = { method: "GET" },
): Promise<PlatformResult<unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${origin}${path}`, {
      method: init.method,
      headers: {
        Cookie: cookieHeader,
        Accept: "application/json",
        Referer: `${origin}/`,
        "User-Agent": UA,
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
