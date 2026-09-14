---
description: 按需技能——后端 DDD 代码骨架、事务、事件、命名、误区
---

# 后端 DDD 详细规范

## 等级差异

| 维度     | L1           | L2                          | L3                      |
| :------- | :----------- | :-------------------------- | :---------------------- |
| 事务     | `db.Begin()` | `context` 传事务句柄 + 闭包 | L2 + Saga/Outbox        |
| 领域事件 | 不强制       | 内存总线（事务后同步）      | MQ + Outbox（至少一次） |
| 并发     | DB 锁        | 聚合根乐观锁 Version        | L2 + 分布式锁           |

## 代码骨架

```go
// domain/order/order.go（零外部依赖）
var ErrCanceled = errors.New("already canceled")
type Order struct { ID string; Status Status; Version int64 }
func (o *Order) Cancel() error {
    if o.Status == Canceled { return ErrCanceled }
    o.Status = Canceled
    return nil
}

// domain/order/repository.go
type Repository interface {
    FindByID(ctx context.Context, id string) (*Order, error)
    Save(ctx context.Context, order *Order) error
}

// infrastructure/repository/order_repo.go
type GormRepo struct { db *gorm.DB }
func (r *GormRepo) Save(ctx context.Context, o *Order) error {
    return r.db.WithContext(ctx).Model(o).Where("version=?", o.Version).Updates(...).Error
}

// application/order/service.go（编排，无业务规则）
type Service struct { repo order.Repository; events EventPublisher }
func (s *Service) Cancel(ctx context.Context, id string) error {
    o, _ := s.repo.FindByID(ctx, id)
    if err := o.Cancel(); err != nil { return err }
    return s.repo.Save(ctx, o)
}

// interfaces/http/order_handler.go
func (h *Handler) Cancel(c *gin.Context) {
    var req CancelReq
    if err := c.ShouldBindJSON(&req); err != nil { ... }
    if err := h.svc.Cancel(c.Request.Context(), req.ID); err != nil { mapError(c, err); return }
    c.Status(204)
}

// cmd/api/main.go
db := gorm.Open(...)
repo := &repo.GormOrderRepo{db: db}
svc := &order.Service{repo: repo}
handler := &http.OrderHandler{svc: svc}
```

## 事务策略

- 应用层闭包：`repo.Transaction(ctx, func(txRepo Repo) error { ... })`
- 或 `context` 传 `*sql.Tx`，应用层控制边界
- **禁止**：Interface/Domain 层管事务

## 查询与读模型

- 写模型走聚合根，强一致
- 读模型（复杂列表/报表）：应用层定义 `XxxQuery`，Infra 直接执行优化 SQL/视图，返回只读 DTO，**绕过聚合根**
- 禁止：为列表加载整个聚合根及子实体

## 错误处理

- Domain 哨兵：`var ErrOrderCanceled = errors.New("order already canceled")`
- Interface 映射：`ErrNotFound`→404 / `ErrConflict`→409 / `ErrInvalid`→400
- 禁止：透传 `sql.ErrNoRows`

## 领域事件

- 发布时机：事务提交后
- L3：Outbox 表 + 扫表重发（至少一次）
- 消费端：按业务唯一键幂等

## 配置与可观测

- `viper` 或环境变量（12-factor），集中 `Config` 结构体
- 通过 `context` 传 `trace_id`；I/O 记录耗时与错误
- 禁 `log.Fatal` 非 main 包

## 并发与乐观锁

- 聚合根 `Version int64`
- `UPDATE orders SET status=?, version=version+1 WHERE id=? AND version=?`
- 影响行数为 0 → `ErrOptimisticLock` → 应用层重试或 409
- 禁止：无版本字段的"先查再改"

## 测试

Domain：`go test` 纯单测；Application：mock 仓储；Infra：集成 + testcontainers

## 误区

- DDD ≠ 微服务（可用于单体 L1/L2）
- 只对核心域做 DDD（辅助功能用事务脚本）
- 默认不引入 Event Sourcing / CQRS
- 乐观锁 + 重试足以应对 99% 并发