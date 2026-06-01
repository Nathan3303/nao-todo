# NaoTodo Web 客户端

基于 Vue 3 + Vite + TypeScript 构建的 NaoTodo Web 客户端。

## 🛠️ 技术栈

- **框架**：Vue 3 (Composition API)
- **构建工具**：Vite 8
- **UI 框架**：NueUI + NueUI Theme Shadlike
- **状态管理**：Pinia
- **路由**：Vue Router (Hash 模式)
- **国际化**：Vue I18n
- **HTTP 请求**：Axios
- **本地存储**：Dexie (IndexedDB)
- **Markdown 渲染**：markdown-it
- **样式**：原生 CSS

## 📁 目录结构

```
apps/web/
├── public/               # 静态资源
├── src/
│   ├── components/       # 组件
│   │   ├── settings/     # 设置相关组件（个人信息、密码、外观、语言）
│   │   └── tasks/        # 任务相关组件（表格、看板、列表、筛选、智能列表）
│   ├── infrastructure/   # 基础设施层
│   ├── layouts/          # 布局组件
│   ├── stores/           # Pinia Store
│   ├── views/            # 页面视图
│   │   ├── auth/         # 认证页面（登录、注册）
│   │   └── index/        # 主页面
│   │       ├── tasks/    # 任务页面
│   │       ├── calendar/ # 日历页面
│   │       └── settings/ # 设置页面
│   ├── App.vue           # 根组件
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
| `/settings`      | settings | 用户设置 |

## 🎨 功能特性

### 任务管理

- **多视图**：支持表格视图、列表视图和看板视图，可灵活切换
- **智能列表**：按筛选条件、清单或标签快速筛选任务
- **筛选与排序**：支持按优先级、状态等字段筛选，支持多条件排序
- **列配置**：表格视图支持自定义列显示与顺序
- **批量操作**：支持多选任务进行批量操作
- **拖拽操作**：看板视图支持拖拽改变任务状态

### 日历

- 日历视图查看任务的截止日期分布

### 用户设置

- **个人信息**：修改头像和昵称
- **密码管理**：修改账户密码
- **外观设置**：主题切换
- **语言切换**：多语言支持

## 📦 依赖的内部包

| 包名                       | 说明               |
| -------------------------- | ------------------ |
| `@nao-todo/application`    | 应用层逻辑         |
| `@nao-todo/components`     | 通用 UI 组件       |
| `@nao-todo/domain`         | 领域模型与业务逻辑 |
| `@nao-todo/infrastructure` | 基础设施           |
| `@nao-todo/types`          | 共享类型定义       |

