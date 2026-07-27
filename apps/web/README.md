# NaoTodo Web 客户端

基于 Vue 3 + Vite + TypeScript 构建的 NaoTodo Web 客户端，采用 DDD（领域驱动设计）分层架构。

## 🛠️ 技术栈

- **框架**：Vue 3 (Composition API)
- **构建工具**：Vite 8
- **UI 框架**：NueUI + NueUI Theme Shadlike
- **状态管理**：Pinia
- **路由**：Vue Router (Hash 模式)
- **国际化**：Vue I18n
- **HTTP 请求**：Axios
- **本地存储**：Dexie (IndexedDB)
- **密码加密**：SparkMD5
- **日期处理**：Day.js
- **Markdown 渲染**：markdown-it
- **样式**：原生 CSS

## 📐 架构

采用 DDD 分层架构，依赖方向严格遵循 Views → Presentation → Application → Domain → Infrastructure。

```text
apps/web/
└── src/
    ├── views/          # 视图层 — 页面入口组件
    └── components/     # 展示组件 — 基于 NueUI 的 UI 组件
```

业务逻辑、状态管理、领域模型位于 `packages/` 下的各层：

- `@nao-todo/presentation` — Pinia Store + 表现层逻辑
- `@nao-todo/application` — 应用层用例（usecases）
- `@nao-todo/domain` — 领域实体与仓储接口
- `@nao-todo/infrastructure` — 基础设施（API、IndexedDB 实现）
- `@nao-todo/shared` — 共享工具、组件、类型、国际化

## 📁 目录结构

```text
apps/web/
├── public/               # 静态资源（字体、图标、图片）
├── src/
│   ├── commands/         # 全局快捷键命令
│   ├── components/       # 组件
│   │   ├── app/          # 应用布局组件（侧边栏、头部）
│   │   ├── auth/         # 认证相关组件
│   │   ├── calendar/     # 日历组件
│   │   ├── pomodoro/     # 番茄钟组件（计时器、记录、侧边栏）
│   │   ├── settings/     # 设置组件（个人信息、密码、外观、语言）
│   │   └── tasks/        # 任务组件（表格、看板、列表、筛选、详情）
│   ├── hooks/            # 组合式函数
│   ├── themes/           # 主题样式
│   ├── views/            # 页面视图
│   │   ├── auth/         # 认证页面（登录、注册）
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
│   └── router.ts         # 路由配置
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 🚀 快速开始

### 环境要求

- Node.js >= 24
- pnpm >= 8

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

| 路径             | 名称     | 说明     |
| ---------------- | -------- | -------- |
| `/auth`          | -        | 认证页面 |
| `/tasks`         | tasks    | 任务管理 |
| `/tasks/:taskId` | -        | 任务详情 |
| `/calendar`      | calendar | 日历视图 |
| `/pomodoro`      | pomodoro | 番茄钟   |
| `/search`        | search   | 全局搜索 |
| `/settings`      | settings | 用户设置 |

## 🎨 功能特性

### 任务管理

- **多视图**：支持表格视图、列表视图和看板视图，可灵活切换
- **智能列表**：按筛选条件、清单或标签快速筛选任务
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
- **外观设置**：主题切换
- **语言切换**：多语言支持

## 📦 依赖的内部包

| 包名                       | 说明                   |
| -------------------------- | ---------------------- |
| `@nao-todo/presentation`   | Pinia Store + 表现层   |
| `@nao-todo/application`    | 应用层用例             |
| `@nao-todo/domain`         | 领域模型与仓储接口     |
| `@nao-todo/infrastructure` | 基础设施实现           |
| `@nao-todo/shared`         | 共享工具、类型、国际化 |