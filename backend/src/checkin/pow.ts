import { createHash } from "node:crypto";

export const MAX_POW_ATTEMPTS_PER_QUESTION = 20_000_000;
export const MAX_POW_ATTEMPTS_TOTAL = 5_000_000;

export type Challenge = {
  count: number;
  saltLength: number;
  targetLength: number;
};

function fnv1a32(data: string): number {
  let hash = 2166136261;
  for (let index = 0; index < data.length; index += 1) {
    hash ^= data.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function prng(seed: string, length: number): string {
  let state = fnv1a32(seed);
  let out = "";
  while (out.length < length) {
    state = (state ^ ((state << 13) >>> 0)) >>> 0;
    state = (state ^ (state >>> 17)) >>> 0;
    state = (state ^ ((state << 5) >>> 0)) >>> 0;
    out += state.toString(16).padStart(8, "0");
  }
  return out.slice(0, length);
}

function solveOne(salt: string, target: string, budget: { remaining: number }): number {
  for (let n = 0; n < MAX_POW_ATTEMPTS_PER_QUESTION; n += 1) {
    budget.remaining -= 1;
    if (budget.remaining < 0) {
      throw new Error("captcha_budget_exceeded");
    }
    const digest = createHash("sha256").update(salt + String(n)).digest("hex");
    if (digest.startsWith(target)) return n;
  }
  throw new Error("captcha_budget_exceeded");
}

export async function solveChallengeYielding(
  token: string,
  challenge: Challenge,
  budget = { remaining: MAX_POW_ATTEMPTS_TOTAL },
): Promise<number[]> {
  const solutions: number[] = [];
  for (let index = 0; index < challenge.count; index += 1) {
    const ordinal = index + 1;
    const target = prng(`${token}${ordinal}d`, challenge.targetLength);
    const salt = prng(`${token}${ordinal}`, challenge.saltLength);
    solutions.push(solveOne(salt, target, budget));
    await new Promise((resolve) => setImmediate(resolve));
  }
  return solutions;
}

export function readChallenge(data: unknown): { token: string; challenge: Challenge } | { error: string } {
  if (data === null || typeof data !== "object") {
    return { error: "captcha_invalid" };
  }
  const obj = data as Record<string, unknown>;
  const token = typeof obj.token === "string" ? obj.token.trim() : "";
  if (token.length === 0) return { error: "captcha_invalid" };
  const challenge = obj.challenge;
  if (challenge === null || typeof challenge !== "object") {
    return { error: "captcha_invalid" };
  }
  const c = challenge as Record<string, unknown>;
  const count = Number(c.c);
  const saltLength = Number(c.s);
  const targetLength = Number(c.d);
  if (!Number.isFinite(count) || !Number.isFinite(saltLength) || !Number.isFinite(targetLength)) {
    return { error: "captcha_invalid" };
  }
  if (count < 1 || count > 500 || saltLength < 1 || saltLength > 256 || targetLength < 1 || targetLength > 16) {
    return { error: "captcha_invalid" };
  }
  return {
    token,
    challenge: {
      count: Math.floor(count),
      saltLength: Math.floor(saltLength),
      targetLength: Math.floor(targetLength),
    },
  };
}
