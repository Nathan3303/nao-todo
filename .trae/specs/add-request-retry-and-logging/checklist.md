# Checklist

## 操作日志持久化

- [x] `types.ts` 定义了 `OperationLog`、`OperationLogStatus`、`HttpMethod` 类型
- [x] `operation-log.ts` 使用 Dexie 定义了 `operationLogs` 表（主键 `id`，索引 `status`）
- [x] 请求发起时写入 `status = pending` 日志（含 `id`/`method`/`url`/`data`/`createdAt`）
- [x] 请求成功后删除对应日志
- [x] 请求最终失败时日志更新为 `failed`，并写入 `errorCode`/`errorMessage`/`retryCount`
- [x] 日志不写入 `Authorization` 等敏感 header，`data` 为可结构化克隆内容

## 幂等请求自动重试

- [x] `retry.ts` 的 `isRetriableError` 仅对 `ECONNABORTED` / `ERR_NETWORK` 返回 true
- [x] `isIdempotentMethod` 对 `get/put/delete` 为 true、`post` 为 false
- [x] 重试最多 2 次，退避为指数（第 1 次 300ms、第 2 次 600ms）
- [x] `POST` 网络错误不触发自动重试
- [x] 重试成功后返回成功响应且不再重试
- [x] 重试耗尽后回落到既有统一错误归一化逻辑

## 重试机制开关

- [x] `UseRequesterOptions` 新增可选 `enableRetry`，默认开启
- [x] `enableRetry = false` 时不进行任何自动重试，直接归一化错误
- [x] 未显式传入 `enableRetry` 时等价于开启
- [x] `enableRetry = false` 不影响操作日志的记录

## 失败日志读取与重放

- [x] `index.ts` 导出 `getOperationLogs()` 可读取日志列表
- [x] `index.ts` 导出 `replayFailedOperations()` 仅重放 `failed` 幂等日志
- [x] 重放成功的删除日志、仍失败的保留日志

## 兼容性与验证

- [x] `Requester` 接口签名未改变，业务层（各 RepoImpl）无需改动
- [x] `@nao-todo/infrastructure` 通过 TypeScript 类型检查，无新增类型错误