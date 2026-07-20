# Tasks

- [x] Task 1: 定义操作日志类型：在 `packages/infrastructure/requester/types.ts` 中新增操作日志相关类型。
  - [x] SubTask 1.1: 新增 `OperationLogStatus`（`'pending' | 'failed'`）
  - [x] SubTask 1.2: 新增 `OperationLog` 类型（`id`、`method`、`url`、`data?`、`status`、`createdAt`、`errorCode?`、`errorMessage?`、`retryCount`）
  - [x] SubTask 1.3: 新增 `HttpMethod` 类型（`'get' | 'post' | 'put' | 'delete'`）与幂等方法判定所需的常量/类型

- [x] Task 2: 实现 Dexie 操作日志存储：新增 `packages/infrastructure/requester/operation-log.ts`。
  - [x] SubTask 2.1: 定义 Dexie 数据库（表 `operationLogs`，主键 `id`，索引 `status`）
  - [x] SubTask 2.2: 实现 `createLog(method, url, data)` → 写入 `pending` 日志并返回 `id`
  - [x] SubTask 2.3: 实现 `removeLog(id)`、`markFailed(id, { errorCode, errorMessage, retryCount })`
  - [x] SubTask 2.4: 实现 `listLogs()` 与 `listFailedIdempotentLogs()`
  - [x] SubTask 2.5: 写入时剥离敏感 header，仅保存可结构化克隆的请求体

- [x] Task 3: 实现重试判定与退避：新增 `packages/infrastructure/requester/retry.ts`。
  - [x] SubTask 3.1: `isRetriableError(error)` — 仅 `ECONNABORTED` / `ERR_NETWORK` 返回 true
  - [x] SubTask 3.2: `isIdempotentMethod(method)` — `get/put/delete` 为 true，`post` 为 false
  - [x] SubTask 3.3: `MAX_RETRY = 2` 常量与 `getBackoffDelay(retryCount)` 指数退避（300ms → 600ms）

- [x] Task 4: 集成到 axios 请求器：改造 `packages/infrastructure/requester/axios.ts`。
  - [x] SubTask 4.1: 请求器工厂接收 `enableRetry` 参数（默认 true）
  - [x] SubTask 4.2: 在响应拦截器错误分支中，仅当 `enableRetry` 为 true 且请求可重试 + 幂等时执行退避重试（利用 `error.config`，累加 `_retryCount`）
  - [x] SubTask 4.3: 重试关闭 / 耗尽 / 不可重试时，回落到既有错误归一化逻辑
  - [x] SubTask 4.4: 包装 `get/post/put/delete`：请求前 `createLog`，成功后 `removeLog`，最终失败 `markFailed`
  - [x] SubTask 4.5: 确保日志写/删为异步且不阻塞、不改变原有返回值与接口签名

- [x] Task 5: 导出重放/读取 API 与开关选项：更新 `packages/infrastructure/requester/index.ts` 与 `types.ts`。
  - [x] SubTask 5.1: `UseRequesterOptions` 增加可选 `enableRetry`（默认 true），并透传给 axios 请求器工厂
  - [x] SubTask 5.2: 导出 `getOperationLogs()`（读取日志）
  - [x] SubTask 5.3: 导出 `replayFailedOperations()`（重放 `failed` 幂等日志：成功删除、失败保留）
  - [x] SubTask 5.4: 导出新增类型

- [x] Task 6: 类型检查与构建验证。
  - [x] SubTask 6.1: 对 `@nao-todo/infrastructure` 运行 TypeScript 类型检查（`vue-tsc --noEmit` 或等价命令），无新增类型错误
  - [x] SubTask 6.2: 验证业务层调用方无需改动（Requester 接口签名未变）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 和 Task 3
- Task 5 depends on Task 2、Task 4
- Task 6 depends on Task 5
