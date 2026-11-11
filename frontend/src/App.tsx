import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  listRecords,
  listTasks,
  runTask,
  saveTask,
  updateAccount,
  type AccountPublic,
  type CheckinTask,
  type ExecutionRecord,
  type RecordStatus,
  type SiteId,
} from "./api";

const SITE_LABEL: Record<SiteId, string> = {
  "monkeycode-cn": "monkeycode-ai.com",
  baizhi: "baizhi.cloud",
};

const SITE_HINT: Record<SiteId, string> = {
  "monkeycode-cn": "粘贴 monkeycode_ai_session 或完整 Cookie",
  baizhi: "粘贴 baizhi_session 与 sl-session（两枚一起，或完整 Cookie）",
};

const STATUS_LABEL: Record<RecordStatus, string> = {
  success: "成功",
  skipped: "已签到",
  auth_failed: "凭证失效",
  failed: "失败",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

export default function App() {
  const [accounts, setAccounts] = useState<AccountPublic[]>([]);
  const [tasks, setTasks] = useState<CheckinTask[]>([]);
  const [records, setRecords] = useState<ExecutionRecord[]>([]);
  const [corrupted, setCorrupted] = useState(false);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [site, setSite] = useState<SiteId>("monkeycode-cn");
  const [credential, setCredential] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [cron, setCron] = useState("0 8 * * *");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [taskEnabled, setTaskEnabled] = useState(true);

  const load = useCallback(async () => {
    const [a, t, r] = await Promise.all([listAccounts(), listTasks(), listRecords(filter || undefined)]);
    setAccounts(a.accounts);
    setCorrupted(a.corrupted);
    setTasks(t.tasks);
    setRecords(r.records);
  }, [filter]);

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, [load]);

  const taskMap = useMemo(() => {
    const m = new Map<string, CheckinTask>();
    for (const t of tasks) m.set(t.accountId, t);
    return m;
  }, [tasks]);

  async function wrap(fn: () => Promise<void>) {
    setError("");
    setNotice("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function fillAccount(acc: AccountPublic) {
    setEditId(acc.id);
    setName(acc.name);
    setSite(acc.site);
    setCredential("");
    const t = taskMap.get(acc.id);
    setCron(t?.cron ?? "0 8 * * *");
    setTimezone(t?.timezone ?? "Asia/Shanghai");
    setTaskEnabled(t?.enabled ?? true);
  }

  return (
    <div className="app">
      <h1>自动签到云任务</h1>
      <p className="sub">MonkeyCode 国内站 / 长亭百智云每日签到 · Cron 调度 · 本地 JSON 存储</p>
      {corrupted ? <div className="banner">配置数据无法读取，请检查数据文件</div> : null}

      <div className="grid">
        <section className="panel">
          <h2>{editId ? "编辑账号" : "新增账号"}</h2>
          <label>名称</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="主账号" />
          <label>站点</label>
          <select
            value={site}
            onChange={(e) => setSite(e.target.value as SiteId)}
            disabled={Boolean(editId)}
          >
            <option value="monkeycode-cn">MonkeyCode 国内站</option>
            <option value="baizhi">长亭百智云</option>
          </select>
          <label>Session Credential</label>
          <textarea
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder={SITE_HINT[site]}
          />
          <label>Cron</label>
          <input value={cron} onChange={(e) => setCron(e.target.value)} />
          <label>时区</label>
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          <label>
            <input type="checkbox" checked={taskEnabled} onChange={(e) => setTaskEnabled(e.target.checked)} />{" "}
            启用定时任务
          </label>
          <div className="row">
            <button
              onClick={() =>
                wrap(async () => {
                  if (editId) {
                    const payload: { name: string; credential?: string } = { name };
                    if (credential.trim()) payload.credential = credential;
                    await updateAccount(editId, payload);
                    await saveTask(editId, { cron, timezone, enabled: taskEnabled });
                    setNotice("已保存");
                  } else {
                    const created = await createAccount({
                      name,
                      credential,
                      enabled: true,
                      site,
                    });
                    await saveTask(created.id, { cron, timezone, enabled: taskEnabled });
                    setNotice("账号已创建");
                  }
                  setCredential("");
                })
              }
            >
              保存
            </button>
            {editId ? (
              <button
                className="ghost"
                onClick={() => {
                  setEditId(null);
                  setName("");
                  setSite("monkeycode-cn");
                  setCredential("");
                }}
              >
                取消编辑
              </button>
            ) : null}
          </div>
          {error ? <div className="err">{error}</div> : null}
          {notice ? <div className="okmsg">{notice}</div> : null}
        </section>

        <section className="panel">
          <h2>账号列表</h2>
          <div className="cards">
            {accounts.length === 0 ? <div className="meta">暂无账号</div> : null}
            {accounts.map((acc) => (
              <article className="card" key={acc.id}>
                <div className="name">{acc.name}</div>
                <div className="meta">
                  站点 {SITE_LABEL[acc.site]}
                  <br />
                  凭证 {acc.credentialMasked}
                  <br />
                  下次执行 {fmt(acc.nextRunAt)}
                  <br />
                  最近状态{" "}
                  {acc.lastStatus ? (
                    <span className={`status ${acc.lastStatus}`}>{STATUS_LABEL[acc.lastStatus]}</span>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="row">
                  <button className="ghost" onClick={() => fillAccount(acc)}>
                    编辑
                  </button>
                  <button
                    disabled={busyId === acc.id}
                    onClick={() =>
                      wrap(async () => {
                        setBusyId(acc.id);
                        try {
                          const r = await runTask(acc.id);
                          setNotice(`执行完成：${STATUS_LABEL[r.status]}${r.error ? ` · ${r.error}` : ""}`);
                        } finally {
                          setBusyId(null);
                        }
                      })
                    }
                  >
                    立即执行
                  </button>
                  <button
                    className="ghost"
                    onClick={() =>
                      wrap(async () => {
                        await updateAccount(acc.id, { enabled: !acc.enabled });
                      })
                    }
                  >
                    {acc.enabled ? "停用账号" : "启用账号"}
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      wrap(async () => {
                        await deleteAccount(acc.id);
                        if (editId === acc.id) setEditId(null);
                      })
                    }
                  >
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel wide">
          <h2>执行记录</h2>
          <label>按账号筛选</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">全部</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>账号</th>
                <th>状态</th>
                <th>积分变动</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const acc = accounts.find((a) => a.id === r.accountId);
                return (
                  <tr key={r.id}>
                    <td>{fmt(r.finishedAt)}</td>
                    <td>{acc?.name ?? r.accountId}</td>
                    <td>
                      <span className={`status ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td>{r.pointsDelta}</td>
                    <td>{r.error ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
