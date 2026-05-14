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
- **Handler** (`apps/web/src/infrastructure/handlers/`) 协调 UseCase 与 Store 的交互

### Go 风格错误处理

项目使用 ``[result, error]`` 元组模式代替异常。`GoAsync<T>` 返回 `Promise<[T | null, error | null]>`。成功时错误为 `null`，失败时结果为 `null`。贯穿 UseCase → Domain → Repository 全链路。

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

### Git 提交规范

使用 `feat|fix|chore|change(范围): 描述` 格式，后跟 `变更点：` 列表。完整规范见 `.trae/rules/git-commit-message.md`。

## 代码风格

- 4 空格缩进，单引号，无分号，无尾逗号（Prettier 配置）
- Vue 3 `<script setup>` 语法，Composition API
- Pinia `defineStore` 使用组合式语法（`() => { ... }`）
- 文件和目录命名：kebab-case（组件目录名），PascalCase（组件文件名）
