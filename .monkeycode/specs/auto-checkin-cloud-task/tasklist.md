# 需求实施计划

- [x] 1. 搭建前后端工程骨架与共享类型
  - 创建 `backend/`、`frontend/`、`backend/data/` 目录
  - 编写 `backend/package.json`、`tsconfig.json`、Express 入口 `src/index.ts`（监听 3001）
  - 编写 `frontend/package.json`、`vite.config.ts`（`/api` 反代 `http://localhost:3001`，`allowedHosts: ['.monkeycode-ai.online']`）、React 入口
  - 定义共享类型：Account、Check-in Task、Execution Record、`status` 枚举（对应 Requirement 1/2/4、Design Data Models）
  - 编写 `start.sh`：先启动后端再启动前端
  - [ ]* 1.1 为共享类型校验编写单元测试

- [x] 2. 实现 JSON 存储层
  - 实现 `backend/src/store/jsonStore.ts`：读取/原子写入 `backend/data/app.json`
  - 启动时文件缺失则初始化空 `accounts/tasks/records`
  - 文件损坏时返回空配置并设置可读标志（Requirement 5.4、Requirement 6.1/6.2）
  - `records` 超过 500 条截断为最新 500（Requirement 6.4）
  - 凭证在磁盘明文保存（Requirement 6.3）
  - [ ]* 2.1 为读写往返、损坏文件降级、记录截断编写单元测试

- [x] 3. 实现账号 CRUD API
  - 实现 `backend/src/routes/accounts.ts`：GET/POST/PUT/DELETE `/api/accounts`
  - 空凭证返回 400「会话凭证不能为空」（Requirement 1.6）
  - 列表与详情仅返回 `credentialMasked`（Requirement 1.3、6.3）
  - 删除账号时停止关联任务并保留记录（Requirement 1.5）
  - [ ]* 3.1 为掩码、空凭证拒绝、删除后任务停止编写 API 测试

- [x] 4. 实现任务配置与 Cron 调度
  - 实现 `backend/src/scheduler/cron.ts`：按 `timezone` 注册/注销 node-cron job
  - 实现 `PUT /api/tasks/:accountId`：校验 5 段 Cron，非法返回 400「Cron 表达式格式无效」（Requirement 2.2）
  - 任务启用时调度，关闭时停止并保留记录（Requirement 2.3/2.4）
  - 进程启动调用 `restoreJobs()` 恢复已启用任务（Requirement 5.3）
  - [ ]* 4.1 为非法 Cron、启用停用、启动恢复编写单元测试

- [x] 5. 检查点 - 确保存储、账号、调度基础可用
  - 确保所有测试通过,如有疑问请询问用户

- [x] 6. 实现 MonkeyCode 客户端与 PoW 求解
  - 实现 `backend/src/checkin/client.ts`：wallet/checkin/challenge/redeem，Cookie 鉴权，超时 10s（Design Check-in protocol）
  - 实现 `backend/src/checkin/pow.ts`：1-based 下标、FNV-1a + xorshift32、SHA-256 十六进制前缀、单题 2000 万/全局 500 万预算（Design Correctness Properties）
  - 日志禁止输出完整凭证（Requirement 3.6、Design Error Handling）
  - [ ]* 6.1 为 PoW 固定向量与预算耗尽编写单元测试

- [x] 7. 实现签到执行器与立即执行接口
  - 实现 `backend/src/checkin/executor.ts`：查已签到则 `skipped` 且零写请求（Requirement 3.2）
  - 未签到则 challenge → PoW → redeem → 读钱包 → checkin → 再读钱包（Requirement 3.3/3.4）
  - 401 记 `auth_failed`；其余失败记 `failed` 并保存脱敏错误摘要（Requirement 3.5/3.6）
  - 账号级互斥；冲突时立即执行返回 409「该账号签到正在进行」（Requirement 2.6）
  - 定时失败只记记录，等待下次 Cron（Requirement 2.7）
  - 实现 `POST /api/tasks/:accountId/run`（Requirement 2.5）
  - [ ]* 7.1 为已签到跳过、401 映射、互斥锁、余额差编写单元测试

- [x] 8. 实现执行记录查询 API
  - 实现 `GET /api/records`：倒序、默认 limit 100、可按 `accountId` 筛选（Requirement 4.1/4.2/4.3）
  - 账号列表附带 `lastStatus` 与 `nextRunAt`（Requirement 4.4）

- [x] 9. 检查点 - 确保签到执行与记录接口可用
  - 确保所有测试通过,如有疑问请询问用户

- [x] 10. 实现 Web 管理台页面
  - 首页：账号卡片、下次执行时间、最近状态、立即执行、数据损坏横幅（Requirement 5.1/5.4）
  - 账号表单：名称、凭证、启用；列表展示掩码（Requirement 1.1/1.2/1.4）
  - 任务表单：Cron、时区默认 `Asia/Shanghai`（Requirement 2.1）
  - 执行记录页：倒序与账号筛选（Requirement 4.2/4.3）
  - `src/api.ts` 一律请求同源 `/api`（Requirement 5.2）
