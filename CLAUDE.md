# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

NaoTodo 是一个仿滴答清单的任务管理平台 (Vue 3 + Vite + TypeScript + Pinia + NueUI)。这是一个 **pnpm workspace monorepo**，包含 web 应用、共享包和移动端/桌面端占位。

## 常用命令

```bash
# Web 应用开发
pnpm webapp dev                    # 启动 web 开发服务器 (http://localhost:5173)

# 构建
pnpm webapp build                  # 生产构建到 apps/web/dist/

# 代码检查与格式化
pnpm exec eslint <file>            # ESLint 检查（含 TypeScript + Vue 插件）
pnpm exec prettier --check <file>  # Prettier 格式检查
pnpm exec vue-tsc --build          # Vue + TypeScript 类型检查
```

注意：`pnpm webapp` 是 `pnpm --filter @nao-todo/webapp` 的快捷方式。mobile 和 desktop 应用目前仅有占位 `package.json`，尚未实现。

## 架构

### Monorepo 结构

```text
apps/
  web/          # 主 web 应用 (Vue 3 + Vite)
  mobile/       # 移动端占位
  desktop/      # 桌面端占位
packages/
  types/        # 共享 TypeScript 类型、ViewObject 定义、Go 风格错误类型
  domain/       # 领域层：实体、值对象、仓储接口、领域服务
  infrastructure/  # 基础设施层：后端 API 仓储、本地 Dexie (IndexedDB)、Axios requester、工具函数
  application/  # 应用层：UseCase（业务编排）、ViewObject <-> 领域对象 转换器
  components/   # 共享 Vue 组件库（~35 个组件）
```

### 分层数据流

```text
Vue 视图 → Pinia Store → UseCase (packages/application)
             → Domain Service (packages/domain)
                 → Repository 接口
                     → 实现: Backend API (Axios) 或 Local DB (Dexie/IndexedDB)
```

- **Store** 通过 base composable（如 `useProjectsStoreBase`）封装公共状态逻辑
- **UseCase** 是业务编排入口，通过工厂静态方法（如 `ProjectUseCase.create(store)`）创建，组合 Domain Service + Repository + Converter
- **Handler** (`apps/web/src/infrastructure/handlers/`) 协调 UseCase 与 UI 的交互，通常用于集成某些用户输入提示框、请求结果的消息提示以及实现部分方法的复用。

### Go 风格错误处理

项目使用 ``[result, error]`` 元组模式代替异常。贯穿 UseCase → Domain → Repository 全链路。

同步函数返回类型注意项：

- `Go<T, U>` 表示函数返回值为 `T`，错误类型为 `U`。成功时返回 `[T, null]`，失败时返回 `[null, U]`
- 由于必须处理错误的特性，因此即使是 `Go<void>` 也必须返回值，即使是 `null`（表示没有错误）
- 最后处理错误时，当指定了返回值类型 `T` 时，必须判断错误类型 `U` 是否为 `null`，否则 `T` 会处于联合类型状态，导致类型断言失败。

因为错误类型必须处理，因此就算返回了值，但错误不为 `null`，也依旧应该被判断为失败。如：

```ts
const [v, e] = fn() /* fn: () => Go<string> */
if (e) { /* error handle */ }
console.log(v) /* v: string | null */
if (e !== null) { /* error handle */ }
console.log(v) /* v: string */
```

`GoAsync<T>` 返回 `Promise<[T | null, error | null]>`。成功时错误为 `null`，失败时结果为 `null`。

### API 请求

- 后端基础 URL：`VITE_API_BASE_URL` 环境变量（默认 `http://localhost:3302/api`）
- 认证方式：Bearer Token，初始化在 `apps/web/src/main.ts` 中调用 `initRequester()`
- 所有请求通过 `getRequesterImpl()` 获取单例 requester

### 本地存储

Dexie (IndexedDB wrapper) 用于本地数据缓存。数据库名称 `nao-todo`，目前仅有 `tasks` 表。

### 关键共享模块

| 模块 | 路径 | 用途 |
| ------ | ------ | ------ |
| 类型定义 | `@nao-todo/types` | ViewObject、Requester、Go 错误类型 |
| 组件库 | `@nao-todo/components` | 通用 Vue 组件（checkbox、dialog、event-row 等） |
| 领域服务 | `@nao-todo/domain/*/services` | 业务逻辑实现 |
| 仓储 | `@nao-todo/infrastructure/backend/*/repoImpl` | 后端 API 调用实现 |
| UseCase | `@nao-todo/application/web/usecases` | 业务用例编排 |

### 视图路由

- Hash 模式路由 (`createWebHashHistory`)
- 顶级路由：`/auth`（登录） 和 `/`（主应用，需认证）
- 主应用视图：首页（列表视图）、日历视图、设置、任务详情

### Vue 视图层结构

```text
Views(src/views) —— 包含 entry.vue、routes.ts 以及与目录名同名的 xxx-view.ts，xxx-view.ts 通常功能以 hook 的形式集成相应逻辑，让 entry.vue 保持干净。
  -> Layouts(src/layouts) —— 包含各种布局组件，通常是一个大的业务板块组件，由各种 component 组成，包含各种处理逻辑，如 `infrastructure/{hooks|handlers}` 的使用。
    -> Components(src/components) —— 纯粹或者含有轻微业务逻辑的 UI 组件，目的是复用性，通常被业务板块组件使用。
```

各层级的组件通常采用 Vue 3 的 inject/provide 方法提供视图上下文，除非是父子组件并且成员比较少的情况下可以考虑使用 props 传递。

## 代码风格

- 4 空格缩进，单引号，无分号，无尾逗号（Prettier 配置）
- Vue 3 `<script setup>` 语法，Composition API
- Pinia `defineStore` 使用组合式语法（`() => { ... }`）
- 文件和目录命名：kebab-case（组件目录名），PascalCase（组件文件名）
