# 文案（zh-CN / en-US）· 设置面板改版 · T749 / Issue #360

> 配套设计稿：`docs/designs/360-settings-polish.md`。落点：`packages/shared/locales/{types,zh-CN,en-US}.ts` **三处齐备**（`LocaleKey` 联合类型 + 中英各一）。
> **表格形式说明**：本文件按 `deliverable-docs.md §七` 例外 ③（需被解析的结构化清单）保留表格 —— §一 = 分区 / 组头键 / 副标题键 / zh-CN / en-US，§二–§三 = key / 现值 / 处置与落点，内容逐行落入 `locales`。
> 结论：本期**新增 3 键**（账户面板四分区副标题，§一）+ **2 键退役**（§二）+ **7 行原位复用**（§三）；⛔ 面向用户禁出现 `deactivedAt` / `createdAt` / `archivedAt` / `profile` 等内部键名（AGENTS 界面原则 ①）。

## 一、四分区副标题（T751 新增 · 用户第二轮要求）

> 账户面板 = 资料 / 密码 / 登录设备 / 危险区**四个平级分区**（设计稿 §1）：每区一律 = 组头（`h3.sd-group__title` 20/600）+ **一句副标题**（`.sd-group__desc` 12 / `--nue-secondary-text-color`）+ 内容。**组头名零新增**（全复用现存键）；副标题只新增 3 键（危险区复用既有键）。键名沿用 `settings.ia.<section>.desc` 既有命名面（同 `account.desc` / `danger.desc`）。

| 分区     | 组头键（复用）          | 副标题键                                | zh-CN                                        | en-US                                                                  |
| :------- | :---------------------- | :-------------------------------------- | :------------------------------------------- | :--------------------------------------------------------------------- |
| 资料     | `settings.profile`      | `settings.ia.profile.desc`（**新增**）  | 昵称、邮箱与注册时间                         | Your nickname, email and sign-up date.                                 |
| 密码     | `settings.password`     | `settings.ia.password.desc`（**新增**） | 修改后需要用新密码重新登录                   | You’ll sign in again with the new password.                            |
| 登录设备 | `settings.sessionTitle` | `settings.ia.devices.desc`（**新增**）  | 已登录的浏览器与设备，可单独下线             | Signed-in browsers and devices — sign out any of them.                 |
| 危险区   | `settings.dangerZone`   | `settings.ia.danger.desc`（**复用**）   | 以下操作会改变账户状态或清除数据，请先确认。 | These actions change your account or erase data. Please confirm first. |

- **四句都说人话**（一句一义 · 无技术键名）：资料 = 里面有什么；密码 = 改完的后果；登录设备 = 能做什么；危险区 = 为什么要小心。
- **密码副标题 ⛔ 不复用 `passwordHintContent`**（安全建议已由表单内 `rule-hint` 就近承载，重复即噪）—— 它只交代「改完要重新登录」这一**操作后果**。
- **落地口径**：`types.ts` 的 `LocaleKey` 联合类型 + `zh-CN.ts` / `en-US.ts` **三处齐备**（3 键 × 3 处 = 9 条），组件内用 `t('settings.ia.<x>.desc')` 直接引用；组头↔副标题间距 = `--nue-gap-2xs`（4，`.sd-group__head` 既有 L3 口径，见设计稿 §3d）。
- **en 长度**：最长句 `Signed-in browsers and devices — sign out any of them.`（12px）在 310px 窄档内自然换行、⛔ 不缩写。
- **登录设备 ↔ 组件内标题去重**：`session-manager.vue` 自有 `.session-manager__title`（14/600，同用 `settings.sessionTitle`）⇒ 升为分区后**隐藏**，避免两级同名标题；刷新按钮仍在原行内（视觉不动）。

## 二、退役键（随「更多信息」分组删除 · AC9）

| key                    | 现值（zh-CN / en-US）   | 处置                                                                                                                          |
| :--------------------- | :---------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `settings.moreInfo`    | 更多信息 / More Info    | **删**（分组不存在；`UserInfoViewer` 组件与导出一并移除）                                                                     |
| `settings.deactivedAt` | 注销时间 / Deactived At | **删**（值实为「数据删除时间」= 停用日 − 7 天 ⇒ 标签名不实，且 en 拼写有误；改指 §三 的 `settings.restore.deletionDeadline`） |

## 三、复用键（零改值，仅指定新落点）

| key                                                           | 现值                                                              | 新落点                                                                                                                                       |
| :------------------------------------------------------------ | :---------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings.registeredAt`                                       | 注册时间 / Registered At                                          | 身份区**第三行标签**（值 = `profile.createdAt`，已由 converter 格式化，⛔ 不另行格式化）                                                     |
| `settings.profile`                                            | 用户信息 / User Profile                                           | **资料分区组头**（`h3` 20/600）—— 现存键首次进入生产引用（此前仅测试引用），⛔ 不改值（「用户信息」作分区头成立，比新造「资料」少一键）      |
| `settings.sessionTitle`                                       | 登录设备 / Signed-in Devices                                      | **登录设备分区组头**（本轮由组内尾块升为独立分区）；组件内同名小标题隐藏（§一末条）                                                          |
| `settings.password`                                           | 密码修改 / Change Password                                        | **密码分区组头标题**（`<h3 class="sd-group__title">`；副标题走 §一，警示句仍留表单 `rule-hint`）                                             |
| `settings.restore.deletionDeadline`                           | 数据删除时间：{date} / Data deletion time: {date}                 | 危险区**末行**（仅待注销渲染）；插值 `t(key, { date })`，date = `deactivedAt − 7 天`（沿用 `info.vue` 既有计算）。该键现存但零引用，本期首用 |
| `settings.passwordHintTitle` / `settings.passwordHintContent` | 密码安全提醒 / 为保护您的账号安全，建议您定期更换密码…（en 同义） | 不变，仍由表单内 `rule-hint variant="warning"` 承载 —— 分区组头**不重复**这句话                                                              |
| `settings.ia.account.name` / `.desc`                          | 账户 / 资料、密码与登录设备                                       | 不变（分组头与面板头同源）                                                                                                                   |

## 四、口径与约束

- **日期格式**：沿用既有格式，⛔ 本期不改 —— 注册时间 `YYYY-MM-DD HH:mm:ss`（`user-service/converters` 产出）、数据删除时间 `YYYY-MM-DD HH:mm:ss`（`info.vue` 现有 `subtract(7,'days')` 计算）。若要改成日粒度，须另立一条并同步两条时间（不在本期范围）。
- **说人话**：第三行文案是「注册时间 + 日期」，不是「createdAt」；危险区末行是「数据删除时间：…」，不是「deactivedAt / 注销时间」（后者会被误读为「什么时候注销的」，实为「什么时候被删数据」）。
- **不新增文案的地方**：左栏 4 项名称（`settings.ia.*`）不变（改版只改视觉形态）；危险区标题与 `desc` 不变；窄屏段标签（`*.short`）不变；四区组头名全部复用（§三），**只新副标题**（§一）。
- **en 边界（AC8）**：本批文案在 13rem 左栏 / 310px 窄屏内容宽内均不需要额外缩写；`Data deletion time: 2025-12-01 10:22:31`（14px ≈ 300px）为最长单行，窄档允许自然换行（不截断）。
- **校验**：`types.ts` 的 `LocaleKey` 联合类型须同步增 3 键（§一）/ 删 2 键（§二）；增删后 `vp check` 的类型检查即死键与缺键守卫（引用未删净 / 新键未三处齐备均会直接报错）。