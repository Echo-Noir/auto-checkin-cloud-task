import { randomUUID } from "node:crypto";

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function maskCredential(credential: string): string {
  const visible = credential.slice(-8);
  return `********${visible}`;
}

export function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

export function redact(text: string, credential?: string): string {
  let out = text;
  if (credential && credential.length > 4) {
    out = out.split(credential).join("[redacted]");
  }
  return out.slice(0, 400);
}

export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
