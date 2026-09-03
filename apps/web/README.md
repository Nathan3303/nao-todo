# NaoTodo Web 客户端

基于 Vue 3 + Vite+ 构建的 NaoTodo Web 客户端，采用 DDD（领域驱动设计）分层架构。

## 🛠️ 技术栈

- **框架**：Vue 3 (Composition API)
- **构建工具**：Vite+（基于 Vite 7 / Rolldown，`vp dev` 驱动）
- **UI 框架**：NueUI + NueUI Theme Shadlike
- **状态管理**：Pinia
- **路由**：Vue Router (Hash 模式)
- **国际化**：Vue I18n
- **HTTP 请求**：Axios
- **本地存储**：localStorage
- **日期处理**：Day.js
- **样式**：原生 CSS
- **编程语言**：TypeScript

## 📐 架构

采用 DDD 分层架构，依赖方向严格遵循 Views → Presentation → Application → Domain → Infrastructure。视图层与页面组件位于 `apps/web/src`，领域/应用/表现/基础设施层位于 `packages/` 下的各包：

```text
apps/web/
└── src/
    ├── views/          # 视图层 — 页面入口组件与路由
    └── components/     # 展示组件 — 基于 NueUI 的 UI 组件
```

业务逻辑、状态管理、领域模型位于 `packages/` 下的各层：

- `@nao-todo/domain-*` — 各限界上下文的领域内核（`domain/` 实体与仓储接口 + `application/` 用例）
- `@nao-todo/presentation` — 表现层组件与 hooks
- `@nao-todo/presentation-identity` — 身份表现层（用户 Store、认证组件）
- `@nao-todo/infrastructure` — 基础设施（`persistence-go`：Web API 实现）
- `@nao-todo/shared` — 共享工具、组件、类型、国际化

## 📁 目录结构

```text
apps/web/
├── public/               # 静态资源（字体、图标、图片）
├── src/
│   ├── commands/         # 全局快捷键命令
│   ├── components/       # 展示组件
│   │   ├── app/          # 应用布局（侧边栏 aside / aside-v2、对话框适配）
│   │   ├── auth/         # 认证组件（登录、注册、检入）
│   │   ├── calendar/     # 日历组件（月视图、侧边栏）
│   │   ├── pomodoro/     # 番茄钟组件（计时器、记录、侧边栏）
│   │   ├── settings/     # 设置组件（个人信息、密码、应用）
│   │   └── tasks/        # 任务组件（内置项目、项目、标签、表格/看板/列表、详情）
│   ├── hooks/            # 组合式函数（快捷键、主题、usecases 装配）
│   ├── themes/           # 主题样式（原生 CSS）
│   ├── views/            # 页面视图与路由
│   │   ├── auth/         # 认证页面（登录、注册、检入）
│   │   └── index/        # 主页面
│   │       ├── tasks/     # 任务管理
│   │       ├── calendar/  # 日历视图
│   │       ├── pomodoro/  # 番茄钟
│   │       ├── search/    # 全局搜索
│   │       └── settings/  # 用户设置
│   ├── app.ts            # 应用初始化逻辑
│   ├── App.vue           # 根组件
│   ├── context.ts        # 全局上下文
│   ├── env.ts            # 环境配置
│   ├── main.ts           # 应用入口
│   └── router.ts         # 路由配置（Hash 模式）
├── index.html
├── vite.config.ts
├── tsconfig*.json
└── package.json
```

## 🚀 快速开始

### 环境要求

- Node.js >= 24
- pnpm >= 8（推荐 11，见根 `package.json` 的 `packageManager` 字段）

### 安装与运行

```bash
# 在项目根目录安装依赖
pnpm install

# 启动开发服务器
pnpm webapp dev
```

开发服务器默认运行在 `http://localhost:5173`。

### 构建

```bash
# 构建生产版本
pnpm webapp build

# 预览构建结果
pnpm webapp preview
```

构建产物输出到 `dist/` 目录。

## 🧭 路由结构

路由使用 Hash 模式（`createWebHashHistory`），页面入口与路由在 `src/views/` 下按模块组织。

