# Desktop 端应用（Electron）登录/注册 + 任务页面 Spec

## Why
当前 `apps/desktop` 仅是一个空壳 `package.json`，没有任何可运行代码。项目已在 `apps/web` 拥有成熟的 Vue 3 应用与共享的 `@nao-todo/*` workspace 包（domain / usecases / infrastructure / components）。用户希望在 Desktop 端交付一个与 Web 端**相同的应用**，首期范围聚焦于「登录/注册」与「任务」两大页面。

## What Changes
- 在 `apps/desktop` 搭建基于 **Electron** 的桌面外壳（主进程 + 预加载 + 渲染进程）。
- 渲染进程采用 **Vite + Vue 3**，完全复用 Web 端设计与 NueUI 主题，遵循现有 Web 端代码风格。
- 复用现有 workspace 包（`@nao-todo/domain`、`@nao-todo/usecases`、`@nao-todo/infrastructure`、`@nao-todo/components`、`nue-ui` 等），**不重复实现业务逻辑**。
- 从 `apps/web/src` 移植「登录/注册」与「任务」两大页面所需的本地源码（应用外壳、auth 视图、tasks 视图及其依赖的 layouts/stores/components/infrastructure）。
- 路由裁剪：`views/index/routes.ts` 仅注册 tasks 路由（不引入 calendar/pomodoro/search/settings 路由），保持范围最小化。
- 配置 Electron 开发（加载 Vite dev server）与生产打包（加载构建产物）脚本。

## Impact
- 受影响 specs：无（新增能力）。
- 受影响代码：
  - 新增 `apps/desktop/**`（Electron 主进程、预加载、渲染进程 src、配置文件）。
  - 根 `pnpm-workspace.yaml` 已包含 `apps/*`，无需改动；`apps/desktop/package.json` 将补充依赖与脚本。
  - 复用但不修改 `packages/**`。

## 关键技术决策（已与用户确认）
- **外壳框架**：Electron（纯 JS/Node 工具链，无需 Rust）。
- **设计方向**：完全复用 Web 端设计（NueUI 主题），遵循现有 Web 端代码风格。
- **功能范围**：仅登录/注册 + 任务页面。
- **浏览器 API**：Electron 渲染进程即 Chromium，`localStorage`、`EventSource`(SSE)、`Notification`、`window.matchMedia`、`document`/DOM、`requestAnimationFrame` 等均原生可用，移植时**无需为这些 API 做适配**。
- **环境变量**：沿用 Web 端 Vite `.env` 机制（`VITE_API_BASE_URL` 等），渲染进程通过 `import.meta.env` 读取。
- **路由历史**：沿用 `createWebHashHistory()`，兼容 Electron `file://` 生产环境。

## ADDED Requirements

### Requirement: Electron 桌面外壳
系统 SHALL 提供一个可运行的 Electron 桌面应用，开发环境加载 Vite dev server，生产环境加载打包后的渲染进程产物。

#### Scenario: 开发环境启动
- **WHEN** 开发者运行 `pnpm desktop dev`
- **THEN** Electron 主进程启动并打开窗口，窗口加载本地 Vite dev server 渲染的 NaoTodo 应用，支持热更新

#### Scenario: 生产打包
- **WHEN** 开发者运行 `pnpm desktop build`
- **THEN** 先构建渲染进程静态产物，Electron 主进程能够加载该产物并正常显示应用

### Requirement: 登录/注册页面
系统 SHALL 在 Desktop 端提供与 Web 端一致的登录、注册与登录状态检查（check-in）流程，复用 `@nao-todo/usecases/auth`。

#### Scenario: 登录成功
- **WHEN** 用户在登录页输入正确的邮箱和密码并提交
- **THEN** 调用 auth use case 完成登录，存储 JWT，并跳转到任务页面

#### Scenario: 注册成功
- **WHEN** 用户在注册页填写邮箱、密码、确认密码、昵称并提交
- **THEN** 调用 auth use case 完成注册并跳转到登录页

#### Scenario: 已持有 JWT 的自动检入
- **WHEN** 应用启动且本地存在有效 JWT
- **THEN** 进入 check-in 页验证令牌，成功后跳转到上次访问路由或任务页

### Requirement: 任务页面
系统 SHALL 在 Desktop 端提供与 Web 端一致的任务页面，包括内建项目 / 自定义项目 / 标签三类任务集合，列表 / 表格 / 看板三种视图，任务详情抽屉，以及任务/项目/标签相关对话框，复用 `@nao-todo/usecases/*`。

#### Scenario: 浏览任务列表
- **WHEN** 用户登录后进入任务页
- **THEN** 默认展示内建项目「全部」的任务集合，可切换列表/表格/看板视图

#### Scenario: 打开任务详情
- **WHEN** 用户点击某个任务
- **THEN** 打开任务详情抽屉，展示任务基础信息、检查项、评论等

#### Scenario: 通过对话框创建任务/项目/标签
- **WHEN** 用户触发创建任务/项目/标签操作
- **THEN** 弹出对应对话框，提交后经 use case 持久化并刷新视图

## MODIFIED Requirements
无。

## REMOVED Requirements
无。
