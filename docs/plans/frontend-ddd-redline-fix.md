# 前端 DDD 红线修复记录（R5 / R8）

> 2026-09 · nao-todo · 依据 `.agents/skills/nao-frontend-ddd` 红线逐项收口。
> 本轮完成：R5（Domain 依赖收口）、R8 W1–W5（DI 组装收口到 Hook / Feature 根）。

## 背景红线

- R5：DTO/传输概念不进 Domain；Domain 仅纯 TS，不引请求/框架；不引 shared 根桶（根桶含 requester/axios）。
- R8：业务依赖禁经 Context/Provide 传播；DI 组装点为 Hook/Composable；Views 只组装无业务。

## 一、R5 — Domain/Application 依赖收口（已落地）

改动要点：

1. `packages/shared/types/pagination.ts` 新增中立 `Pagination`；`types/response.ts` 移除 `ResponseDataPagination`（传输命名），信封 `ResponseData.pagination?: Pagination`。
2. `ResponseDataPagination → Pagination` 全量改名：domain（仓储接口/领域服务/应用用例）、infrastructure（go/local 仓储与 models 信封）、presentation（loader 状态类型）共 80+ 文件。
3. **70 个 domain/application 文件**从 `@nao-todo/shared` 根桶改写为**纯子路径**导入：
    - `@nao-todo/shared/types`（Go/GoAsync/Nullable*/ViewObjectBase/Pagination）
    - `@nao-todo/shared/constants/task`（GetTasksOptions/TaskColumnOptions）
    - `@nao-todo/shared/valueobjects/query-options`（QueryOptionsValueObject，值）
    - `@nao-todo/shared/entity`（Entity 基类，值）
    - 结论：Domain/Application 连模块图都不含 requester/axios。
4. 守卫：`scripts/guard-domain-isolation.mjs`（`pnpm guard:ddd`）拦截「domain 引根桶 / ResponseDataPagination」，已接入根 `package.json`。

## 二、R8 — DI 组装收口（W1–W5 已落地）

### 最终形态（Vue，CSR）

- **Context 只承载 UI 状态与服务**：dialogManager、appSubscriber（应用级事件总线）、响应式开关/宽度、纯查询方法（getProjectName/getTagColor/showTaskDetails/getColumnLabel 等）。**业务用例/Handler 一律不进 Context**。
- **业务依赖组装点**：
    - 消费组合式内：`useXxxUseCase(store)`（如 `useCalendarMonthly` 自组装 `taskUseCase`）；
    - Feature 根视图：本地组装后提供给自家 feature 子树（详情预上下文 `TASK_DETAILS_PRE_CONTEXT` 由 tasks/calendar/pomodoro 三处各自本地组装）。
    - 共享组件（跨视图复用的 `packages/presentation/*`，不能引 app hooks）依赖经 feature 根**单次 provide/或 props** 注入（见下方 B 例外）。
- `INDEX_VIEW_CONTEXT` / `TASKS_VIEW_CONTEXT` / `CALENDAR_VIEW_CONTEXT` 等已全部去业务化。
- Handler 单例：`useAppHandlers()`（`apps/web/src/hooks/usecases/use-app-handlers.ts`），绑定应用级事件总线（`useSubscriber` 已单例化）与全局 store。

### B 例外（约定，文档化）

> 共享展示组件无法自组装（presentation 层不含 infra、不能引 app hooks），允许在 **feature 根**做唯一一次 provide（或 props）作为「构造注入边界」。
> 约束：不得逐层转发父视图业务、不得在中间层 Context 携带业务、叶子一律使用组合式/Props 取依赖。
> 若需严格到 letter 级，可仿 `presentation-react` 先例让共享 feature 自组装（presentation 引入 infrastructure）——按需另行立项。

### 涉及文件（本轮改动主体）

- W1 日历：`calendar/context.ts`、`calendar-view.ts`、`use-calendar-monthly.ts`
- W2 详情预上下文本地化：`tasks-view.ts`、`pomodoro-view.ts`
- W4：`shared/hooks/use-subscriber.ts`（单例化）、`hooks/usecases/use-app-handlers.ts`（新）、`index-view.ts`、`views/index/context.ts`
- W3 tasks：`tasks/context.ts`、tasks 三 scope 容器、`tasks/aside/use-aside.ts`、`multi-select-adapter.vue`
- W5：`settings-view.ts`、`app/dialog-adapter.vue`、`views/index/context.ts` 去 user/project/tag/task 用例字段

## 三、回归与门禁

- `pnpm guard:ddd`；`vp lint`；全量 `vitest`（302）；`@nao-todo/webapp build`；`@nao-todo/desktopapp build`。
- 需人工冒烟（无浏览器环境）：任务 CRUD → 列表/日历即时刷新（事件总线单例化后跨视图事件现可达）；三 scope 查询/拖拽/多选；详情抽屉开合与番茄联动；settings 资料/密码/主题。

## 四、仍待办（后续）

- 若推行 letter 级：共享 task-details 子树自组装化（presentation 引 infra，对齐 presentation-react 样板）。
- 把「业务用例不得经 view Context 注入」的检查纳入 `guard:ddd`（可扩展为扫描各 `*_CONTEXT_KEY` 类型字段，排除显式 UI/服务类型白名单）。