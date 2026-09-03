# @nao-todo/presentation

表现层（业务组件与状态）包，按领域模块组织，供 Web 与桌面端复用。

## 📁 目录结构

```text
packages/presentation/
├── built-in-project/   # 内置清单表现层
├── pomodoro/           # 番茄钟表现层
├── project/            # 项目表现层
├── tag/                # 标签表现层
├── task/               # 任务表现层
└── index.ts            # 包入口
```

每个模块统一包含以下层次：

- **`handlers/`** — 业务处理器（调用领域用例并维护 UI 状态）
- **`hooks/`** — 组合式函数（装配领域用例与 store）
- **`stores/`** — Pinia Store（UI 状态）
- **`components/`** — 业务组件（部分模块）
- **`utils/` / `constants/`** — 模块内工具与常量（部分模块）

## 📦 模块说明

### `built-in-project/` — 内置清单

内置项目的加载与偏好管理：`built-in-project.ts`（handler）、`use-built-in-project`（hook）、`built-in-projects-store`（store）。

### `pomodoro/` — 番茄钟

- **components/**：`timer`（计时器）、`focus`（专注视图）、`focus-ring`、`indicator`、`form`、`note-inputer`、`record-list`（记录列表）
- **stores/**：`pomodoro-timer-store`（计时状态）、`pomodoro-focus-store`、`pomodoro-session-store`、`pomodoros-store`、`pomodoro-records-store`
- **hooks/**：`use-pomodoro-record-store-base`、`use-pomodoro-records-stats`（统计）、`use-pomodoro-record-loader`
- **utils/**：`pomodoro.ts`、`pomodoro-persistence.ts`

### `project/` — 项目

- **components/**：`smart-list`（智能列表）、`dialogs`（创建/编辑对话框）
- **handlers/hooks/stores**：`project.ts` handler、`use-project-store-base` hook、`projects-store` store

### `tag/` — 标签

- **components/**：`smart-list`、`dialogs`
- **handlers/hooks/stores**：`tag.ts` handler、`use-tag-store-base` hook、`tags-store` store

### `task/` — 任务

- **components/**：`table`（表格视图）、`kanban`（看板视图）、`list`（列表视图）、`view-adapters`（视图适配）、`task-details`（任务详情）、`multi-select`（批量操作）、`remind-setter`（提醒设置）、`date-selector`、`dropdowns`、`dialogs`、`project-selector`、`tag-bar`
- **handlers/**：`task.ts`、`task-check-item.ts`、`task-comment.ts`
- **hooks/**：`use-task-store-base`、`use-task-loader`、`use-task-check-item-store-base`、`use-task-comment-store-base`
- **stores/**：`tasks-store`、`task-details-store`
- **utils/**：`error-message.ts` 等

## 🔗 依赖

- 对应 `@nao-todo/domain-*` 包（workspace，装配其用例）
- `@nao-todo/shared`（workspace）
- Vue 3 / Pinia / NueUI 等（由消费方提供，见根 `package.json`）