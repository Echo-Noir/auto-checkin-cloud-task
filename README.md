# 自动签到云任务

本地 Web 管理台 + GitHub Actions，按 Cron 完成 MonkeyCode 国内站与长亭百智云每日签到。

本开发环境会休眠，进程内的 node-cron 会停。把仓库推到 GitHub 并配置 Secrets 后，用 Actions 每天补签。

## 本地预览

```bash
cd backend && npm install
cd ../frontend && npm install
./start.sh
```

前端 `5173`，后端 `3001`。新增账号时选择站点：

- MonkeyCode：粘贴 `monkeycode_ai_session`
- 百智云：粘贴 `baizhi_session` 与 `sl-session`（两枚一起）

默认每天 08:00（Asia/Shanghai）。

## GitHub Actions 每日签到

1. 打开仓库 Settings → Secrets and variables → Actions
2. 按需新增：
   - `MONKEYCODE_SESSION`：MonkeyCode 会话 Cookie
   - `BAIZHI_SESSION`：百智云 Cookie（含 `baizhi_session` 与 `sl-session`）
3. Actions 页手动跑一次 `daily-checkin` 验证
4. 之后每天 UTC 00:00（北京时间 08:00）自动执行

只配置其中一个 Secret 时，CLI 只跑对应站点。凭证只放在 GitHub Secret 里，不要提交 `backend/data/app.json`。
