# @nao-todo/shared

共享层，提供各包共用的工具函数、通用组件、类型定义与国际化。

## 📁 目录结构

```text
packages/shared/
├── commands/        # 命令系统（注册、匹配、作用域管理）
├── components/      # 通用 Vue 组件
├── constants/       # 常量（对话框键、任务常量等）
├── entity.ts        # Entity 基类（id / 时间戳 / 软删除等公共字段）
├── hooks/           # 通用组合式函数
├── index.ts         # 包入口
├── locales/         # 国际化（zh-CN / en-US + i18n 装配）
├── requester/       # HTTP 请求器（Axios 封装）
├── types/           # 通用类型（Go 响应、SSE 等）
├── utils/           # 工具函数
└── valueobjects/    # 通用值对象（json-string、query-options）
```

## 📦 模块说明

- **`commands/`** — 命令注册表与匹配器、作用域管理器，供全局快捷键命令使用
- **`components/`** — 通用组件：表单类（`checkbox`、`input-button`、`combo-box`、`switch-button`）、任务展示类（`task-basic-info`、`task-date-info`、`task-priority-info`、`task-state-info`、`task-check-button`）、看板类（`project-board`、`project-card`、`tag-board`、`tag-card`）、评论类（`comment-creator`、`comment-row`）、对话框/弹层（`dialog-wrapper`、`dropdown-div-block`）、其他（`pager`、`smart-list`、`empty`、`loading-error` 等）
- **`constants/`** — 对话框键、任务相关常量
- **`entity.ts`** — 所有领域实体继承的 `Entity` 基类（id、createdAt、updatedAt、软删除状态）
- **`hooks/`** — 通用组合式函数：store 基类（`use-store-base`、`use-list-store-base`、`use-mapper-store-base`、`use-loading-error-store-base`）、UI（`use-aside-width`、`use-responsive-aside`、`use-dialog-manager`、`use-drag-sorter`、`use-resize-observer`、`use-timer-driver`）、`use-sse`（SSE 提醒）、`use-minute-task` 等
- **`locales/`** — `zh-CN` / `en-US` 语言包与 i18n 装配
- **`requester/`** — Axios 封装：统一 `Requester` 接口、幂等请求自动重试（指数退避）、操作日志
- **`types/`** — Go 后端响应类型、SSE 事件类型等
- **`utils/`** — 工具函数：日期判断（`date-checker`）、相对日期解析（`relative-date-parser`）、提醒解析（`reminder-parser`）、JWT payload 解析（`get-jwt-payload`）、头像（`avatar`）、Go 错误解包（`unwrap-go-error`）、任务属性解析（`task-attributes-parser`）等
- **`valueobjects/`** — `json-string`（JSON 字符串值对象）、`query-options`（查询选项）

## 🔗 依赖

- 无内部 workspace 依赖；仅外部依赖（如 `axios` 等，由根 `package.json` 提供）