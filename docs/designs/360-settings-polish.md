# 设计稿 · 设置面板改版（T749 / Issue #360）

- 需求：`docs/prds/2026-11-22-settings-polish.md`（AC1–AC12）· 落点：`apps/web/src/components/settings/**`（桌面 / Web 共用；移动端零改动）· 闸门：本稿 PASS 仅覆盖设计产物（BR2a），实现后视觉一致性由用户走查判
- 视觉基准：`nue-ui@1.15.3` + `nue-ui-theme-shadlike@0.13.30`（`node_modules` 直读）+ 本仓 `apps/web/src/themes/*.css`；**全部取值 = `--nue-*` token 或组件原生档位**，⛔ 零新 token / 零新组件（AC11）
- 图源：**未出图**（本轮无绘图 MCP 会话）⇒ BR4 档位 ① 结构化文字规格 + ③ 分步作图指令（§9），⛔ 不留假帧、不报阻塞；配套 `360-settings-polish-copy.md`（文案）与 `360-settings-polish-design-md.md`（`DESIGN.md` 增补草案，待 PM 审定后并入）

## 1 信息架构

- 层级不变（3 层封顶）：`设置 › 账户 / 外观与语言 / 提醒 / 数据与关于`（4 类 IA 是既有契约）；**不改路由 / URL / 深链**（PRD 非范围）。
- 账户面板：`账户组（身份区 → 密码子块 → 登录设备）› 危险区域`，**位置零位移**（密码原位升级，不换顺序）⇒ 不牵动 `session-manager` 自带标题；「带组头的组内子块」沿用 `data-panel.vue`「关于与更新」的既有写法（`.sd-group__head` + `<h3 class="sd-group__title">` 嵌在 `.sd-group` 内，#358 已落地）⇒ ⛔ 不引入第三种块语言（AC2/AC3/AC6）。

## 2 流程

- **P1 看自己 / 改密码**：进账户 → 头像右侧三行（昵称 / 邮箱 / 注册时间）一次读完，全程**无展开动作**；继续滚动即见密码分区标题 + 三个输入框（常驻展开，无折叠行、无 chevron、无 `aria-expanded`）→ 提交 → 改密成功即登出（既有语义零改动，AC2/AC3）。
- **P2 待注销 / 窄屏**：`profile.deactivedAt` 存在 ⇒ 危险区**末行**出现「数据删除时间：{date}」，不存在 ⇒ 不渲染（不留空行 / 空标签，AC5/AC6）；窄屏段切换在上、单列面板在下，块序与宽档一致（AC7）。

## 3 视觉规范

- **§3a 左栏四态（AC1 / AC12）** —— 取本仓 router-link 观感 = `nue-link--route` 的既有四态值；⛔ **删除 `box-shadow: inset 2px 0 0`**（左侧竖线，AC1 主判据）。
- **未激活**：文字 + 图标 `--nue-primary-text-color`（-800，白底 **12.63** ✓）· 底透明 · 无描边 · `radius: --nue-primary-radius`(6) · `min-height: --nue-box-size-md`（40px）+ `padding-inline: --nue-padding-sm` + `gap: --nue-gap-xs`；⛔ 不用固定 `height`（英文两行须能长高，AC8）。
- **hover**：底 `--nue-primary-color-200`（-900 压 -200 = **10.84** ✓）· 文字/图标**不变色**（不靠变色传达 hover）。
- **激活**：底 `--nue-primary-color-900` + 文字/图标 `--nue-primary-color-0`（**17.40** ✓）+ `font-weight: 600` ⇒ 去色后仍靠「深填充 + 字重」两通道可辨。
- **focus-visible**：`outline: 2px solid var(--nue-primary-color-600)` + `outline-offset: 2px`（本仓 `themes/link.css` 既有口径；-600 白底 5.74 ✓ ≥3）。
- **a11y 不降级**：DOM 与语义**零改动** —— 仍 `<button role="tab">` + `aria-selected` + `aria-orientation="vertical"` + `↑↓/Home/End` 漫游焦点（切后焦点跟到新 tab）+ `aria-controls`/`aria-labelledby` 互指；改的只有 `background / color / font-weight` 三条视觉声明。

