# @nao-todo/infrastructure

基础设施层，提供各领域仓储接口的持久化实现与内置项目数据。

## 📦 模块划分

```text
packages/infrastructure/
└── src/
    ├── built-in/            # 内置项目（所有任务 / 今日 / 本周…）默认数据与仓储实现
    ├── persistence-go/      # Web API 持久化（远程后端）
    └── persistence-local/   # 本地持久化（桌面端 IndexedDB + AES-GCM 加密）
```

### `built-in/` — 内置项目

内置清单（所有任务、今日任务、本周任务等）的默认定义与仓储实现，`default.ts` 提供各内置项目的创建任务默认选项（如"今日任务"自动带 `startAt`/`endAt`）。

### `persistence-go/` — Web API 持久化

通过 HTTP 请求远程后端，实现各领域仓储接口：

- `identity/` — 认证与用户仓储（`auth-repo-impl`、`user-repo-impl`、`user-config-repo-impl`）
- `pomodoro/` — 番茄钟与记录仓储
- `project/` — 项目与偏好仓储
- `tag/` — 标签与偏好仓储
- `task/` — 任务、检查事项、评论仓储
- `models/` — 后端 API 数据模型（user / project / tag / task / pomodoro / auth / base）
- `utils.ts` — 请求辅助工具

### `persistence-local/` — 本地持久化（桌面端）

基于 Dexie (IndexedDB) 的本地数据层，用于桌面端离线使用：

- `crypto/crypto-service.ts` — 双层密钥加密：密码经 PBKDF2-SHA256（60 万次迭代）派生 KEK，KEK 解开随机 DEK，业务数据用 DEK 做 AES-GCM 加密；DEK 仅存内存
- `db/local-database.ts` — Dexie 数据库定义（结构字段明文保索引，内容字段加密）
- `session/local-session.ts` — 本地会话管理
- `deletion/deletion-service.ts` — 注销反悔期（宽限期）本地数据清理
- `repos/` — 各领域仓储的本地实现（project / tag / task / pomodoro / user 及其子项）

## 🔗 依赖

- 全部 `@nao-todo/domain-*` 包（workspace，实现其仓储接口）
- `@nao-todo/shared`（workspace）
- `dayjs`、`dexie`
- 开发依赖：`fake-indexeddb`（本地仓储单测）