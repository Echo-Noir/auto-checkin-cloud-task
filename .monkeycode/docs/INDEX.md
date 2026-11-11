# 自动签到云任务 文档

## 项目概述

自动签到云任务是一套本地 Web 管理台，按 Cron 表达式定时完成 MonkeyCode 国内站每日签到，领取官方积分。

**目标用户**: 需要每天领取 MonkeyCode 积分、希望用浏览器配置任务并查看结果的个人用户。

**核心价值**:
- 用 Cron 在指定时刻自动签到
- 在浏览器里管理账号凭证、任务和执行记录
- 已签到当天跳过写请求，失败记录可追溯

## 技术选型

| 类别 | 选择 | 理由 |
|------|------|------|
| 前端 | Vite + React + TypeScript | 预览端口单一，开发服务器可反代 `/api` |
| 后端 | Node.js + Express + TypeScript | 与前端同语言，HTTP 客户端与 Cron 调度实现成本低 |
| 调度 | node-cron | 直接支持 5 段 Cron 与时区 |
| 存储 | 本地 JSON 文件 | 单机预览，无需数据库 |
| 预览入口 | 前端 5173，后端 3001 | 预览环境只暴露前端端口 |

## 核心功能

### 账号凭证管理
- **目的**: 保存 MonkeyCode 会话，供执行器使用
- **描述**: 用户粘贴 Cookie/Token，列表仅展示掩码；磁盘保存完整凭证

### 定时签到
- **目的**: 在指定时刻自动领取当日积分
- **描述**: 每账号一条 Cron 任务，支持立即执行；同一账号同时只跑一次

### 签到执行
- **目的**: 按官方流程完成打卡
- **描述**: 先查当日是否已签；未签则解 PoW 验证题后提交；记录积分差额

### 执行记录
- **目的**: 确认到账与失败原因
- **描述**: 倒序展示最近记录，状态含成功、已签到、凭证失效、失败

## 文档导航

- 当前工作区 `.monkeycode/docs/ARCHITECTURE.md` - 架构设计
- 当前工作区 `.monkeycode/docs/INTERFACES.md` - 接口定义
- 当前工作区 `.monkeycode/docs/DEVELOPER_GUIDE.md` - 开发指南
- 当前工作区 `.monkeycode/specs/auto-checkin-cloud-task/requirements.md` - 需求
- 当前工作区 `.monkeycode/specs/auto-checkin-cloud-task/design.md` - 技术设计