### 3b 账户身份区（AC2 / AC5）

- 头像 ｜ 右侧三行 = ① 昵称（`--nue-text-lg` 20px / `-900` / 600）② 邮箱（`--nue-text-sm` 14px / `--nue-secondary-text-color`）③ `注册时间` + `profile.createdAt`（14px / 同上；值已由 `user-service/converters` 格式化为 `YYYY-MM-DD HH:mm:ss` ⇒ ⛔ 不改格式）—— ②③ 同字号同左缘成「元信息簇」，昵称独占首行（倍率 20/14 = 1.43 ✓）。
- 删「更多信息」分组与 `UserInfoViewer`（AC9：`settings.moreInfo` 键 + 组件导出随删，`profile-updater/__tests__` 的 stub 同步移除）；空 / 离线时第三行整行 `v-if="profile?.createdAt"` ⇒ 不渲染（不留空标签 / 空行），昵称沿用 `readCachedNickname()` 兜底、邮箱沿用既有 `identity.offline`（AC5）。

### 3c 密码常驻分区（AC3）—— 为什么比现在更明显（三通道，均非新造）

- ① **组级标题**：`.sd-group__head` 既有口径 —— `<h3 class="sd-group__title">` 20px/600，**无副说明**（警示句已在表单内 `rule-hint`，不重复）；现状密码只是 14px 行标签（与「修改用户昵称」同档）⇒ 这是「不够明显」的首要原因。
- ② **块间距**：拿「块↔块」档（§3d L2 的 24px）⇒ 与上一块不再是「行↔行」关系。
- ③ **有底色块**：`background: --nue-primary-color-100` + `border-radius: --nue-primary-radius` + `padding: --nue-padding-sm` —— **逐字复用 `.sd-permission-notice`（提醒面板引导块）三件套**；面板内「-100 底」共 7 处（`sd-tab` hover / 激活、`sd-row__toggle` hover、`sd-row__action`、`sd-permission-notice`、`sd-update__row`、`session-item.is-current`）⇒ 既有语言；其中**容器级**先例 = `sd-permission-notice`（`sd-update__row` 是行块且带 1px 透明边框），本分区是它的放大版。
- ⛔ 不加描边 / 图标 / 阴影 / 字号（一个区块只加一处重量）；底色 vs 页面仅 **1.18:1**（弱边界）⇒ 底色**只作第三通道**，去色后仍有标题（20 vs 14）与 24px 块间距，满足「不用颜色单独承载语义」。

### 3d 间距台阶（AC4）：每层一个唯一 token，数值单调（1 / 2 / 2 / 1.5 倍）

