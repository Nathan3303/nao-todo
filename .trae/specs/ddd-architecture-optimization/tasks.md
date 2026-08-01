# DDD 架构优化执行方案 - The Implementation Plan

## [x] Task 1: 创建 packages/domain/ 纯领域层 ✅

- **Priority**: high
- **Depends On**: None
- **Description**:
    - 从现有 packages/domain/ 中提取纯领域模型（entities、valueobjects、repositories、services）
    - 创建新的 packages/domain/ 目录结构，每个领域只包含纯领域代码
    - 更新 packages/domain/index.ts，只导出领域核心内容
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
    - `programmatic` TR-1.1: packages/domain/ 中不应包含 Vue、Pinia、@vue 等前端库的导入（通过 grep 验证）
    - `programmatic` TR-1.2: packages/domain/ 的 TypeScript 编译通过
    - `human-judgment` TR-1.3: packages/domain/ 只包含 entities、valueobjects、repositories、services 目录
- **Notes**: 需要处理跨领域的类型引用，确保依赖关系正确。使用复制方式而不是删除。

## [x] Task 2: 创建 packages/application/ 应用层 ✅

- **Priority**: high
- **Depends On**: Task 1
- **Description**:
    - 创建 packages/application/ 目录结构
    - 从现有 packages/domain/ 迁移 usecases 和 viewobjects 到 packages/application/
    - 更新 usecases 的导入路径，依赖 packages/domain/
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
    - `programmatic` TR-2.1: packages/application/ 的 TypeScript 编译通过
    - `human-judgment` TR-2.2: packages/application/ 包含所有领域的 usecases 和 viewobjects
    - `human-judgment` TR-2.3: usecases 正确依赖 packages/domain/ 的实体和值对象
- **Notes**: usecases 可能需要更新导入路径，从 `../entities` 改为 `@nao-todo/domain`

## [x] Task 3: 创建 packages/presentation/ 领域表示层 ✅

- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
    - 创建 packages/presentation/ 目录结构
    - 从现有 packages/domain/ 迁移 components、stores、hooks、services 到 packages/presentation/
    - 更新导入路径，依赖 packages/domain/ 和 packages/application/
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
    - `programmatic` TR-3.1: packages/presentation/ 的 TypeScript 编译通过
    - `human-judgment` TR-3.2: packages/presentation/ 包含所有领域的 components、stores、hooks、services
    - `human-judgment` TR-3.3: components 和 stores 正确依赖 packages/domain/ 的类型
- **Notes**: 这是最大的迁移任务，需要仔细处理导入路径

## [x] Task 4: 配置 pnpm workspace 和 tsconfig ✅

- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3
- **Description**:
    - 在根 package.json 中添加 packages/application 和 packages/presentation 到 workspaces
    - 创建 packages/application/package.json 和 packages/presentation/package.json
    - 配置 tsconfig 的路径别名，支持 `@nao-todo/domain`、`@nao-todo/application`、`@nao-todo/presentation`
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
    - `programmatic` TR-4.1: pnpm install 成功
    - `programmatic` TR-4.2: TypeScript 编译通过，路径别名解析正确
    - `programmatic` TR-4.3: apps/web/ 能通过 `@nao-todo/presentation` 导入组件
- **Notes**: 需要检查现有 tsconfig 的配置方式，保持一致性

## [x] Task 5: 清理 packages/shared/ 的领域特定组件 ✅

- **Priority**: medium
- **Depends On**: Task 3
- **Description**:
    - 识别 packages/shared/components/ 中的领域特定组件（task-check-button、tag-card、project-card 等）
    - 将这些组件迁移到 packages/presentation/ 对应的领域目录
    - 更新 packages/shared/index.ts，移除已迁移组件的导出
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
    - `human-judgment` TR-5.1: packages/shared/components/ 只包含纯 UI 组件（无领域业务逻辑）
    - `human-judgment` TR-5.2: 所有领域特定组件已迁移到 packages/presentation/
    - `programmatic` TR-5.3: TypeScript 编译通过，无缺失的导入
- **Notes**: 需要检查 apps/web/ 和其他地方对这些组件的引用

## [x] Task 6: 更新 frontend-ddd SKILL ✅

- **Priority**: medium
- **Depends On**: Task 1, Task 2, Task 3
- **Description**:
    - 更新 SKILL.md，加入 presentation 层的描述
    - 更新整体架构图，展示五层架构（Infrastructure、Domain、Application、Presentation、Views）
    - 添加 monorepo 结构的说明，包括 packages/domain、packages/application、packages/presentation 的职责
    - 更新 Migration Path，加入从混合结构到分层结构的迁移步骤
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
    - `human-judgment` TR-6.1: SKILL 文档包含完整的五层架构说明
    - `human-judgment` TR-6.2: SKILL 文档包含 presentation 层的使用指南
    - `human-judgment` TR-6.3: SKILL 文档包含 monorepo 结构的说明
- **Notes**: 需要确保 SKILL 文档与实际项目结构保持一致