| 路径                                          | 名称                        | 说明                              |
| --------------------------------------------- | --------------------------- | --------------------------------- |
| `/auth`                                       | auth                        | 认证页面入口（未登录自动跳转）    |
| `/auth/signin`                                | auth-signin                 | 登录                              |
| `/auth/signup`                                | auth-signup                 | 注册                              |
| `/auth/checkin`                               | auth-checkin                | 检入（已持 JWT 时的快捷登录）     |
| `/tasks`                                      | tasks                       | 任务管理（重定向到 `/tasks/all`） |
| `/tasks/:projectId`                           | tasks-built-in-project      | 内置项目（all / today / week 等） |
| `/tasks/:projectId/:viewType/:taskId?`        | tasks-built-in-project-main | 内置项目任务视图与详情            |
| `/tasks/p/:projectId`                         | tasks-project               | 自定义项目                        |
| `/tasks/p/:projectId/:viewType/:taskId?`      | tasks-project-main          | 项目任务视图与详情                |
| `/tasks/t/:tagId`                             | tasks-tag                   | 标签                              |
| `/tasks/t/:tagId/:viewType/:taskId?`          | tasks-tag-main              | 标签任务视图与详情                |
| `/calendar`                                   | calendar                    | 日历视图（重定向到 monthly）      |
| `/calendar/monthly`                           | calendar-monthly            | 月视图                            |
| `/pomodoro`                                   | pomodoro                    | 番茄钟（重定向到 timer）          |
| `/pomodoro/timer`、`/pomodoro/focus/:taskId?` | pomodoro                    | 计时器 / 专注模式                 |
| `/pomodoro/pomodoros`                         | pomodoro-collection         | 番茄钟集合                        |
| `/pomodoro/records`                           | pomodoro-records            | 记录统计                          |
| `/search`                                     | search                      | 全局搜索                          |
| `/settings`                                   | settings                    | 用户设置（重定向到 profile）      |
| `/settings/profile`                           | settings-profile            | 个人信息                          |
| `/settings/password`                          | settings-password           | 修改密码                          |
| `/settings/app`                               | settings-app                | 应用设置                          |

其中 `viewType` 支持 `table`（表格）/ `list`（列表）/ `kanban`（看板）。

## 🎨 功能特性

### 任务管理

- **多视图**：支持表格视图、列表视图和看板视图，可灵活切换
- **智能列表**：内置项目（今天、本周、全部等），以及按清单或标签快速筛选任务
- **筛选与排序**：支持按优先级、状态等字段筛选，支持多条件排序
- **列配置**：表格视图支持自定义列显示与顺序
- **批量操作**：支持多选任务进行批量操作
- **拖拽操作**：看板视图支持拖拽改变任务状态
- **任务详情**：支持查看和编辑任务完整信息，包括子任务（检查事项）、评论、附件等

### 番茄钟

- 专注计时器，支持自定义工作时长和休息时长
- 任务关联，可将番茄钟记录绑定到具体任务
- 记录统计，查看专注时长和历史记录

### 日历

- 日历视图查看任务的截止日期分布

### 全局搜索

- 跨模块搜索任务和内容

### 用户设置

- **个人信息**：修改头像和昵称
- **密码管理**：修改账户密码
- **应用设置**：主题切换、语言切换等

## 📦 依赖的内部包

| 包名                                | 说明                               |
| ----------------------------------- | ---------------------------------- |
| `@nao-todo/domain-built-in-project` | 内置项目领域与用例                 |
| `@nao-todo/domain-identity`         | 身份认证领域（用户、JWT）          |
| `@nao-todo/domain-pomodoro`         | 番茄钟领域                         |
| `@nao-todo/domain-project`          | 项目领域                           |
| `@nao-todo/domain-tag`              | 标签领域                           |
| `@nao-todo/domain-task`             | 任务领域（任务、检查项、评论）     |
| `@nao-todo/infrastructure`          | 基础设施（Web API 实现）           |
| `@nao-todo/presentation`            | 表现层组件与 hooks                 |
| `@nao-todo/presentation-identity`   | 身份表现层（用户 Store、认证组件） |
| `@nao-todo/shared`                  | 共享工具、类型、国际化             |