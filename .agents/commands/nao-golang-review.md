# 后端 DDD 代码审查

按 nao-golang-ddd 技能的红线标准审查 Go 代码变更，输出逐条通过/违反报告与修复建议。适用于 Go 标准布局项目（`cmd/`、`internal/`、`pkg/`）。

## 流程

1. **确定审查范围**：默认只检查 Git 变更代码（`git diff --staged` 与 `git diff` 合并的工作区未提交变更）；**仅当用户在运行命令时指定了范围**（如 `/nao-golang-review internal/domain` 或指定文件/目录）才以指定范围为准；若 `git diff` 为空且用户未指定范围，提示用户提供范围。
2. **识别项目布局**：确认 `internal/domain/`、`internal/application/`、`internal/interfaces/`、`cmd/` 等目录的存在与职责划分。
3. **逐条执行红线检查**：仅对变更涉及的代码检查，记录证据（文件路径 + 行号 + 代码片段）；未变更文件不审查。
4. **输出审查报告**：逐条标记 ✅ 通过 / ❌ 违反 / ⚠️ 无法判定，违反项附证据与修复建议，最后汇总统计与阻塞项。

## 红线检查清单

### 通用红线（核心铁律）

- [ ] **Domain 层零框架依赖**：`internal/domain/` 是否导入了任何 ORM（GORM）、Web 框架（Gin）或 RPC 框架的包？（应为零）
- [ ] **Application 无业务规则**：Application 层逻辑是否包含 `if order.Status == Paid` 这样的业务规则？（应上移至 Domain 方法）
- [ ] **控制器不直调 Repository**：HTTP 控制器是否直接调用了 Repository 接口？（必须经过 Application Service）
- [ ] **跨服务不共享 internal/domain**：跨微服务是否共享了 `internal/domain` 中的代码？（必须使用 `pkg/contracts` 或独立 Protobuf 仓库）
- [ ] **乐观锁**：更新聚合根时，是否通过版本号（Version）校验了并发冲突？

### DI 红线（依赖倒置）

- [ ] **显式构造函数注入**：依赖组装是否使用显式构造函数注入（`main.go` 或 Google Wire），禁止反射或 Service Locator 模式、禁止框架注解？
- [ ] **组装收敛 cmd/main.go**：是否在 `cmd/api/main.go` 中按序手工初始化（Config → DB → Repository → Service → Handler）？

### Go 特有红线

- [ ] **禁 panic**：业务逻辑是否使用 `panic`？（严禁，须使用哨兵错误）
- [ ] **哨兵错误 + 状态码映射**：领域层是否定义哨兵错误（`var ErrOrderCanceled = errors.New("...")`），应用/接口层根据错误类型映射 HTTP 状态码（如 409 Conflict）？
- [ ] **VO 工厂函数**：值对象（VO）是否提供工厂函数（`NewMoney(amount, currency)`），而非直接使用裸结构体？（防无效零值污染业务逻辑）
- [ ] **context 首参**：所有涉及 I/O 的方法（数据库、RPC）首个参数是否为 `context.Context`？（传递链路追踪 ID、超时信号、事务句柄）

## 输出规范

```text
## 审查报告（nao-golang-review）

范围：git 变更（或：用户指定 <路径>）
布局：Go 标准布局（cmd / internal / pkg）

### 通用红线（5 项）
- ✅ Domain 层零框架依赖
- ❌ Application 无业务规则 — 证据：internal/application/order/order_service.go:23 `if o.Status == Paid` → 建议：业务规则上移至 Order 实体方法
- ⚠️ 待确认项 — 原因：<无法判定的说明>

### DI 红线（2 项）/ Go 特有红线（4 项）
<同格式逐条列出>

### 汇总
- 通过 X / 违反 Y / 共 11 项
- 阻塞项：<违反项列表>（红线违反必须修复后合入；非红线问题仅提示不阻塞）
```

注意事项

- 红线违反视为阻塞项，必须修复后才能合入；非红线问题（风格、命名建议）仅提示
- 证据必须包含文件路径与行号，无证据不下结论
- 无法判定的项标记 ⚠️ 待确认并说明原因
- 默认只审查 Git 变更代码，未变更文件不审查；用户指定范围时以指定为准