# 网络请求错误记录与重试功能 Spec

## Why
当前所有网络请求都经由统一的 `Requester` 抽象（[axios.ts](../../../packages/infrastructure/requester/axios.ts)），其响应拦截器仅把网络错误（超时、断网、限流）转换为统一的错误响应载荷，然后返回给业务层。存在两个缺口：

1. **无错误记录**：网络失败的操作没有任何持久化痕迹，页面刷新后无从排查，也无法在网络恢复后补偿失败的写操作。
2. **无自动重试**：偶发的网络抖动 / 超时会直接失败，用户需手动重试。

本次改动在 `Requester` 层引入「操作日志（IndexedDB 持久化）」+「幂等请求自动重试」两项能力，缺口互补：日志记录失败操作用于排查与补偿，重试自动消化偶发网络错误。

## What Changes
- 新增基于 Dexie（IndexedDB）的**操作日志存储**：请求发起时写入一条 `pending` 日志，成功后删除该日志，网络失败后保留并标记为 `failed`（含错误码 / 错误信息 / 重试次数）。
- 在 axios 响应拦截器中新增**自动重试**：仅针对网络 / 超时错误（`ECONNABORTED`、`ERR_NETWORK`）且**幂等方法**（`GET` / `PUT` / `DELETE`，排除 `POST`），最多重试 2 次，采用指数退避（默认 300ms → 600ms）。
- 提供**读取 / 重放日志**的 API：可读取遗留的 `failed` 幂等操作日志并重新派发（供后续在应用启动或网络恢复时调用）。
- 新增**重试开关**：`initRequester` 支持 `enableRetry` 选项（默认开启），关闭时不进行自动重试，直接归一化错误；开关不影响操作日志的记录。
- 上述能力全部内聚在 `packages/infrastructure/requester/` 内，业务层（各 RepoImpl / UseCase）**无需改动**，调用方式保持不变。

## Impact
- Affected specs: 网络请求器（requester）能力扩展。
- Affected code:
  - `packages/infrastructure/requester/types.ts`（新增操作日志相关类型）
  - `packages/infrastructure/requester/operation-log.ts`（**新增**，Dexie 操作日志存储）
  - `packages/infrastructure/requester/retry.ts`（**新增**，重试判定与退避计算）
  - `packages/infrastructure/requester/axios.ts`（拦截器集成重试；方法包装集成日志）
  - `packages/infrastructure/requester/index.ts`（导出操作日志 / 重放 API；`UseRequesterOptions` 增加 `enableRetry`）
- 依赖：`dexie ^4.4.2`（已安装，尚未被使用，本次首次启用）。

## 设计约束
- **不改动业务层**：只在 requester 内部实现，保持 `Requester` 接口签名不变。
- **幂等安全**：`POST` 不参与自动重试与重放，避免重复提交；其失败仅作为错误记录保留。
- **最小化**：日志字段只保留排查 / 重放所必需的信息；不引入配置化开关（重试次数 / 退避为固定常量）。
- **序列化安全**：写入 IndexedDB 的 `data` 仅保存可结构化克隆的请求体，`Authorization` 等敏感 header 不写入日志。

## ADDED Requirements

### Requirement: 操作日志持久化
系统 SHALL 使用 IndexedDB（Dexie）持久化网络操作日志，用于记录失败操作并支持后续排查与重放。

#### Scenario: 请求发起
- **WHEN** 通过 `Requester` 发起一次请求
- **THEN** 在 IndexedDB 中写入一条 `status = pending` 的操作日志，包含 `id`、`method`、`url`、`data`、`createdAt`

#### Scenario: 请求成功
- **WHEN** 该请求（含重试后）最终成功
- **THEN** 从 IndexedDB 删除对应的操作日志

#### Scenario: 请求最终失败
- **WHEN** 该请求在重试耗尽后仍失败，或为不可重试 / 非幂等失败
- **THEN** 将该日志 `status` 更新为 `failed`，并写入 `errorCode`、`errorMessage`、`retryCount`

### Requirement: 幂等请求自动重试
系统 SHALL 在网络 / 超时错误时对幂等方法（`GET` / `PUT` / `DELETE`）自动重试，最多 2 次，指数退避。

#### Scenario: 幂等请求遇到网络错误
- **WHEN** 一个 `GET` / `PUT` / `DELETE` 请求因 `ECONNABORTED` 或 `ERR_NETWORK` 失败，且已重试次数 < 2
- **THEN** 按指数退避（第 1 次 300ms，第 2 次 600ms）等待后重新派发同一请求

#### Scenario: 重试成功
- **WHEN** 某次重试成功返回
- **THEN** 返回该成功响应，且不再继续重试，并删除其操作日志

#### Scenario: 重试耗尽
- **WHEN** 重试达到 2 次后仍为网络 / 超时错误
- **THEN** 回落到既有的统一错误响应归一化逻辑，并将操作日志标记为 `failed`

#### Scenario: 非幂等请求不重试
- **WHEN** 一个 `POST` 请求发生网络 / 超时错误
- **THEN** 不进行自动重试，直接归一化错误响应，并将操作日志标记为 `failed`

### Requirement: 重试机制开关
`Requester` SHALL 支持通过 `initRequester` 的 `enableRetry` 选项开启 / 关闭自动重试机制，默认开启。

#### Scenario: 关闭重试
- **WHEN** 以 `enableRetry = false` 初始化 Requester，且请求发生可重试的网络 / 超时错误
- **THEN** 不进行任何重试，直接归一化错误响应

#### Scenario: 默认开启
- **WHEN** 未显式传入 `enableRetry`
- **THEN** 自动重试机制生效（等价于 `enableRetry = true`）

#### Scenario: 开关不影响日志
- **WHEN** `enableRetry = false`
- **THEN** 操作日志（`pending` / 成功删除 / 失败 `failed`）仍照常记录

### Requirement: 失败日志读取与重放
系统 SHALL 提供读取操作日志与重放 `failed` 幂等操作的 API。

#### Scenario: 读取日志
- **WHEN** 调用日志读取 API
- **THEN** 返回当前 IndexedDB 中的操作日志列表

#### Scenario: 重放失败操作
- **WHEN** 调用重放 API
- **THEN** 读取 `status = failed` 且方法为幂等（`GET` / `PUT` / `DELETE`）的日志并重新派发；成功的删除其日志，仍失败的保留

## 假设与风险
- **假设**：既有响应拦截器把网络错误 `Promise.resolve` 成带 `code` 字符串的载荷；重试逻辑将放在拦截器内、归一化返回**之前**触发，以便获取 `error.config` 重新派发。
- **假设**：重放 API 仅提供能力，是否在应用启动 / 网络恢复时自动调用，由后续接入决定，不在本次范围内强制接线。
- **风险**：为每个请求写 / 删 IndexedDB 会带来少量额外 IO；因写入为异步且不阻塞主请求流程，影响可接受。
