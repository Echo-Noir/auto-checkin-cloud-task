# 开发指南

## 环境要求

- Node.js 20+
- npm

## 快速开始

```bash
# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd frontend && npm install

# 同时启动后端与前端（预览入口为前端端口）
./start.sh
```

前端默认 `http://127.0.0.1:5173`，后端 `http://127.0.0.1:3001`。

## 项目结构说明

- `frontend/`：管理台 UI，`vite.config.ts` 将 `/api` 代理到 3001，`server.allowedHosts` 含 `.monkeycode-ai.online`
- `backend/`：REST API、调度、签到执行
- `backend/data/app.json`：账号、任务、记录；运行时生成
- `.monkeycode/specs/auto-checkin-cloud-task/`：需求与设计

## 开发规范

- TypeScript strict
- API 路径统一 `/api` 前缀
- 日志与错误摘要禁止输出完整会话凭证
- 提交信息使用 `feat:` / `fix:` / `chore:` 前缀

## 常见任务

新增账号字段：先改 `backend/src/store` 类型，再改 `routes/accounts` 与前端表单。

调整签到协议：只改 `backend/src/checkin/`，保持路由层不变。

## 构建与发布

```bash
# 后端测试
cd backend && npm test

# 前端构建
cd frontend && npm run build
```

预览环境用 `start.sh` 同时拉起两个进程。
