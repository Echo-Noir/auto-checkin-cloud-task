import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Account, AppData, CheckinTask, ExecutionRecord } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, "../../data");
export const DATA_FILE = path.join(DATA_DIR, "app.json");
const MAX_RECORDS = 500;

const emptyData = (): AppData => ({
  accounts: [],
  tasks: [],
  records: [],
});

export type StoreState = {
  data: AppData;
  corrupted: boolean;
};

let cache: StoreState | null = null;

export async function loadStore(): Promise<StoreState> {
  if (cache) return cache;
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (!Array.isArray(parsed.accounts) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.records)) {
      cache = { data: emptyData(), corrupted: true };
      return cache;
    }
    cache = {
      data: {
        accounts: parsed.accounts as Account[],
        tasks: parsed.tasks as CheckinTask[],
        records: (parsed.records as ExecutionRecord[]).slice(-MAX_RECORDS),
      },
      corrupted: false,
    };
    return cache;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      cache = { data: emptyData(), corrupted: false };
      await persist();
      return cache;
    }
    cache = { data: emptyData(), corrupted: true };
    return cache;
  }
}

export function isCorrupted(): boolean {
  return cache?.corrupted === true;
}

export function getData(): AppData {
  if (!cache) throw new Error("store not loaded");
  return cache.data;
}

async function persist(): Promise<void> {
  if (!cache) return;
  cache.data.records = cache.data.records.slice(-MAX_RECORDS);
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(cache.data, null, 2), "utf8");
  await rename(tmp, DATA_FILE);
  cache.corrupted = false;
}

export async function mutate(fn: (data: AppData) => void): Promise<AppData> {
  const state = await loadStore();
  fn(state.data);
  await persist();
  return state.data;
}
