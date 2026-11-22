# 文案（zh-CN / en-US）· 设置面板改版 · T749 / Issue #360

> 配套设计稿：`docs/designs/360-settings-polish.md`。落点：`packages/shared/locales/{types,zh-CN,en-US}.ts` **三处齐备**（`LocaleKey` 联合类型 + 中英各一）。
> **表格形式说明**：本文件按 `deliverable-docs.md §七` 例外 ③（需被解析的结构化清单）保留表格 —— 列固定为 key / zh-CN / en-US，内容逐行落入 `locales`。
> 结论：本期**零新增键** —— 2 个键退役、5 处原位复用（其中 `settings.restore.deletionDeadline` 为现存零引用键的首用）；⛔ 面向用户禁出现 `deactivedAt` / `createdAt` / `archivedAt` / `profile` 等内部键名（AGENTS 界面原则 ①）。

## 一、退役键（随「更多信息」分组删除 · AC9）

| key                    | 现值（zh-CN / en-US）   | 处置                                                                                         |
| :--------------------- | :---------------------- | :------------------------------------------------------------------------------------------- |
| `settings.moreInfo`    | 更多信息 / More Info    | **删**（分组不存在；`UserInfoViewer` 组件与导出一并移除）                                    |
| `settings.deactivedAt` | 注销时间 / Deactived At | **删**（值实为「数据删除时间」= 停用日 − 7 天 ⇒ 标签名不实，且 en 拼写有误；改指 §二下一条） |

## 二、复用键（零改值，仅指定新落点）

| key                                                           | 现值                                                              | 新落点                                                                                                                                       |
| :------------------------------------------------------------ | :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings.registeredAt`                                       | 注册时间 / Registered At                                          | 身份区**第三行标签**（值 = `profile.createdAt`，已由 converter 格式化，⛔ 不另行格式化）                                                     |
| `settings.password`                                           | 密码修改 / Change Password                                        | **密码分区组头标题**（`<h3 class="sd-group__title">`；无副说明，警示句留在表单 `rule-hint`）                                                 |
| `settings.restore.deletionDeadline`                           | 数据删除时间：{date} / Data deletion time: {date}                 | 危险区**末行**（仅待注销渲染）；插值 `t(key, { date })`，date = `deactivedAt − 7 天`（沿用 `info.vue` 既有计算）。该键现存但零引用，本期首用 |
| `settings.passwordHintTitle` / `settings.passwordHintContent` | 密码安全提醒 / 为保护您的账号安全，建议您定期更换密码…（en 同义） | 不变，仍由表单内 `rule-hint variant="warning"` 承载 —— 分区组头**不重复**这句话                                                              |
| `settings.ia.account.name` / `.desc`                          | 账户 / 资料、密码与登录设备                                       | 不变（分组头与面板头同源）                                                                                                                   |

## 三、口径与约束

- **日期格式**：沿用既有格式，⛔ 本期不改 —— 注册时间 `YYYY-MM-DD HH:mm:ss`（`user-service/converters` 产出）、数据删除时间 `YYYY-MM-DD HH:mm:ss`（`info.vue` 现有 `subtract(7,'days')` 计算）。若要改成日粒度，须另立一条并同步两条时间（不在本期范围）。
- **说人话**：第三行文案是「注册时间 + 日期」，不是「createdAt」；危险区末行是「数据删除时间：…」，不是「deactivedAt / 注销时间」（后者会被误读为「什么时候注销的」，实为「什么时候被删数据」）。
- **不新增文案的地方**：左栏 4 项名称（`settings.ia.*`）不变（改版只改视觉形态）；密码分区无副说明（避免与 `rule-hint` 同义重复）；危险区标题与 `desc` 不变；窄屏段标签（`*.short`）不变。
- **en 边界（AC8）**：本批文案在 13rem 左栏 / 310px 窄屏内容宽内均不需要额外缩写；`Data deletion time: 2025-12-01 10:22:31`（14px ≈ 300px）为最长单行，窄档允许自然换行（不截断）。
- **校验**：`types.ts` 的 `LocaleKey` 联合类型须同步删两键（`settings.moreInfo` / `settings.deactivedAt`）；删键后 `vp check` 的类型检查即死键守卫（引用未删净会直接报错）。