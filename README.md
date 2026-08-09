# NaoTodo

## 🚀 项目简介

NaoTodo 是一个待办任务管理平台，旨在为用户提供简洁高效的任务管理体验。该平台基于 Vue 3、Vite+（Rolldown）、TypeScript、NueUI、Pinia 构建，采用 pnpm monorepo 架构，并遵循 DDD（领域驱动设计）分层设计。

项目包含两个客户端：

- **Web 客户端**（`apps/web`）：基于 Vue 3 + Vite+ 的在线版本
- **桌面客户端**（`apps/desktop`）：基于 Electron 的桌面版本，业务数据完全本地化（IndexedDB + AES-GCM 加密），认证沿用远程后端

## 🌐 站点地址

- [NaoTodo](https://todo.nathanap.space/)

## 👨‍💻 开发者信息

- **作者**：Nathan Lee
- **GitHub 仓库**：[NaoTodo GitHub 仓库](https://github.com/Nathan3303/nao-todo)

## 🛠️ 技术栈

- **前端框架**：Vue 3 (Composition API)
- **构建工具**：[Vite+](https://viteplus.dev/)（基于 Vite 7 / Rolldown）
- **UI 框架**：[NueUI](https://github.com/Nathan3303/nue-ui) + NueUI Theme Shadlike
- **状态管理**：Pinia
- **路由**：Vue Router（Hash 模式）
- **国际化**：Vue I18n
- **HTTP 请求**：Axios
- **日期处理**：Day.js
- **本地存储**：localStorage（Web）/ Dexie + IndexedDB（桌面端，AES-GCM 加密）
- **桌面框架**：Electron（electron-vite 构建）
- **编程语言**：TypeScript
- **包管理**：pnpm（monorepo）

## 📐 架构

项目遵循 DDD 分层架构，依赖方向为 **Views → Presentation → Application → Domain → Infrastructure**（单向依赖）。视图层位于 `apps/`，领域与应用层按限界上下文拆分在 `packages/domain-*`，每个领域包内含 `domain/`（实体、值对象、仓储接口、领域服务）与 `application/`（usecases、viewobjects）两层。

```
nao-todo/
├── apps/
│   ├── web/                    # Web 客户端
│   └── desktop/                # Electron 桌面客户端（本地加密存储）
└── packages/
    ├── domain-built-in-project/# 内置项目领域（今天 / 本周等）
    ├── domain-identity/        # 身份认证领域（用户、JWT）
    ├── domain-pomodoro/        # 番茄钟领域
    ├── domain-project/         # 项目领域
    ├── domain-tag/             # 标签领域
    ├── domain-task/            # 任务领域（任务、检查项、评论）
    ├── infrastructure/         # 基础设施层 — persistence-go（Web API）、persistence-local（IndexedDB + 加密）
    ├── presentation/           # 表现层 — 组件、hooks、Pinia Store
    ├── presentation-identity/  # 身份表现层 — 用户 Store、认证组件
    └── shared/                 # 共享层 — 工具函数、通用组件、类型定义、国际化
```

## 📁 项目结构

```
nao-todo/
├── apps/
│   ├── web/              # Web 客户端
│   └── desktop/          # 桌面客户端（Electron）
├── packages/
│   ├── domain-built-in-project/  # 内置项目领域
│   ├── domain-identity/          # 身份认证领域
│   ├── domain-pomodoro/          # 番茄钟领域
│   ├── domain-project/           # 项目领域
│   ├── domain-tag/               # 标签领域
│   ├── domain-task/              # 任务领域
│   ├── infrastructure/           # 基础设施层
│   ├── presentation/             # 表现层
│   ├── presentation-identity/    # 身份表现层
│   └── shared/                   # 共享层
├── pnpm-workspace.yaml   # pnpm 工作区配置
├── package.json          # 根脚本与依赖
└── vite.config.ts        # 工具链配置
```

## 🎨 功能特性

1. **任务管理**：支持任务的创建、编辑、删除及查看详情。
2. **多视图**：支持表格视图、列表视图和看板视图，可灵活切换。
3. **优先级设置**：可为任务设置高、中、低三种优先级。
4. **进度状态**：支持待办、正在进行、已完成等多种进度状态。
5. **截止日期**：为任务添加截止日期，提醒按时完成。
6. **检查事项**：为任务添加子步骤，进一步细分任务，快速了解进度。
7. **评论功能**：为任务添加评论，记录任务进展与想法。
8. **清单与标签**：创建清单和标签以分类和标记任务。
9. **番茄钟**：专注计时器，支持自定义时长、任务关联与记录统计。
10. **日历视图**：按截止日期在日历中查看任务分布。
11. **任务提醒**：为任务设置提醒时间；Web 端经 SSE 实时提醒，桌面端本地定时扫描并发送系统通知。
12. **全局搜索**：跨模块搜索任务和内容。
13. **用户系统**：支持账号注册、登录及个人信息管理。
14. **多语言**：支持中文、英文等多语言切换。

## 🚀 快速开始

### 环境要求

- Node.js >= 24
- pnpm >= 8（推荐 11，见根 `package.json` 的 `packageManager` 字段）

### 安装与运行

```bash
# 安装依赖
pnpm install

# 启动 Web 客户端
pnpm webapp dev
```

### 桌面端（Electron）

```bash
# 开发（electron-vite dev，HMR）
pnpm desktop:dev

# 构建三端产物到 out/
pnpm desktop:build

# 构建 + electron-builder 出 NSIS 安装包
pnpm desktop:dist
```

### 构建

```bash
# 构建 Web 客户端
pnpm webapp build
```

## 📝 贡献指南

欢迎对 NaoTodo 做出贡献！在提交代码之前，请确保：

1. 提交 Pull Request 前，先确保所有测试通过。
2. 详细描述你的更改内容和目的。

## 📜 许可证

NaoTodo 项目遵循 [MIT 许可证](https://github.com/Nathan3303/nao-todo/blob/main/LICENSE)。你可以自由地使用、复制、修改和分发该项目，但请保留原作者和版权信息。

## 💡 鸣谢

感谢所有参与 NaoTodo 项目开发、测试、反馈的用户和贡献者！特别感谢 Vue、Vite、Pinia、NueUI、Axios 以及 TypeScript 的开发团队，为前端开发提供了强大的工具和框架。