export type RecordStatus = "success" | "skipped" | "auth_failed" | "failed";

export type AccountPublic = {
  id: string;
  name: string;
  site: "monkeycode-cn";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  credentialMasked: string;
  lastStatus: RecordStatus | null;
  nextRunAt: string | null;
};

export type CheckinTask = {
  id: string;
  accountId: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  updatedAt: string;
  nextRunAt: string | null;
};

export type ExecutionRecord = {
  id: string;
  accountId: string;
  startedAt: string;
  finishedAt: string;
  status: RecordStatus;
  pointsDelta: number;
  error: string | null;
};

type ApiOk<T> = { ok: true; data: T };
type ApiFail = { ok: false; error: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await res.json()) as ApiOk<T> | ApiFail;
  if (!body.ok) {
    throw new Error(body.error);
  }
  return body.data;
}

export function listAccounts() {
  return request<{ accounts: AccountPublic[]; corrupted: boolean }>("/api/accounts");
}

export function createAccount(payload: { name: string; credential: string; enabled: boolean }) {
  return request<{ id: string }>("/api/accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAccount(
  id: string,
  payload: { name?: string; credential?: string; enabled?: boolean },
) {
  return request<{ id: string }>(`/api/accounts/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteAccount(id: string) {
  return request<{ id: string }>(`/api/accounts/${id}`, { method: "DELETE" });
}

export function listTasks() {
  return request<{ tasks: CheckinTask[] }>("/api/tasks");
}

export function saveTask(accountId: string, payload: { cron: string; timezone: string; enabled: boolean }) {
  return request<{ accountId: string; nextRunAt: string | null }>(`/api/tasks/${accountId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function runTask(accountId: string) {
  return request<{ status: RecordStatus; pointsDelta: number; error: string | null }>(
    `/api/tasks/${accountId}/run`,
    { method: "POST" },
  );
}

export function listRecords(accountId?: string) {
  const q = accountId ? `?accountId=${encodeURIComponent(accountId)}&limit=100` : "?limit=100";
  return request<{ records: ExecutionRecord[] }>(`/api/records${q}`);
}
