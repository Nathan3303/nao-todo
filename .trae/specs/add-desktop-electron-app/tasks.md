# Tasks

- [x] Task 1: 搭建 Electron + Vite + Vue 3 项目骨架
  - [x] SubTask 1.1: 编写 `apps/desktop/package.json`，补充 electron、electron-builder、vite、@vitejs/plugin-vue 等 devDependencies，以及对 `@nao-todo/*` workspace 包的依赖；补充 `dev`/`build`/`preview` 脚本（参考 `apps/web` 与根 `package.json`）
  - [x] SubTask 1.2: 新增渲染进程 `apps/desktop/vite.config.ts`（复用 web 的 `@` 别名、vue 插件；`base: './'` 以兼容 Electron `file://`）、`tsconfig.json`/`tsconfig.app.json`/`tsconfig.node.json`（对齐 web）
  - [x] SubTask 1.3: 新增 `apps/desktop/index.html`（对齐 web，引入 pf/poppins/iconfont 字体与 `--nue-primary-font-family`），并复制/引用 `public/`（fonts、images）
  - [x] SubTask 1.4: 新增 `.env.development` / `.env.production` / `.env.example`（对齐 web 的 `VITE_*` 变量）
  - 验证：`pnpm desktop build` 通过，渲染进程构建配置无报错

- [x] Task 2: 编写 Electron 主进程与预加载
  - [x] SubTask 2.1: 新增 `apps/desktop/electron/main.cjs`：创建 BrowserWindow，开发环境 `loadURL(vite dev server)`，生产环境 `loadFile(dist/index.html)`；处理窗口生命周期
  - [x] SubTask 2.2: 新增 `apps/desktop/electron/preload.cjs`（最小化，contextIsolation 安全默认）
  - [x] SubTask 2.3: 在 `package.json` 中配置 `main` 入口与 electron 启动脚本（dev 用 concurrently 先起 vite 再起 electron），配置 electron-builder 基础打包字段
  - 验证：`node --check` 主进程/预加载语法通过（注：Electron 二进制在当前沙箱因网络受限无法下载，无法实际拉起窗口）

- [x] Task 3: 移植应用外壳与路由（裁剪至 auth + tasks）
  - [x] SubTask 3.1: 移植根外壳 `src/{main.ts, App.vue, app.ts, context.ts, router.ts, vite-env.d.ts}`
  - [x] SubTask 3.2: 移植 `src/infrastructure/{themes, constants, commands, handlers, hooks, utils}` 全部所需文件（含 pomodoro 相关，因经 stores/aside 传递依赖）
  - [x] SubTask 3.3: 移植 `src/stores/**`（base、hooks、tasks-view、pomodoro-view 及各 store 文件）
  - [x] SubTask 3.4: 裁剪 `src/views/index/routes.ts`，仅注册 tasks 路由；移植 `src/views/index/{index.vue, index-view.ts, context.ts}`；同步裁剪 `app.ts` 侧栏链接、删除 calendar/pomodoro/search/settings 页面目录
  - 验证：`pnpm desktop build` 阶段所有模块可解析，无缺失导入

- [x] Task 4: 移植登录/注册页面
  - [x] SubTask 4.1: 移植 `src/views/auth/{auth-view.ts, context.ts, entry.vue, routes.ts}`
  - [x] SubTask 4.2: 移植 `src/layouts/auth/**`（index.ts、aside.vue、content/sign-in.vue、sign-up.vue、check-in.vue）
  - 验证：`sign-in`/`sign-up`/`entry` chunk 均出现在构建产物中，模块解析无误

- [x] Task 5: 移植任务页面及其依赖
  - [x] SubTask 5.1: 移植 `src/views/index/tasks/{entry.vue, tasks-view.ts, context.ts, routes.ts}`
  - [x] SubTask 5.2: 移植 `src/layouts/tasks/**`（aside、built-in-project、project、tag、task-multi-select）
  - [x] SubTask 5.3: 移植 `src/layouts/app/**`（aside、dialogs、task-details、view-adapters、index.ts）
  - [x] SubTask 5.4: 移植 `src/components/tasks/**` 与传递依赖的 `src/components/pomodoro/**`
  - 验证：`built-in-project`/`dialogs`/`view-adapters` 等 chunk 均出现在构建产物中

- [x] Task 6: 端到端联调与验证
  - [x] SubTask 6.1: `.env` 已指向后端 API（沿用 web 端配置）；`pnpm desktop build` 通过，渲染进程完整可构建
  - [x] SubTask 6.2: `pnpm desktop build` 生成 `dist/index.html` 与 chunk，主进程配置为生产环境加载该产物（Electron 二进制下载受沙箱网络限制，未做实际窗口拉起）
  - [x] SubTask 6.3: 逐项核对 checklist.md
  - 验证：checklist.md 全部勾选（Electron 运行时项因沙箱网络限制标注说明）

# Task Dependencies
- Task 2 依赖 Task 1（需先有项目骨架与脚本）
- Task 3 依赖 Task 1（需渲染进程 Vite/别名配置）
- Task 4 依赖 Task 3（依赖外壳、stores、router、infrastructure）
- Task 5 依赖 Task 3（依赖外壳、stores、infrastructure、components）
- Task 4 与 Task 5 之间无相互依赖，可并行
- Task 6 依赖 Task 2、Task 4、Task 5