- **L0 对话框外边距** = `--nue-padding-df`（16）— 唯一来源：`.nue-dialog` 主题的 `padding`；⛔ 删 `.sd-panel` 的 `padding: 12px 1.5rem 2.5rem 1.25rem`（**双层内边距①**：左 20 / 右 24 / 下 40 全叠在 16 之上）。**L1 栏间** = `--nue-padding-md`（20）— 唯一来源 `.sd-tabs { padding-inline-end }`（现 `0 1.25rem 0 0` 字面值）。
- **L2 分类间距（块↔块）** = `--nue-gap-lg`（24）— 唯一来源：`.sd-cat { gap }`（现 2.75rem = 44px，非 token）；⛔ 删 `.sd-group--danger { margin-top: --nue-gap-lg }` 与 `.sd-update__head { margin-top: 2.75rem }`（**双层内边距②**）；组内子块顶部间距**同 token、同一持有者** = `.sd-subblock { margin-top }`。
- **L3 组头↔首行** = `--nue-padding-df`（16）— `.sd-group__head { margin-bottom }`（现 1rem 字面值）；组头内 标题↔说明 = `--nue-gap-2xs`（4，现 0.375rem）。
- **L4 行↔行** = `--nue-padding-xs`（8）— 唯一来源：`.sd-group { display: flex; flex-direction: column; gap }`；行自身 `padding-block: 0`（现每行上下各 8 叠成 16，与 L3 同档 ⇒ **双层内边距③**）。
- **L5 行内元素** = `--nue-gap-xs`（8，横向 标签↔控件）/ `--nue-gap-2xs`（4，纵向 标签↔说明；现 `.sd-row__text { gap: 2px }` 字面值）。
- **L6 分区内元素（密码块）** = 块内边距 `--nue-padding-sm`（12）；块内字段间距**沿用组件原生**（`nue-div` 16 / `form-item` 8，定义处 `presentation-identity`）⇒ 本面板不重复声明（同一语义单处定义）。
- **块内水平内缩（横轴）** = `--nue-padding-sm`（12）— 唯一来源：`.sd-group { padding-inline }`；⛔ 删 `.sd-group__head` 与 `.sd-row` 各自的 `padding-inline: 12`（现与 `.sd-panel` 的 20 叠成**三层**，文本左缘距框边 48 → 28px）。
- **窄屏不分叉 + 行高唯一来源**：删 `is-narrow` 下三条覆盖（`.sd-panel` 的 `8 0 32`、`.sd-row` 的 `8 4`、`.sd-group__head` 的 `0 4`）与 `.sd-cat { gap: 2rem }`（**双层内边距④**），仅留 `.sd-body.is-narrow { gap: --nue-gap-xs }`；行高统一 `--nue-box-size-md`（40，现混用 `2.5rem` / `2.75rem` / `44px`，AC12 命中区）。

## 4 token（颜色全取 `nue-*`；**有底色处整体重算**，不搬白底值）

- 左栏：未激活 `-800` **12.63** ✓ / hover 底 `-200`（-900 压 **10.84** ✓）/ 激活 `-900` 底 + `-0` 字 **17.40** ✓ / 焦点环 `-600` **5.74** ✓。
- 密码块（底 `-100`）：标题与正文 `-900` **13.94** ✓；块内表单 label 由 `-600`（压 -100 = **4.60**，仅超线 0.1）⇒ 覆写 `-700` **6.77** ✓；输入框静止边框 `--nue-divider-color` 压 -100 = **1.36**（白底 1.61，同为装饰性，DESIGN §2 已登记），hover/focus 边框 `-600` = **4.87** ✓ ≥3 ⇒ 边界可辨由状态承担。
- 其他：危险区「数据删除时间」`--nue-error-color-90` 白底 **8.97** ✓（DESIGN §2 既有值，⛔ 不用 `.nue-div--deletion` 现用的 `-50`）；身份区第三行 `--nue-secondary-text-color` **5.74** ✓（与邮箱同档，⛔ 不另开色阶）；圆角只用 `--nue-primary-radius`(6)、字阶只用 20 / 14 / 12 三档（⛔ 不引 8px 圆角与第 4 档）。

## 5 状态

- 左栏 4 项 × 4 态见 §3a（窄屏由 `segmented-switch` 承担，**该件视觉不动**，DESIGN §4.5 契约已锁定）；身份区：加载中（资料未就绪）/ 离线（昵称缓存 + `identity.offline`，第三行隐藏）/ 就绪（三行齐）/ 极值（超长邮箱 `overflow-wrap: break-word` 换行不撑宽）；密码：空表单（提交禁用，既有 computed）/ 规则不满足（`password-rule-hint` 就近）/ 提交中（`nue-button :loading`）/ 失败（`NueMessage.error`）/ 成功（登出跳登录）—— **全部沿用，零改动**。
- 危险区：常态（退出登录 / 注销账户）/ 待注销（退出登录 / 撤销注销 + 删除时间行）/ 冷却期（注销行 `disabled`）；空态无「更多信息」空盒，删除时间行不满足条件时不占位（AC5/AC6）。

## 6 断点（AC7 / AC8）

