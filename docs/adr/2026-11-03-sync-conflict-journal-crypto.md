# ADR：冲突台账的密文姿态（A 批 `R-H`）

- 状态：已接受（待落地）
- 更新：2026-11-03
- Owner：arch-designer
- 指针：`docs/prds/2026-11-03-data-sync-a-batch.md`（R-H）· `docs/reports/T640-sync-a-batch-arch-review.md`（Q1）· `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md`（C-46/C-51）· `docs/reports/2026-10-27-T562-data-sync-audit.md`（F-13）

## 背景

- `A1`/`A3` 会把更多业务内容写入 `meta.conflictJournal`（败方快照），该字段明文；审计 `F-13` 判其「与业务字段加密落库不一致」。
- 前提已变：`cryptoService.encrypt` 恒出 `plain:<原文>`（C-46 明文姿态已生效），业务行本身即明文 ⇒ 台账不再是「弱于业务库的副本」。
- PRD `R-H` 要求先裁决、后实现快照落库。

## 决策

采纳 (b)：**沿用明文，登记风险接受，并以「快照最小化」控制增量暴露**；明确否决 (a) 同批加密与 (c) 只存摘要。若将来重开本地加密（C-46 变更），台账须在同一次变更内一并纳入。

## 理由

1. 业务匹配：暴露面与业务表同级（同一 IndexedDB、同一磁盘读者），加密台账不改善用户可感知的安全边界。
2. 成熟度：C-46 为已生效条款且明令禁止「半明文」；单点加密属被该条款显式否决的形态。
3. 团队能力/可行性：web 端从不 `setup/unlock`，无 DEK ⇒ 只加密台账在 web 只能回落明文（假安全）或直接读不出。
4. 成本：本方案 0 人天；全库真加密需 5–8 人天 + 冷启动密码门（与 D-6/K8「冷启动不输密码」互斥）。

## 对照过的备选模式

1. **维持现状 + 边界登记（采纳）** —— 适用：单用户多端、本机库已明文、无合规审计诉求；代价：本机可读者可见台账内容（增量为副本量与保留期）；不采纳理由：无（采纳）。
2. **仅加密台账 `loser`（不采纳）** —— 适用：业务库已加密的形态；代价：迁移/密钥轮换 + web 无 DEK 破口；不采纳理由：违反 C-46「禁止半明文」、在 web 制造假安全。
3. **全库真加密（不采纳，本批）** —— 适用：有合规/被遗忘权诉求；代价：5–8 人天 + 冷启动密码门 + 存量迁移回填；不采纳理由：超 A 批范围，且与「冷启动不输密码」姿态冲突。
4. **只存摘要 / 字段级 diff 不含值（不采纳）** —— 适用：仅需可观测不必恢复；代价：无法恢复被覆盖内容；不采纳理由：违背 AC1「据此恢复被覆盖字段」。

## 后果与风险

- 正面：`A1`/`A3` 可立即实现；不引入迁移、密钥轮换与跨端能力差异。
- 负面：冲突内容（含任务标题/描述/评论正文）在本机明文留存，仅受 200 条环形淘汰约束。
- 控制措施（写入实现约束）：快照只存 **diff 涉及的字段 + 身份字段**（禁整行复制）；文本字段截断 ≤512 字符并标 `truncated`；上限 200 不升；不入网络上报；随登出/清库清除（沿用现有清理链路）。

## 限制与已知边界

- 仅覆盖 `conflictJournal`；不含 B/C 批的字段级或事件化载荷（届时应按「全库姿态」重判，而非单点加密）。
- 不含移动端（红线）；不含服务端审计日志（本批不做）。
- 重评触发（任一成立即重开本条）：① C-46 被重开（引入本地加密）② B 批立项 ③ **2027-02-03**。

## 相关指针

- 实施约束与验收口径：`docs/reports/T640-sync-a-batch-arch-review.md` §3
- 台账存储与清理：`packages/infrastructure/src/persistence-sync/conflict-journal.ts` · `persistence-local/db/local-database.ts`（`MetaRecord.conflictJournal`）

## 参考来源

- `packages/infrastructure/src/persistence-local/crypto/crypto-service.ts:207-211`（`encrypt` 直出 `plain:`）· 访问 2026-11-03 · 业务行明文，台账非弱化副本。
- `docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md` §3 C-46/C-51 · 访问 2026-11-03 · 禁止半明文、双格式读取。
- `apps/desktop/src/renderer/src/hooks/usecases/binding.ts:129,148` · 访问 2026-11-03 · 仅 desktop 具备 `setup/unlock`。
- 未检索到外部来源（内部姿态裁决，无需业界对照）。