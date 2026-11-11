# 接口定义

后端前缀 `/api`。成功响应 `{ "ok": true, "data": ... }`，失败 `{ "ok": false, "error": "可读说明" }`。

列表接口中账号的 `credentialMasked` 为 `********` + 末 8 字符，响应中不含完整凭证。

## 账号

### GET /api/accounts

返回账号列表，每项含 `id`、`name`、`site`、`enabled`、`credentialMasked`、`lastStatus`、`nextRunAt`。

### POST /api/accounts

请求体：`{ "name": string, "credential": string, "enabled": boolean, "site": "monkeycode-cn" | "baizhi" }`

`site` 缺省为 `monkeycode-cn`。

`credential` 为空时 400，「会话凭证不能为空」。

### PUT /api/accounts/:id

请求体字段均可选：`name`、`credential`、`enabled`、`site`。

### DELETE /api/accounts/:id

停止关联任务，保留执行记录。404 当账号不存在。

## 任务

### GET /api/tasks

返回任务列表，含 `id`、`accountId`、`cron`、`timezone`、`enabled`、`nextRunAt`。

### PUT /api/tasks/:accountId

请求体：`{ "cron": string, "timezone": string, "enabled": boolean }`

Cron 无法解析时 400，「Cron 表达式格式无效」。

### POST /api/tasks/:accountId/run

立即执行。账号已有在飞签到时 409，「该账号签到正在进行」。

## 记录

### GET /api/records?accountId=&limit=100

按 `finishedAt` 倒序。`limit` 默认 100，最大 100。

记录字段：`id`、`accountId`、`startedAt`、`finishedAt`、`status`、`pointsDelta`、`error`。

`status`：`success` | `skipped` | `auth_failed` | `failed`。

## 平台侧（出站，非本系统 API）

### MonkeyCode 国内站

基址 `https://monkeycode-ai.com`，请求头 `Cookie: monkeycode_ai_session=<credential>`。

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/v1/users/wallet/checkin` | 当日是否已签 |
| POST | `/api/v1/public/captcha/challenge` | 取 PoW 题 |
| POST | `/api/v1/public/captcha/redeem` | 换 captcha_token |
| POST | `/api/v1/users/wallet/checkin` | 提交签到 |
| GET | `/api/v1/users/wallet` | 积分余额 |

### 长亭百智云

基址 `https://baizhi.cloud`，请求头需同时带 `baizhi_session` 与 `sl-session`。

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/v1/user/wallet/balance` | 钱包；`daily_temporary_credit_claimed` 表示今日已领 |
| POST | `/api/v1/public/captcha/challenge` | 取 PoW 题（与 MonkeyCode 同形） |
| POST | `/api/v1/public/captcha/redeem` | 换 captcha_token |
| POST | `/api/v1/user/wallet/daily-temporary-credit` | 领取每日积分 |

超时 10 秒。
