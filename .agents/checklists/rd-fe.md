---
description: 前端研发交付核对清单（按需，交付前读取）
---

# 前端研发红线与交付检查清单

> 角色卡只常驻最硬红线；本文件在**交付前**读取并逐项核对。
> 汇报只报未过项：`未过：R-XX-03；其余 pass`（见 output-format）。

## 硬性红线（完整 17 项）

**通用**

- [ ] Domain 零框架；用例仅依赖端口
- [ ] 视图无 `if (status)` 业务分支
- [ ] Store 存聚合根实例（非裸 DTO）
- [ ] 组件逻辑 >200 行抽 `useXxx`

**DI**

- [ ] 禁 Context/Provide 传业务依赖
- [ ] 禁组件/Store 内 `new 仓储`
- [ ] 禁 Store 调仓储编排
- [ ] SSR 禁模块顶层 `new`（组装在 Hook 生命周期）

**Vue**

- [ ] 业务/UI Store 分离
- [ ] Composable 为 DI 唯一入口
- [ ] 禁 `watch` 路由直改 Store
- [ ] 禁 `reactive` 直改属性
- [ ] 使用 `storeToRefs` 选择器

**React**

- [ ] UI 状态（loading/filter）用 `useState`
- [ ] Hook 为 DI 唯一入口
- [ ] 禁 JSX 直接用用例
- [ ] 使用 `useShallow`/选择器

## 命名速查

`I{Entity}Repository` / `{Entity}HttpRepo` / `{Entity}UseCase` / `{Entity}Dto` + `Mapper` / `useXxx`。

## UI/UX 落地（交付前核对，见 frontend-ddd-details「UI/UX 落地」）

- [ ] 改/新增组件延续了项目既有风格（结构/样式模式/状态处理与现有组件一致；仅用户指定新风格才脱离）
- [ ] 新建页面/组件已按 frontend-design 产出 token plan 并对照自查
- [ ] 组件无硬编码色值/魔法数值（全部走 Design Tokens：`var(--<prefix>-*)`）
- [ ] 页面四态（加载/空/错误/成功）与反馈模式严格按 UX Playbook，未临场发明
- [ ] 新 UI 用既有原语/基础组件组装；暗色/hover/disabled 走令牌语义
- [ ] `bash "$NAO_SKILLS/.agents/scripts/ui-tokens-check.sh" <repo>` 通过（若配了 CI 则自动拦截）

## 交付检查清单（完整 14 项）

- [ ] 规模评估（L1/L2/L3）未过度设计
- [ ] Domain 零框架、充血；用例仅依赖端口；DI 红线全过
- [ ] Mapper 收敛 Infra，DTO 未泄漏
- [ ] Store 存聚合根，业务/UI Store 分离
- [ ] 组件逻辑 ≤200 行或已抽离
- [ ] 路由/筛选/表单/错误/WS/类型生成/选择器规范全部遵守（见技能包）
- [ ] 业务规则有纯单测；用例有端口调用验证
- [ ] 无 Context 传业务依赖；无组件/Store 内 `new` 仓储
- [ ] 已遵守 AGENTS.md 项目约束（含 UI tokens/ux-playbook 位置）
- [ ] 定位/变更代码已用 CodeGraph（回退 grep 有注明）
- [ ] 需求分支 `feat/<issue-id>-<slug>` 已 push，Draft PR 已开（填 PR 模板）
- [ ] 提交为 `wip()` 检查点 + 路径级暂存（禁 `-A`）；无 WIP 提交落到 main
- [ ] 通过上面全部红线
- [ ] PM 验收通过后才合并（`gh pr merge --squash --delete-branch` / 降级本地 squash）；未过验收未合并
