# 前端 DDD 代码审查

按 nao-frontend-ddd 技能的红线标准审查前端代码变更，输出逐条通过/违反报告与修复建议。适用于 Vue 3（Pinia/Composables）与 React（Zustand/Hooks）项目。

## 流程

1. **确定审查范围**：默认只检查 Git 变更代码（`git diff --staged` 与 `git diff` 合并的工作区未提交变更）；**仅当用户在运行命令时指定了范围**（如 `/nao-frontend-review src/domain` 或指定文件/目录）才以指定范围为准；若 `git diff` 为空且用户未指定范围，提示用户提供范围。
2. **识别项目形态**：判断 Vue 3（Pinia/Composables）或 React（Zustand/Hooks）；确认领域层目录（`packages/domain/` 或 `src/core/`）。
3. **逐条执行红线检查**：仅对变更涉及的代码检查，记录证据（文件路径 + 行号 + 代码片段）；未变更文件不审查。
4. **输出审查报告**：逐条标记 ✅ 通过 / ❌ 违反 / ⚠️ 无法判定，违反项附证据与修复建议，最后汇总统计与阻塞项。

## 红线检查清单

### 通用红线（所有框架）

- [ ] **Domain 层零框架依赖**：`packages/domain/` 或 `src/core/` 中是否有 `import { ref } from 'vue'` 或 `import { useState } from 'react'`？（应为零）
- [ ] **实体为充血模型**：实体类是否包含业务方法（`complete()`、`isOverdue()`），而非仅属性的贫血接口？
- [ ] **UseCase 只依赖抽象**：应用层 UseCase 是否只依赖仓储接口和端口，未直接引用 Pinia/Zustand 的 API？
- [ ] **Views 仅组装**：页面组件是否不含 `if (task.status === 'done')` 业务分支？
- [ ] **DTO 不泄漏**：DTO 类型是否未出现在 Domain 层（反序列化是否收敛在 Infrastructure 的 Mapper）？
- [ ] **Store 存聚合根**：Store 是否持有聚合根实例（而非裸 DTO），更新是否通过实体公开方法？
- [ ] **200 行阈值**：组件逻辑代码（非模板）是否超过 200 行未抽离为组件目录内 `useXxx.ts`？判定：逻辑行含事件处理、状态声明、副作用、计算属性、条件/循环/工具函数，不含模板/样式/注释/空行。

### DI 禁止（依赖倒置）

- [ ] **禁 Context/Provide-Inject 传业务依赖**：UseCase、Repository 等业务依赖是否通过 Context/Provide/Inject 传递？（仅可用于主题、语言等基础设施级信息）
- [ ] **禁组件/Store 内 `new` 仓储**：组件或 Store 内部是否直接 `new TaskHttpRepository()`？（组装必须在 Composable/Hook 完成）
- [ ] **禁 Store 直接编排**：Store 是否直接调用 Repository 完成业务编排？（编排职责在 UseCase）

### 序列化红线（DTO ↔ 聚合根）

- [ ] **DTO 只在 Infrastructure**：DTO 类型是否只出现在 Infrastructure 层，未泄漏到 Domain？
- [ ] **Store 持聚合根**：Store 持有的是聚合根实例，而非裸 DTO？
- [ ] **反序列化收敛 Mapper**：字符串 → Date、嵌套对象 → 值对象的反序列化是否收敛在 Mapper 中？

### Vue 特定

- [ ] **业务/UI Store 分离**：Pinia Store 是否严格区分为业务 Store（存聚合根）和 UI Store（存 loading）？
- [ ] **Composable 为 DI 唯一入口**：`new UseCase(...)` 是否在 Composable 中完成？
- [ ] **禁 watch 路由直改 Store**：是否避免在组件中用 `watch` 监听路由变化并直接修改 Store（应通过 Composable 封装）？
- [ ] **禁 reactive 后直改属性**：是否避免 `reactive` 包裹聚合根后在组件内直接修改属性（必须调用实体方法）？

### React 特定

- [ ] **领域/UI 状态隔离**：Zustand/Jotai Store 是否仅存储领域状态，UI 状态用 `useState` 或独立 Slice 隔离？
- [ ] **Custom Hook 为 DI 唯一入口**：`new UseCase(...)` 是否在 Custom Hook 中完成？
- [ ] **禁 JSX 直调 UseCase**：是否避免在 JSX 中直接调用 UseCase 方法（必须通过 Hook 暴露的方法触发）？

## 输出规范

```text
## 审查报告（nao-frontend-review）

范围：git 变更（或：用户指定 <路径>）
形态：Vue 3 / React

### 通用红线（7 项）
- ✅ Domain 层零框架依赖
- ❌ 实体为充血模型 — 证据：src/domain/task/Task.ts:12 仅属性无业务方法 → 建议：状态流转逻辑移入实体方法
- ⚠️ 待确认项 — 原因：<无法判定的说明>

### DI 禁止（3 项）/ 序列化红线（3 项）/ Vue 特定（4 项）/ React 特定（3 项）
<同格式逐条列出>

### 汇总
- 通过 X / 违反 Y / 共 20 项
- 阻塞项：<违反项列表>（红线违反必须修复后合入；非红线风格问题仅提示不阻塞）
```

注意事项

- 红线违反视为阻塞项，必须修复后才能合入；非红线问题（风格、命名建议）仅提示
- 证据必须包含文件路径与行号，无证据不下结论
- 无法判定的项标记 ⚠️ 待确认并说明原因
- 默认只审查 Git 变更代码，未变更文件不审查；用户指定范围时以指定为准