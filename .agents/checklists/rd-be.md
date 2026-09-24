---
description: 后端研发交付核对清单（按需，交付前读取）
---

# 后端研发红线与交付检查清单

> 角色卡只常驻最硬红线；本文件在**交付前**读取并逐项核对。
> 汇报只报未过项：`未过：R-XX-03；其余 pass`（见 output-format）。

## 硬性红线（完整 8 项）

- [ ] `internal/domain/` 零 ORM(GORM)/Web(Gin)/RPC 导入
- [ ] Application 无 `if order.Status == Paid` 业务规则（须上移 Domain）
- [ ] HTTP 控制器不直调 Repository（必经 Application）
- [ ] 跨微服务不共享 `internal/domain`（用 `pkg/contracts`）
- [ ] 聚合根更新带乐观锁 Version
- [ ] 业务逻辑禁 `panic`（仅哨兵错误）
- [ ] VO 用工厂函数（`NewMoney`），禁裸结构体
- [ ] 所有 I/O 方法首参 `context.Context`

## 命名速查

`XxxRepository`（接口）/ `GormXxxRepository`（实现）/ `XxxService`（应用）/ `XxxHandler`（接口）/ `ErrXxx`（哨兵）/ `NewXxx`（工厂）。

## 交付检查清单（完整 14 项）

- [ ] 业务本质已评估（CRUD 走脚本 / 复杂规则选 L1/L2/L3），未过度设计
- [ ] `internal/domain/` 零外部依赖，实体方法承载业务规则
- [ ] Application 只依赖 Domain 接口，无业务规则、无 Infra 引用
- [ ] Interfaces 仅绑定/校验/转换，未直调 Repository
- [ ] 组装收敛 `main.go`（显式 DI，Wire 可选），禁 Service Locator
- [ ] 哨兵错误替代 panic；VO 用工厂；I/O 首参 `context.Context`
- [ ] 聚合根更新带乐观锁；跨服务契约走 `pkg/contracts`
- [ ] 事务边界在应用层；读模型绕过聚合根；事件事务后发布
- [ ] 已遵守 AGENTS.md 项目约束（命令纪律/领域红线）
- [ ] 定位/变更代码已用 CodeGraph（回退 grep 有注明）
- [ ] 需求分支 `feat/<issue-id>-<slug>` 已 push，Draft PR 已开（填 PR 模板）
- [ ] 提交为 `wip()` 检查点 + 路径级暂存（禁 `-A`）；无 WIP 提交落到 main
- [ ] 通过上面全部红线
- [ ] PM 验收通过后才合并（`gh pr merge --squash --delete-branch` / 降级本地 squash）；未过验收未合并
