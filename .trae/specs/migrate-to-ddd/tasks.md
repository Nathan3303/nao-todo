# NaoTodo Web - DDD 架构迁移任务分解

> **重要说明**: packages 目录已包含完整的领域模型层（domain、usecases、infrastructure），本次迁移仅涉及 apps/web 前端应用层的重新组织。

## [ ] Task 1: 更新 TypeScript 路径别名配置

- **Priority**: high
- **Depends On**: None
- **Description**:
    - 更新 `tsconfig.app.json` 添加新的路径别名（`@/domains/`、`@/shared/`、`@/app/`）
    - 更新 `vite.config.ts` 同步配置路径别名
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
    - `programmatic` TR-1.1: `pnpm build` 成功，无路径解析错误
    - `human-judgment` TR-1.2: tsconfig.app.json 包含新的路径别名配置
- **Notes**: 需要确保所有现有别名保持不变

## [ ] Task 2: 创建基础目录结构

- **Priority**: high
- **Depends On**: Task 1
- **Description**:
    - 创建 `src/domains/` 目录，包含 task、project、tag、pomodoro、user、settings、calendar 子目录
    - 每个领域创建 `types/`、`store/`、`services/`、`components/`、`composables/` 子目录
    - 创建 `src/shared/` 目录，包含 `composables/`、`utils/`、`types/`、`components/`、`themes/`
    - 创建 `src/app/` 目录，包含 `router/`、`store/`、`layouts/`
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
    - `human-judgment` TR-2.1: 目录结构符合 Level 3 DDD 标准
    - `human-judgment` TR-2.2: 每个领域包含完整的子目录结构
- **Notes**: 先创建空目录，后续逐步迁移代码

## [ ] Task 3: 迁移 User 领域（最独立领域）

- **Priority**: high
- **Depends On**: Task 2
- **Description**:
    - 将 `stores/user-store.ts` 迁移到 `domains/user/store/`
    - 将 `components/settings/profile/` 和 `layouts/auth/` 迁移到 `domains/user/components/`
    - 将用户相关 handlers 迁移到 `domains/user/services/`
    - 更新所有导入路径
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
    - `programmatic` TR-3.1: `pnpm build` 成功
    - `human-judgment` TR-3.2: User 领域代码组织完整
- **Notes**: User 领域相对独立，作为第一个迁移的试点

## [ ] Task 4: 迁移 Tag 领域

- **Priority**: high
- **Depends On**: Task 3
- **Description**:
    - 将 `stores/tags-store.ts` 和 `stores/base/tag.ts` 迁移到 `domains/tag/store/`
    - 将 `layouts/tasks/tag/` 标签相关布局迁移到 `domains/tag/components/`
    - 将 tag handler 迁移到 `domains/tag/services/`
    - 更新所有导入路径
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
    - `programmatic` TR-4.1: `pnpm build` 成功
    - `human-judgment` TR-4.2: Tag 领域代码组织完整
- **Notes**: Tag 领域相对独立，依赖较少

## [ ] Task 5: 迁移 Project 领域

- **Priority**: high
- **Depends On**: Task 4
- **Description**:
    - 将 `stores/projects-store.ts` 和 `stores/base/project.ts` 迁移到 `domains/project/store/`
    - 将 `layouts/tasks/project/` 和 `layouts/tasks/built-in-project/` 迁移到 `domains/project/components/`
    - 将 project handler 迁移到 `domains/project/services/`
    - 更新所有导入路径
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
    - `programmatic` TR-5.1: `pnpm build` 成功
    - `human-judgment` TR-5.2: Project 领域代码组织完整
- **Notes**: Project 领域与 Task 领域有依赖，需要特别注意

## [ ] Task 6: 迁移 Task 领域（核心领域）

- **Priority**: high
- **Depends On**: Task 5
- **Description**:
    - 将 `stores/tasks-store.ts`、`stores/base/task.ts`、`stores/tasks-view/` 迁移到 `domains/task/store/`
    - 将 `components/tasks/` 和 `layouts/tasks/` 迁移到 `domains/task/components/`
    - 将 `layouts/app/task-details/` 和 `layouts/app/view-adapters/` 迁移到 `domains/task/components/`
    - 将 task handler 迁移到 `domains/task/services/`
    - 将 task 相关 hooks（use-task-loader）迁移到 `domains/task/composables/`
    - 更新所有导入路径
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
    - `programmatic` TR-6.1: `pnpm build` 成功
    - `human-judgment` TR-6.2: Task 领域代码组织完整，包含所有子模块
