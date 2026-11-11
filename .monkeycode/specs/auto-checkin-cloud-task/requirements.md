# Requirements Document

## Introduction

本功能交付一套本地可预览的 Web 管理台，用于按 Cron 表达式定时执行 MonkeyCode 每日签到，领取官方积分。用户在管理台录入会话凭证（Cookie 或 Token），配置执行计划，查看每次执行结果。

首期范围仅覆盖 MonkeyCode 国内站（monkeycode-ai.com）每日签到。国际站、百智云每日积分、自定义 HTTP 任务不在本期。

## Glossary

- **System**: 自动签到云任务系统，包含 Web 管理台、任务调度器和签到执行器。
- **Account**: 一条用户配置的 MonkeyCode 账号记录，包含名称、会话凭证、站点与启用状态。
- **Session Credential**: 用户从浏览器复制的 MonkeyCode 登录会话，形态为 Cookie 字符串或等价 Token。
- **Check-in Task**: 绑定到一个 Account 的定时签到任务，包含 Cron 表达式、时区、启用状态。
- **Execution Record**: 一次签到尝试的结果记录，包含时间、状态、积分变动、错误摘要。
- **MonkeyCode Platform**: 目标平台 `https://monkeycode-ai.com`，每日签到成功后发放积分（官方说明为 100 点/天）。
- **Cron Expression**: 标准 5 段 Cron（分 时 日 月 周），按任务时区解释。

## Requirements

### Requirement 1: 账号凭证管理

**User Story:** AS 用户, I want 在管理台保存 MonkeyCode 会话凭证, so that 调度器能用该身份完成签到。

#### Acceptance Criteria

1. WHEN 用户提交账号名称与 Session Credential，the System SHALL 创建一条 Account 记录并持久化。
2. WHEN 用户打开账号列表，the System SHALL 展示每条 Account 的名称、站点、启用状态、凭证末 8 位掩码、最近一次签到状态。
3. WHILE 账号列表展示中，the System SHALL 以掩码形式显示 Session Credential，仅保留末 8 个可见字符。
4. WHEN 用户更新某条 Account 的名称、Session Credential 或启用状态，the System SHALL 用新值覆盖该 Account 并保留原 Account 标识。
5. WHEN 用户删除某条 Account，the System SHALL 同时停止该 Account 关联的 Check-in Task，并保留已有 Execution Record。
6. IF 用户提交的 Session Credential 为空或仅含空白字符，the System SHALL 拒绝创建或更新，并提示「会话凭证不能为空」。

### Requirement 2: 定时签到任务

**User Story:** AS 用户, I want 用 Cron 表达式设定签到时间, so that 每天在指定时刻自动领取积分。

#### Acceptance Criteria

1. WHEN 用户为某个已启用 Account 提交合法 Cron 表达式与时区，the System SHALL 创建或更新对应 Check-in Task 并按该计划调度。
2. WHEN 用户提交的 Cron 表达式无法解析为 5 段表达式，the System SHALL 拒绝保存，并提示「Cron 表达式格式无效」。
3. WHILE Check-in Task 处于启用状态，the System SHALL 在每个 Cron 命中时刻为该 Account 发起一次签到。
4. WHEN 用户关闭某条 Check-in Task，the System SHALL 停止后续自动调度，并保留已有 Execution Record。
5. WHEN 用户点击「立即执行」，the System SHALL 立即为该 Account 发起一次签到，该次执行独立于 Cron 计划。
6. IF 同一 Account 已有一次签到正在执行，the System SHALL 拒绝启动新的并发执行，并提示「该账号签到正在进行」。
7. WHEN 一次定时签到失败，the System SHALL 将该次结果写入 Execution Record，并等待下一次 Cron 命中后再执行。

### Requirement 3: MonkeyCode 签到执行

**User Story:** AS 用户, I want 系统按官方签到流程完成打卡, so that 当天积分到账。

#### Acceptance Criteria

1. WHEN Check-in Task 触发，the System SHALL 使用该 Account 的 Session Credential 向 MonkeyCode Platform 查询当日签到状态。
2. WHEN 平台返回当日已签到，the System SHALL 将本次 Execution Record 标记为「已签到」，并跳过写请求。
3. WHEN 平台返回当日未签到，the System SHALL 完成平台要求的校验流程后提交签到，并将结果写入 Execution Record。
4. WHEN 签到提交成功，the System SHALL 记录签到前后积分余额差作为本次积分变动；任一次余额读取失败时，积分变动记为 0 并附说明「余额读取失败」。
5. IF Session Credential 被平台拒绝（HTTP 401 或等价未授权），the System SHALL 将本次 Execution Record 标记为「凭证失效」，并提示用户更新凭证。
6. IF 平台校验流程无法完成或签到提交失败，the System SHALL 将本次 Execution Record 标记为「失败」，并保存可诊断的错误摘要（不含完整凭证）。

### Requirement 4: 执行记录与状态展示

**User Story:** AS 用户, I want 查看每次签到结果, so that 我能确认积分是否到账以及失败原因。

#### Acceptance Criteria

1. WHEN 一次签到结束，the System SHALL 写入一条 Execution Record，字段包含 Account 标识、开始时间、结束时间、状态、积分变动、错误摘要。
2. WHEN 用户打开执行记录页，the System SHALL 按时间倒序展示最近 100 条 Execution Record。
3. WHEN 用户按 Account 筛选执行记录，the System SHALL 仅展示该 Account 的记录。
4. WHILE Web 管理台首页打开，the System SHALL 展示每个 Account 的下次计划执行时间与最近一次执行状态。

### Requirement 5: Web 管理台与本地预览

**User Story:** AS 用户, I want 在浏览器中管理账号和任务, so that 我无需命令行即可完成配置和巡检。

#### Acceptance Criteria

1. WHEN 用户访问管理台根路径，the System SHALL 展示账号列表、任务配置入口、立即执行入口与最近执行记录。
2. WHEN 前端请求以 `/api` 开头的路径，the System SHALL 将请求转发到后端服务。
3. WHEN 后端服务启动，the System SHALL 在进程内恢复已启用的 Check-in Task 调度。
4. IF 后端在启动时读取到损坏的持久化数据，the System SHALL 以空配置启动管理台，并在首页展示「配置数据无法读取，请检查数据文件」。

### Requirement 6: 本地 JSON 持久化

**User Story:** AS 用户, I want 账号、任务和执行记录保存在本地文件, so that 重启后配置与历史仍然可用。

#### Acceptance Criteria

1. WHEN 账号、任务或执行记录发生变更，the System SHALL 将完整数据写入工作区内的 JSON 文件。
2. WHEN 后端进程启动且 JSON 文件存在且可解析，the System SHALL 从该文件恢复 Account、Check-in Task 与 Execution Record。
3. WHILE Session Credential 写入 JSON 文件，the System SHALL 以明文保存完整凭证供执行器使用，并仅在 API 响应与页面中输出掩码。
4. WHEN Execution Record 数量超过 500 条，the System SHALL 仅保留最新 500 条。
