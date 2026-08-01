# DDD 架构优化执行方案 - Product Requirement Document

## Overview

- **Summary**: 对 nao-todo 项目的 packages 目录进行 DDD 架构分层优化，分离纯领域层和领域表示层，建立清晰的四层架构（Domain、Application、Presentation、Infrastructure）。
- **Purpose**: 解决当前 packages/domain/ 混合了领域模型和前端技术实现的问题，提高代码的可复用性、可测试性和可维护性。
- **Target Users**: 项目开发团队（Web、Desktop 应用开发者）

## Goals

- 将 packages/domain/ 重构为纯领域层（仅包含 entities、valueobjects、repositories、services）
- 创建 packages/presentation/ 领域表示层（包含 components、stores、hooks、services）
- 创建 packages/application/ 应用层（包含 usecases、viewobjects）
- 清理 packages/shared/ 中的领域特定组件
- 更新 frontend-ddd SKILL，加入 presentation 层的描述和整体架构更新

## Non-Goals (Out of Scope)

- 不修改 apps/web/ 的源代码结构
- 不修改 apps/desktop/ 的实现
- 不修改 packages/infrastructure/ 的代码
- 不涉及后端 API 的修改

## Background & Context

当前项目的 packages/domain/ 目录混合了多种职责：

- 纯领域模型（entities、valueobjects、repositories、services）
- 前端表示层代码（components、stores、hooks）
- 应用层代码（usecases、viewobjects）

这种混合导致：

1. 领域模型被前端技术污染，无法被非 Vue 应用复用
2. 组件和 store 的升级与领域模型绑定，难以独立演进
3. 难以单独测试纯领域逻辑
4. packages/shared/ 中包含领域特定组件，违反共享层原则

## Functional Requirements

- **FR-1**: 创建 packages/domain/ 纯领域层，包含所有领域的 entities、valueobjects、repositories、services
- **FR-2**: 创建 packages/presentation/ 领域表示层，包含所有领域的 components、stores、hooks、services
- **FR-3**: 创建 packages/application/ 应用层，包含所有领域的 usecases、viewobjects
- **FR-4**: 清理 packages/shared/ 中的领域特定组件，迁移到 packages/presentation/
- **FR-5**: 更新 frontend-ddd SKILL，加入 presentation 层描述和整体架构更新

## Non-Functional Requirements

- **NFR-1**: packages/domain/ 不应有任何 Vue/Pinia/前端技术依赖
- **NFR-2**: packages/presentation/ 可被 apps/web/ 和 apps/desktop/ 共享使用
- **NFR-3**: 保持现有代码功能不变，不引入破坏性变更
- **NFR-4**: TypeScript 类型检查通过

## Constraints

- **Technical**: Vue 3 + TypeScript + Pinia + pnpm workspace
- **Business**: 需要保持跨应用（Web、Desktop）的组件共享能力
- **Dependencies**: 各层依赖关系必须严格单向（Presentation → Application → Domain → Infrastructure）

## Assumptions

- 当前 packages/domain/ 的 index.ts 导出了所有内容，需要重新调整
- packages/shared/ 中的领域特定组件（如 task-check-button、tag-card）需要迁移
- usecases 和 viewobjects 属于应用层，需要从 domain 迁移到 application

## Acceptance Criteria

### AC-1: 纯领域层 packages/domain/ 无前端依赖

- **Given**: 检查 packages/domain/ 的 package.json 和所有源代码文件
- **When**: 验证所有导入语句
- **Then**: 不应包含任何 Vue、Pinia、@vue 等前端库的导入
- **Verification**: `programmatic`
- **Notes**: 可通过 grep 或 TypeScript 编译检查

### AC-2: 领域表示层 packages/presentation/ 可被应用共享

- **Given**: 创建 packages/presentation/ 目录结构
- **When**: 配置 pnpm workspace 和 tsconfig 路径别名
- **Then**: apps/web/ 和 apps/desktop/ 可通过 `@nao-todo/presentation` 导入组件和 store
- **Verification**: `programmatic`
- **Notes**: 通过构建测试验证

### AC-3: 应用层 packages/application/ 包含 usecases 和 viewobjects

- **Given**: 创建 packages/application/ 目录结构
- **When**: 从 packages/domain/ 迁移 usecases 和 viewobjects
- **Then**: packages/application/ 包含所有领域的 usecases 和 viewobjects，且依赖 packages/domain/
- **Verification**: `human-judgment`

### AC-4: packages/shared/ 清理领域特定组件

- **Given**: 检查 packages/shared/components/ 目录
- **When**: 识别并迁移领域特定组件
- **Then**: packages/shared/components/ 只包含纯 UI 组件（无领域业务逻辑）
- **Verification**: `human-judgment`

### AC-5: frontend-ddd SKILL 更新完成

- **Given**: 更新 SKILL.md 文档
- **When**: 添加 presentation 层描述和整体架构更新
- **Then**: SKILL 文档包含完整的五层架构说明和 presentation 层的使用指南
- **Verification**: `human-judgment`

## Open Questions

- [ ] 是否需要保留 packages/domain/ 的旧名称作为过渡？
- [ ] packages/presentation/ 的 tsconfig 配置是否需要特殊处理？
- [ ] 迁移过程中如何处理跨包的导入路径更新？