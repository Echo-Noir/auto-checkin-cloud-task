# 自动签到云任务

本地 Web 管理台 + GitHub Actions，按 Cron 完成 MonkeyCode 国内站每日签到。

本开发环境会休眠，进程内的 node-cron 会停。把仓库推到 GitHub 并配置 Secrets 后，用 Actions 每天补签。

## 本地预览

```bash
cd backend && npm install
cd ../frontend && npm install
./start.sh
```

前端 `5173`，后端 `3001`。在页面粘贴 `monkeycode_ai_session`，默认每天 08:00（Asia/Shanghai）。

## GitHub Actions 每日签到

1. 打开仓库 Settings → Secrets and variables → Actions
2. 新增 `MONKEYCODE_SESSION`，值为会话 Cookie（整段 Cookie 或 session 值均可）
3. Actions 页手动跑一次 `daily-checkin` 验证
4. 之后每天 UTC 00:00（北京时间 08:00）自动执行

凭证只放在 GitHub Secret 里，不要提交 `backend/data/app.json`。
