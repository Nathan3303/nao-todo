# NaoTodo Web - DDD 架构迁移 PRD

## Overview

- **Summary**: 将 apps/web 端从当前的"按技术分层"架构迁移到领域驱动设计（DDD）架构，按照 frontend-ddd 技能的 Level 3 标准组织代码。**重要发现：packages 目录已包含完整的领域模型层（domain、usecases、infrastructure），本次迁移仅涉及 apps/web 前端应用层的重新组织。**
- **Purpose**: 解决当前业务逻辑分散、跨域依赖不明确、代码难以维护等问题，使前端代码结构与业务领域对齐。
- **Target Users**: 开发团队成员，包括前端开发者和技术负责人。

## Goals

- [ ] 将 apps/web 前端代码按业务领域重新组织，创建 `domains/` 目录结构
- [ ] 建立清晰的领域边界和依赖规则
- [ ] 实现跨域通信机制（事件总线）
- [ ] 保持现有功能完整，迁移后可正常构建和运行
- [ ] 提供渐进式迁移路径，支持分阶段完成

## Non-Goals (Out of Scope)

- [ ] 不修改 `packages/domain/`、`packages/usecases/`、`packages/infrastructure/` 中的领域模型和用例
- [ ] 不修改 `packages/components/` 共享组件库
- [ ] 不添加新功能或 UI 改动
- [ ] 不迁移 desktop/mobile 端

## Background & Context

### 现有架构分析

**packages 目录（已按 DDD 组织）：**

- `packages/domain/` - 领域模型层（实体、值对象、仓库接口、服务）
    - auth, built-in-project, pomodoro, project, tag, task, user
- `packages/usecases/` - 用例层（业务逻辑、转换器、视图对象）
    - auth, built-in-project, pomodoro, project, tag, task, user
- `packages/infrastructure/` - 基础设施层（后端实现、命令系统、hooks、工具函数）
- `packages/components/` - 共享组件库（纯 UI 组件，无业务依赖）
- `packages/types/` - 共享类型

**apps/web 目录（需要迁移）：**

- `stores/` - Pinia stores（消费 usecases）
- `components/` - 领域相关组件
- `layouts/` - 布局组件（混合领域代码）
- `infrastructure/` - 前端基础设施（hooks, utils, handlers）
- `views/` - 页面视图

### 领域归属映射

| 当前位置                 | 目标领域                     | 说明                   |
| ------------------------ | ---------------------------- | ---------------------- |
| stores/user-store.ts     | domains/user/store/          | 用户状态管理           |
| stores/projects-store.ts | domains/project/store/       | 项目状态管理           |
| stores/tags-store.ts     | domains/tag/store/           | 标签状态管理           |
| stores/tasks-store.ts    | domains/task/store/          | 任务状态管理           |
| stores/pomodoro-\*       | domains/pomodoro/store/      | 番茄钟状态管理         |
| stores/theme-store.ts    | app/store/                   | 全局主题状态           |
| stores/locale-store.ts   | app/store/                   | 全局语言状态           |
| components/pomodoro/     | domains/pomodoro/components/ | 番茄钟组件             |
| components/tasks/        | domains/task/components/     | 任务组件               |
| components/settings/     | domains/settings/components/ | 设置组件               |
| layouts/tasks/           | domains/task/components/     | 任务布局组件           |
| layouts/pomodoro/        | domains/pomodoro/components/ | 番茄钟布局组件         |
| layouts/calendar/        | domains/calendar/components/ | 日历布局组件           |
| layouts/auth/            | domains/user/components/     | 认证布局组件           |
| infrastructure/handlers/ | domains/\*/services/         | 领域服务（按领域拆分） |
| infrastructure/hooks/    | shared/composables/          | 通用 hooks             |
| infrastructure/utils/    | shared/utils/                | 通用工具函数           |

## Functional Requirements

- **FR-1**: 创建 `src/domains/` 目录，按领域组织前端代码
- **FR-2**: 将现有的 stores、components、layouts 迁移到对应领域
- **FR-3**: 创建 `src/shared/` 目录，存放跨领域共享资源
- **FR-4**: 创建 `src/app/` 目录，存放应用级配置
- **FR-5**: 实现事件总线机制，支持跨域通信
- **FR-6**: 更新路由配置，适配新的目录结构
- **FR-7**: 更新 TypeScript 路径别名配置

## Non-Functional Requirements

- **NFR-1**: 迁移过程中保持功能完整性，不引入新 bug
- **NFR-2**: 构建和测试通过（`pnpm build` 成功）
- **NFR-3**: 代码风格保持一致（ESLint 通过）
- **NFR-4**: 迁移后的目录结构符合 frontend-ddd Level 3 标准

## Constraints

- **Technical**: Vue 3 + TypeScript + Pinia + NueUI
- **Dependencies**: 依赖 `@nao-todo/usecases`、`@nao-todo/infrastructure`、`@nao-todo/types`、`@nao-todo/components` 等共享包
- **Business**: 渐进式迁移，不影响开发进度

## Assumptions

- [ ] `packages/domain/`、`packages/usecases/`、`packages/infrastructure/` 保持不变
- [ ] `packages/components/` 作为共享组件库，保持不变
- [ ] 迁移后导入路径通过 TypeScript 别名解决

## Acceptance Criteria

### AC-1: 目录结构符合 Level 3 DDD 标准

- **Given**: apps/web/src 目录
- **When**: 迁移完成后
- **Then**: 存在 `domains/`、`shared/`、`app/` 目录，且每个领域包含 `types/`、`store/`、`services/`、`components/` 子目录
- **Verification**: `human-judgment`

### AC-2: 构建成功

- **Given**: 项目依赖已安装
- **When**: 运行 `pnpm build`
- **Then**: 构建成功，无编译错误
- **Verification**: `programmatic`

### AC-3: 跨域依赖通过事件总线解耦

- **Given**: 存在跨域依赖（如 pomodoro 依赖 task）
- **When**: 查看代码实现
- **Then**: 领域间不直接 import store，通过事件总线通信
- **Verification**: `human-judgment`

### AC-4: 路由和页面正常工作

- **Given**: 开发服务器运行
- **When**: 访问各个页面路由
- **Then**: 页面正常渲染，功能可用
- **Verification**: `programmatic`

### AC-5: TypeScript 路径别名配置正确

- **Given**: tsconfig.app.json 配置文件
- **When**: 查看配置
- **Then**: 包含 `@/domains/`、`@/shared/`、`@/app/` 等别名
- **Verification**: `human-judgment`

## Open Questions

- [ ] `layouts/app/` 中的通用布局组件（aside, dialogs）如何归属？（可能放入 shared 或 app）
- [ ] `infrastructure/hooks/` 中的领域特定 hooks（如 use-task-loader）如何归属？（可能放入对应领域 composables）