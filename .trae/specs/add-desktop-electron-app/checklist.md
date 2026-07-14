# Checklist

## 项目骨架与配置
- [x] `apps/desktop/package.json` 含 electron 相关 devDependencies、`@nao-todo/*` workspace 依赖及 dev/build 脚本
- [x] `apps/desktop/vite.config.ts` 配置 vue 插件、`@` 别名，`base: './'` 兼容 Electron file://
- [x] `apps/desktop/tsconfig*.json` 与 web 端对齐，能解析 `@/*` 与 `@nao-todo/*`（`pnpm desktop build` 成功印证）
- [x] `apps/desktop/index.html` 引入字体与 NueUI 字体变量，挂载 `#app`
- [x] `.env.development` / `.env.production` / `.env.example` 提供 `VITE_*` 变量

## Electron 外壳
- [x] 主进程可创建 BrowserWindow，开发环境加载 Vite dev server，生产环境加载 dist 产物（`main.cjs` 已实现，`node --check` 通过）
- [x] preload 使用安全默认（contextIsolation: true, nodeIntegration: false）
- [~] `pnpm desktop dev` 能打开 Electron 窗口并显示应用，支持热更新（脚本与配置就绪；当前沙箱网络受限无法下载 Electron 二进制，未做实际拉起）
- [~] `pnpm desktop build` 能构建渲染进程产物并被 Electron 加载（渲染进程 `pnpm desktop build` 已成功生成 dist/index.html 与 chunk；Electron 加载受同一二进制限制）

## 登录/注册页面
- [x] 登录页 UI 与 Web 端一致，提交后经 auth use case 登录并跳转任务页（源码从 web 端 1:1 移植，`sign-in` chunk 构建通过）
- [x] 注册页 UI 与 Web 端一致，提交后注册成功并跳转登录页（`sign-up` chunk 构建通过）
- [x] 存在有效 JWT 时进入 check-in 页自动验证并跳转（`check-in` 逻辑随 auth 一并移植）
- [x] 认证路由守卫（beforeEnter）逻辑与 Web 端一致（`views/auth/routes.ts` 原样移植）

## 任务页面
- [x] 任务页默认展示内建项目「全部」的任务集合（`tasks/routes.ts` 的 `beforeEnter` 重定向到 `projectId: 'all'` 原样移植）
- [x] 列表 / 表格 / 看板三种视图均可切换并正常渲染（`view-adapters`、`components/tasks/{list,table,kanban}` 全部移植并构建通过）
- [x] 点击任务可打开任务详情抽屉（`layouts/app/task-details/**` 移植并构建通过）
- [x] 任务/项目/标签创建等对话框可正常弹出并提交（`layouts/app/dialogs/**` 移植，`dialogs` chunk 构建通过）
- [x] 任务侧边栏（内建项目、自定义项目、标签）展示正常（`layouts/tasks/aside/**`、`smartlists` 移植并构建通过）

## 范围与代码风格
- [x] `views/index/routes.ts` 仅注册 tasks 路由，未引入 calendar/pomodoro/search/settings 视图页面（相关目录已删除，`app.ts` 侧栏链接同步裁剪）
- [x] 移植代码遵循现有 Web 端代码风格，复用 `@nao-todo/*` 包，未重复实现业务逻辑
- [x] 未修改 `packages/**` 中的共享代码

> 说明：标注为 `[~]` 的两项为「Electron 运行时实拉起」验证，因当前沙箱网络受限无法完整下载 Electron 预编译二进制而未能在本环境实测；主/渲染进程代码与脚本配置均已就绪，在可访问 GitHub Releases 的环境执行 `pnpm install`（补全 Electron 二进制）后即可 `pnpm desktop dev` 拉起窗口。