- **宽**（对话框 > 445px，桌面恒真）：rail 13rem + 面板 `flex: 1`；密码块铺满内容宽（表单自带 32rem 上限）。**首个被折叠内容：无** —— 本稿不折叠任何信息（「更多信息」是删除而非折叠，信息已迁移）。
- **窄**（`is-narrow`，≤445px）：段在上、单列在下；**台阶不分叉**（§3d）⇒ 390px 视口内容宽 = 366 − 2×16(L0) − 2×12(块内缩) = 310px，密码块不溢出、按钮不截断。
- **英文**：`Appearance & Language` 在 13rem 内按词断两行、深底激活块随之长高（`min-height` 而非 `height`）；`Change Password`(20px ≈ 165px) 与 `Data deletion time: 2025-12-01 10:22:31`(14px ≈ 300px) 均在 310px 内或自然换行、不截断。

## 7 可用性

- 主路径点击数：见密码分区 = **0 次点击**（原需先发现折叠行再展开）；撤销注销 = 1 次（二次确认保留）。防误操作：注销 / 撤销注销各自二次确认 + 冷却期禁用，零改动（AC6 / DESIGN §7）；反馈：改密沿用 `nue-button :loading`，本面板无替换式内容区 ⇒ `LoadingError` 不适用（会话列表已用）。

## 8 无障碍

- 左栏语义与键盘**逐字不变**（§3a 末条）；`aria-selected` 与视觉激活态同源同刻更新；对比度全部取值见 §4（文本 ≥4.5、承载语义的图形/边框 ≥3，AC12）。三重冗余：左栏 = 深填充 + 字重 + `aria-selected`；密码分区 = 标题层级 + 块间距 + 底色（1.18 弱，非唯一通道）；危险区 = 错误色标题 + 位置次序 + 文案。
- 命中区：行 40px（`--nue-box-size-md`），行内控件沿用 `nue-button` 原生 36px（#358 裁定，见 §9 ①）；动效沿用 `sd-fade` + `prefers-reduced-motion`，⛔ 不新增过渡。

## 9 降级产物 · 作图指令 · 取舍与代价

- 画板指令（1280×800 · Penpot 文件「桌面端」页 `设置页` · 图层 `section/name`，照做可复现）：① `s360/left-nav-states` 左栏 4 行套四态 + 标注「无左侧竖线 · 字重 600」；② `s360/account-before-after` 左右并排（现状 = 更多信息组 + 折叠密码行 / 新版 = 三行身份 + 密码分区 + 危险区时间行）；③ `s360/password-section` 分区放大图 + 右侧标 ①②③ 三通道；④ `s360/spacing-ladder` 同一面板叠 6 条标注线，逐层标 L0–L6 与 token 名。
- 取舍与代价（**请 PM / 用户裁**）：① 行内按钮 36px（组件原生）低于 AC12 的 40px 字面要求 —— 建议沿用 #358「控件按组件档位、行本体 ≥40」，否则会重开 30px 例外式的自造尺寸；② 密码块底色使块内输入框静止边框 1.61 → 1.36（装饰性，状态边框 4.87 承担可辨）—— 若走查觉得「输入框边界太平」⇒ **降级 B**：删底色三件套（3 条声明），区分退回「组头 + 块间距」；③ 左栏激活深填充是 router-link 既有激活态，若在浅色对话框里觉得过重 ⇒ **降级 C**：底改 `-100` + 文字 `-900` + 字重 600（仍无竖线）；④ 危险区与上方块的间距从 68px（44 + 24 叠加）收敛到 24px（§3d L2），辨识改由错误色标题承担 —— 若走查觉得「离得太近」⇒ 恢复 `.sd-group--danger { margin-top: var(--nue-gap-lg) }` 一行（代价 = 该区块间距回到「两处定义」）。

- 逐条 AC 结论（**设计产物层面**）：AC1–AC12 全部 **PASS** —— AC1/AC12 → §3a；AC2/AC5/AC9 → §3b；AC3 → §3c；AC4 → §3d；AC6 → §2/§5；AC7/AC8 → §6；AC10 → §1（移动端零改动，本稿只出文档）；AC11 → §4 + `DESIGN.md` 草案。