- **Notes**: Task 是核心领域，代码量最大，需要仔细处理

## [ ] Task 7: 迁移 Pomodoro 领域

- **Priority**: high
- **Depends On**: Task 6
- **Description**:
    - 将 `stores/pomodoro-timer-store.ts`、`stores/pomodoro-focus-store.ts`、`stores/pomodoro-view/` 迁移到 `domains/pomodoro/store/`
    - 将 `components/pomodoro/` 和 `layouts/pomodoro/` 迁移到 `domains/pomodoro/components/`
    - 将 pomodoro utils 和 hooks 迁移到 `domains/pomodoro/utils/` 和 `domains/pomodoro/composables/`
    - 更新所有导入路径
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3
- **Test Requirements**:
    - `programmatic` TR-7.1: `pnpm build` 成功
    - `human-judgment` TR-7.2: Pomodoro 领域代码组织完整
    - `human-judgment` TR-7.3: 跨域依赖通过事件总线解耦
- **Notes**: Pomodoro 依赖 Task，需要实现事件总线通信

## [ ] Task 8: 迁移 Settings 和 Calendar 领域

- **Priority**: medium
- **Depends On**: Task 7
- **Description**:
    - 将 `components/settings/` 和 `layouts/settings/` 迁移到 `domains/settings/components/`
    - 将 settings 相关 stores 迁移到 `domains/settings/store/`
    - 将 `layouts/calendar/` 迁移到 `domains/calendar/components/`
    - 更新所有导入路径
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
    - `programmatic` TR-8.1: `pnpm build` 成功
    - `human-judgment` TR-8.2: Settings 和 Calendar 领域代码组织完整
- **Notes**: Settings 和 Calendar 相对独立

## [ ] Task 9: 创建共享层和应用层

- **Priority**: medium
- **Depends On**: Task 8
- **Description**:
    - 将通用 hooks（use-shortcut, use-dialog-manager 等）迁移到 `shared/composables/`
    - 将通用 utils 迁移到 `shared/utils/`
    - 将 `infrastructure/themes/` 迁移到 `shared/themes/`
    - 将全局 store（theme、locale）迁移到 `app/store/`
    - 将 `layouts/app/aside/`、`layouts/app/dialogs/` 迁移到 `app/layouts/`
    - 将路由配置迁移到 `app/router/`
    - 创建事件总线 `shared/utils/eventBus.ts`
- **Acceptance Criteria Addressed**: AC-1, AC-3, AC-5
- **Test Requirements**:
    - `programmatic` TR-9.1: `pnpm build` 成功
    - `human-judgment` TR-9.2: shared 和 app 目录结构完整
    - `human-judgment` TR-9.3: 事件总线实现正确
- **Notes**: 需要判断哪些代码属于 shared，哪些属于 app

## [ ] Task 10: 更新路由和入口文件

- **Priority**: high
- **Depends On**: Task 9
- **Description**:
    - 更新 `router.ts` 使用新的路径别名
    - 更新 `main.ts` 和 `app.ts` 的导入路径
    - 更新 `App.vue` 的导入路径
    - 更新所有 views 的导入路径
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
    - `programmatic` TR-10.1: `pnpm build` 成功
    - `programmatic` TR-10.2: 开发服务器运行正常，所有路由可访问
- **Notes**: 确保路由配置正确指向新的视图位置

## [ ] Task 11: 清理旧目录和验证

- **Priority**: medium
- **Depends On**: Task 10
- **Description**:
    - 删除旧的 `stores/`、`components/`、`layouts/`、`infrastructure/` 目录（确认迁移完成后）
    - 运行 `pnpm build` 验证构建
    - 运行 ESLint 检查代码风格
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4
- **Test Requirements**:
    - `programmatic` TR-11.1: `pnpm build` 成功
    - `programmatic` TR-11.2: ESLint 检查通过，无错误
    - `human-judgment` TR-11.3: 旧目录已清理，代码结构整洁
- **Notes**: 建议最后清理旧目录，确保所有功能正常