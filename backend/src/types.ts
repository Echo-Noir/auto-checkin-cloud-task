export type RecordStatus = "success" | "skipped" | "auth_failed" | "failed";

export type SiteId = "monkeycode-cn" | "baizhi";

export const SITES: { id: SiteId; label: string; host: string }[] = [
  { id: "monkeycode-cn", label: "MonkeyCode 国内站", host: "monkeycode-ai.com" },
  { id: "baizhi", label: "长亭百智云", host: "baizhi.cloud" },
];

export function isSiteId(value: unknown): value is SiteId {
  return value === "monkeycode-cn" || value === "baizhi";
}

export type Account = {
  id: string;
  name: string;
  site: SiteId;
  credential: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CheckinTask = {
  id: string;
  accountId: string;
  cron: string;
  timezone: string;
  enabled: boolean;
  updatedAt: string;
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

export type AppData = {
  accounts: Account[];
  tasks: CheckinTask[];
  records: ExecutionRecord[];
};

export type AccountPublic = Omit<Account, "credential"> & {
  credentialMasked: string;
  lastStatus: RecordStatus | null;
  nextRunAt: string | null;
};

export type TaskPublic = CheckinTask & {
  nextRunAt: string | null;
};
