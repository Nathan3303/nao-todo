# 设计稿 · 桌面端应用内自我更新（T734 / Issue #358）

- 需求：`docs/prds/2026-11-20-desktop-self-update.md`（AC1–AC13）· 分支 `feat/358-desktop-self-update` · 落点：设置 →「数据与关于」→ **关于与更新**（仅桌面端）+ 侧栏「可更新」弱提示 + 重启前数据护栏确认
- **视觉口径 v4（2026-11-21 · T746）**：用户否决 v3，原话「还是很难看，不符合当前项目的风格」，并**点名参照任务列表主视图**（`packages/presentation/task/components/list/list.css` · `.nue-div--todo-list-main__row`）。v3 的病根 = 自造了**第三套盒子**（1px 边框 + radius 8 卡片 + 卡内 48/46px 定高 + 自定义 `sd-update__label` + 30px 特例控件），而面板既有语言是无边框平铺（`.sd-group` 注释原文）⇒ 同一面板里多出一个「外来件」。**v4 撤回整套盒式卡**，改用任务列表行的语言：**浅灰底行 + 6px 圆角 + 1px 透明边框占位 + 8/12px 内边距**；控件回归 `nue-button` 默认尺寸（36px）⇒ **30px 例外撤回**（`DESIGN.md` §3）。
- 图源：沿用 Penpot 文件「桌面端」（文件 id `c9598d09-e215-814a-8008-f998c4b203f0`，仅标识、非 URL）· 页 `设置页`；**v3 的 6 张卡式画板作废**，v4 画板清单见 §9（本轮无绘图 MCP 会话 ⇒ BR4 档位 ③ 作图指令，**未实际出图**，见「遗留」）
- 档位：① 结构化文字规格（默认档，成立即交付）+ ③ 分步作图指令（§9 画板清单）· 验收 = 用户本人勾选走查清单（BR2a：本稿 PASS 只覆盖设计产物，不覆盖实现后视觉一致性）；A/B 两方案的「并排看」= 画板 + 现场切一行 CSS（B 只需删 3 条声明），比静态图更真

## 1 信息架构

- 3 层封顶：`设置 › 数据与关于 › 关于与更新`；**不新增第 5 分类**（4 类 IA 与窄屏 4 段是既有契约）。
- 落点：`data-panel.vue` 新增一个 **`.sd-group` 子分组**（桌面端才渲染），形态与「提醒 → 桌面常驻」（`reminder-panel.vue` 的 `data-setting-id="desktop-residency"`）**逐字同构** —— 那是「桌面专属设置」在既有语言里已有的写法，v4 以它为第一参照。组内两行：**R1 版本行**（永不被状态替换：`当前版本 1.20.3` + `检查更新`，答「我在用哪版 / 能不能查」）+ **R2 状态行**（状态机渲染，答「有没有新版 / 在做什么 / 我要做什么」）。
- **R1 与 Web 版本行共用一套 DOM**（`v-if` 只切 handler 与 hint）：AC10「Web 行逐字不变」由此成为结构性保证，而不是靠两段标记对齐。

## 2 流程

- **P1 主路径**（AppImage / Windows）：①`检查更新` → ②检查中（按钮 loading + disabled，≤10s）→ ③有新版本（带体积）→ ④`立即更新` → ⑤下载中（进度，**不阻塞**任务 / 番茄 / 同步）→ ⑥已就绪 `立即重启更新` / `稍后` → ⑦重启 → 本次启动已完成更新。
- **P2 不支持应用内更新**（macOS / Linux deb / 未打包开发态）：⛔ 不发起任何更新器检查（AC4b）⇒ 挂载即 `unsupported`，唯一动作 `打开下载页`；⛔ 无 ②③④、无`立即更新`（AC7）。
- **P3 失败**：任一阶段失败 ⇒ `×` + 可读原因（只来自原因码映射，AC9b）+ **只** `打开下载页`；⛔ **无行内`重试`**（AC4）—— 再试 = 回 R1 点`检查更新`，它**永久可再点**（AC4/5/11），⛔ 不是死路。
- **P4 数据护栏**：仅「已就绪 → 立即重启更新」且同步队列非空（`pendingCount > 0`）⇒ 卡 A（§7）；⛔ 不用 `failedCount` 当触发（内存态、重启清零）。**P5 已就绪期**：R1 检查按钮 disabled + 可见理由（tooltip「重启应用后即可再次检查」），防检查结果覆盖已下载成果。

## 3 视觉规范（v4：任务列表行的语言，不新造盒子）

- **分两组件**：① 组头 = `.sd-group__head` 的既有口径（`<h3 class="sd-group__title">` 20/600 + `<p class="sd-group__desc">` 12/500 次要色），与「桌面常驻」同档；⛔ 不新增标题类（v3 的 `.sd-update__label` 删除）。② 两行 = `.sd-update__list`（`flex column`；`gap: var(--nue-gap-xs)` = 任务列表行距 0.5rem；组头↔首行沿用既有 `margin-bottom: 1rem`）。间距台阶仍单调：行内 4 ＜ 行↔行 8 ＜ 组头↔行 16 ＜ 组↔组 2.75rem。
- **行（`.sd-update__row`）**：新增的类只有四个，全部是组合、⛔ 不含新色板 / 新字号 / 新断点 —— `.sd-update__list`（纯布局）· `.sd-update__row`（行样式，逐条取自任务列表行）· `.sd-update__actions`（动作簇 `flex` + `gap: var(--nue-gap-xs)` + `flex: none`）· `.sd-desktop-status.is-muted`（一档色，§4）。行样式：`background-color: var(--nue-primary-color-100)` · `border: 1px solid transparent`（只为几何稳定与「可切 hover」预留，默认不可见）· `border-radius: var(--nue-primary-radius)`（6px）· `min-height: var(--nue-box-size-md)`（40px，任务行的 `min-height: 40px`）· `padding: var(--nue-padding-xs) calc(var(--nue-padding-sm) - 1px)`（8/12 内边距取任务列表 **`--small` 变体**；减 1px 是边框宽度，使行内文字与 `.sd-group__title` / 既有 `.sd-row__label` **左缘同线**）· 宽度铺满 `.sd-group`。底色 + 6px 圆角 + ≥40px 行高，正是 v3 卡片缺的那口气。
- **行不可点**：⛔ 整行不接管 click、不加 `cursor: pointer`、不加 `tabindex`；hover 反馈只由行内 `nue-button` 原生承担。**默认不加行 hover 描边**（任务行有 `&:hover{border-color: -500}`，但它是可点行）—— 不可点的行给描边 = 假 affordance。若走查时要更强的「块可操作」暗示，加这一行即切换（代价同上，留用户定）。
- **对齐判据（口径沿用 v3，基准换到本层，≤0.5px）**：`.sd-group__title` / 面板既有 `.sd-row__label` / 新块行内 `.sd-row__label` 三者 `getBoundingClientRect().left` 差 ≤0.5px，宽 / 窄两档各测一次（窄屏用 `calc(var(--nue-padding-2xs) - 1px)` 跟档）。⛔ 不写死 px、⛔ 不留第二个边缘。
- **R1**：`.sd-row__text`（`.sd-row__label` 14/`-900` + `.sd-row__hint` 12 + 右 `nue-button theme="secondary"` 36px `检查更新`）—— 与 Web 版本行同构，唯一的差别是 hint 文案与 handler。
- **R2**：行内 `.sd-row__line`（左 `.sd-desktop-status`，右 `.sd-update__actions`（`flex`，`gap: var(--nue-gap-xs)`，`flex: none`））→ 可选 `.sd-row__hint` → 可选 `nue-progress`。**状态符号 + 文字 + 颜色三重冗余**：复用「桌面常驻」的 `.sd-desktop-status` / `__symbol` 家族与 `is-ok` / `is-warn` / `is-error`，新增 `is-muted` 一档（§4），并在 `__symbol` 上补 `min-width: 1em; text-align: center`（消掉 `– … ↑ ✓ ×` 宽度差带来的文字跳动，顺带修好桌面常驻状态的同类跳动）。
- **不跳位（v4 机制三条，全部落在既有类上）**：① 文字恒左对齐、动作恒右对齐 ⇒ 动作宽度变化只影响右侧，**左侧文字永不移位**（⛔ **撤回 v3 的动作区 `min-width`**，它只为卡内居中服务）；② 首行 `.sd-row__line` 既有 `min-height: 2.5rem`（40px）> 按钮 36px ⇒ 九态首行几何恒定，按钮不上下跳；③ hint / 进度条挂在首行**下方、向下生长**，不回头推动首行。唯一会变高的是 R1（首次检查后 hint 出现，一次性、由用户自己触发），⛔ 不设空占位行。
- **进度条**：`<nue-progress :stroke-width="2" hide-text>`（既有组件，先例 `task-details/main/index.vue`），只覆写两个组件变量（轨 `-500` / 填 `-900`，理由见 §4），百分比文字用 `.sd-row__hint` 旁挂（⛔ 不塞进 `aria-live`）。
- **侧栏弱提示 / 卡 A 视觉不变**：齿轮右上 6px 空心环（v3 §3 末段逐字沿用）；卡 A 尺寸与按钮主次沿用 v3 §7。
- **B 方案（备选，仅当 A 在面板里显得「像另一套列表」时启用）**：删掉 `.sd-update__row` 的底色 / 圆角 / 内边距三条声明，退回面板的无底色平铺行，其余不动。代价 = 回到 v3 走查前的观感（组内两行与「同步状态」无异、块感消失），换来与面板零冲突。切换成本 = 3 条 CSS 声明，画板见 `v4/B-*`，**由用户走查时定，⛔ 本稿不替代用户拍**。取舍一句：面板内已有两处 `-100` 底（`.sd-row__action`、`.sd-permission-notice`）⇒「有底色」不是新语言；但「底色 + 圆角 + 铺满」的行块在设置面板是首次，重量确实高于其它行 —— 正当化理由 = 本块是面板内**唯一带动作**的块。

## 4 token（颜色仍全取 `nue-*`，⛔ 不引第二套色板；**有底色行必须整体重算**）

- 行底 `--nue-primary-color-100`（实测基准：light 模式灰 90% = `#e6e6e6`；下例比值均以它为背景，白底值不可复用）。
- **主文字** `-900` **13.94** ✓ ｜ **行内 hint 覆写 `--nue-primary-color-700`**（**6.77** ✓）—— ⛔ 不用 `--nue-secondary-text-color`：`-600` 压 `-100` 自测 **4.60**，仅超线 0.1 且与 `DESIGN.md` §4 记录的 **4.40** 口径打架 ⇒ 一律不当达标值（该 0.2 差异已记入「遗留」）。
- **状态色（文字 + 同色符号）**：`ready`/`up-to-date`/`just-updated` = `success-color-100` **5.29**（**v3 的 `-90` 落灰底只剩 3.97 ✗，必须升一档**）· `available` = `warning-color-90` **5.34** · `failed` = `error-color-90` **7.19** · `idle`/`checking`/`downloading`/`unsupported` = `-700` **6.77**（新增 `.sd-desktop-status.is-muted`，与既有三档同源）。
- **图形 ≥3**：符号同上逐项 ≥5.29 ✓；进度轨 `--nue-primary-color-500` **3.16** ✓（`-200` 只有 **1.29** ≈ 消失）、填 `-900` 与轨互比 **4.41** ✓。
- **按钮**（`nue-button` 默认尺寸 36px = `--nue-box-size-df`）：主 `theme="primary"`（底 `-900` / 字 `-100` = **13.94**）· 次 `theme="secondary"`（底 `-200` / 字 `-800` = **7.87**）。⛔ 本块**不用** `ghost`（hover 底 `-100` 与行底同色 ⇒ 无反馈）、⛔ 不用 `.sd-row__action`（底 `-100` 与行底同色 ⇒ 按钮看不见）。
- 数值口径：WCAG 2.x 相对亮度比，按主题变量公式 `hsl(色相, 饱和度, 亮度)` 换算（brand `hsl(0,0%)` / success `120,70%` / warning `30,80%` / error `10,80%`），light 模式，背景 `#e6e6e6`；暗色由 `--nue-dark-switch` 重算 ⇒ 稿内只写变量名，hex 仅作实测基准。
- 焦点环 `2px --nue-primary-color-900` + 2px offset（在 `-100` 底上 13.94 ✓）；⛔ 禁用 `--nue-link-color`（白底 1.50）。

## 5 状态（`data-update-state` 九态：符号 · 状态文字 · hint（可缺） · 动作）

- **`unsupported`**（AC4b · 前置 gate、独占）：`–` muted ｜ 当前安装方式不支持应用内更新 ｜ hint = `manual.{mac|deb|dev|unknown}`（`degradedReason` 缺省 ⇒ `manual.unknown`，⛔ 不留空行）｜ `打开下载页` primary；R1 `检查更新` 保持可点但**零请求、态与文案不变**（`checkForUpdates` 调用数 = 0）。
- **`idle`**：`–` muted ｜ 还没检查过更新 ｜ hint = 点「检查更新」看看有没有新版本 ｜ 无动作（① 在 R1）
- **`checking`**：`…` muted ｜ 正在检查更新… ｜ **无 hint**（状态文字已说尽，⛔ 不重复）｜ ① loading + disabled
- **`available`**：`↑` warn ｜ 有新版本 1.21.0 ｜ 下载约 108 MB，装好后重启生效（体积未知 ⇒ 省前半句）｜ `立即更新` primary
- **`downloading`**：`…` muted ｜ 正在下载更新… ｜ hint = 已下载 46 MB / 108 MB（总量未知 ⇒ 只给百分比）+ 2px 进度条 ｜ 无动作；① disabled
- **`ready`**：`↓` ok ｜ 更新已就绪 ｜ 重启应用后生效 ｜ `立即重启更新` primary + `稍后` secondary
- **`up-to-date`**：`✓` ok ｜ 已是最新 1.20.3 ｜ **无 hint**（时间在 R1，⛔ 同一信息不在两块重复）｜ 无动作（AC6）
- **`just-updated`**：`✓` ok ｜ 已更新到 1.21.0 ｜ 这是本次启动装好的新版本 ｜ 无动作（AC6）
- **`failed`**：`×` error ｜ 没能检查更新 / 下载没完成 / 更新包校验没通过 ｜ 可读原因（离线 / 超时 / 服务不可用 / 磁盘不足 / 未知兜底），⛔ 不含路径、主机名、环境变量名、`electron-updater` 原文（AC9b）｜ **只** `打开下载页` primary（v3 已定，沿用；⛔ 无行内`重试`，再试走 R1，文案不写「再试一次」）
- **优先级**：`unsupported` ＞ `ready` ＞ `downloading` ＞ `just-updated` ＞ `checking` ＞ `failed` ＞ `available` ＞ `up-to-date` ＞ `idle`；`ready` 期不得被检查结果覆盖（P5）。`data-update-platform-degraded` 保留为派生布尔（= `installMode === 'download-page'`），状态组合不爆炸。
- **`LoadingError` 落点（AC12）**：R2 是**动作状态行**（由按钮驱动、结果恒占位，不替换内容区域）⇒ 仅 `checking` 用 `<loading-error :loading="true">`（`height:auto`），其余走动作级内联 —— 已登记 `DESIGN.md` §4.1「已登记口径」段；⛔ 若将来做成替换式整块内容区，**必须**回 `LoadingError`。

## 6 断点（按面板**可用宽**，非视口；真实对话框 960 − 左栏与边距 ≈ 660–690px）

- **宽 ≥520 / 中 380–520**：行内单行 —— 左文字块 + 右动作，`gap: var(--nue-gap-sm)`；hint 占整行宽、自然换行 ≤2 行，不挤压动作。
- **窄 <380（含 ≤445 窄屏形态）**：`.sd-update__row` 水平内边距切 `calc(var(--nue-padding-2xs) - 1px)`（跟 `.sd-body.is-narrow` 既有档）；`.sd-row__line` 允许换行、`.sd-update__actions { flex-basis: 100%; justify-content: flex-end }` —— 按钮换到文字下方右对齐，**次序与尺寸不变**（主右、次左）。
- ⛔ **撤回 v3 的容器查询三档**：卡已不存在，断点全部承接既有 `is-narrow`，`container-type` 不再需要。

## 7 可用性

- **点击数**：齿轮 → 检查 → 立即更新 → 立即重启 = 4 击（与 PRD 关键路径同源）；`已是最新` 不出现`立即更新`。**反馈时限**：按下 ≤100ms 出 loading；≤1s spinner；>1s 给进度；进度刷新 ≤2 次/秒。
- **⛔ 行不可点**：本块的行不是列表条目，只有按钮可点 —— 不给 hover 描边（默认）/ 不用手型光标 / 不用整行 focus，避免用户「点行没反应」。
- **卡 A（`nue-dialog`，宽 `min(400px, 92vw)`、高度自适应）**：标题「有改动还没同步」→「还有 N 项改动等待同步。」「更新会重启应用，建议先同步完成。」→ `先同步再更新`（primary，默认焦点）｜`仍要更新`（danger）｜`取消`（`ghost` —— 对话框白底上可用，本档不变量不适用于有底色行，见 §4）。未同步队列**跨重启保留**（Dexie `syncQueue` → 冷启动重推）⇒ 软提示口径，⛔ 不出现「失败 / 失败项」字样。**体积与进度**：**显示** —— 下载前必给体积（已知时）、下载中给 `已下载 X% · a / b`，总量未知不得写 MB、⛔ 不显示 0 MB。

## 8 无障碍

- **对比度**：全部按 §4 实测值交付 —— 文字 ≥5.29、图形 ≥3.16、按钮 ≥7.87 ⇒ 全项过 4.5 / 3；⛔ 白底值不得直接搬到 `-100` 底（`success-90` 3.97、`-600` 4.60 即此坑）。
- **键盘 · live 区 · 命中区**：R1 按钮 → R2 主 → R2 次，顺序可达，焦点环 2px + 2px offset（`-900` 在 `-100` 底 13.94 ✓）；卡 A 焦点陷阱 + Esc 与焦点归还；读屏首帧（`loaded=false`）不得播报「已是最新」；`role="status"` + `aria-live="polite"` 只挂**状态文字节点**，百分比走 `progressbar` 的 `aria-valuenow/valuemin/valuemax/valuetext`（无总量 ⇒ `aria-valuetext="正在下载，进度未知"`）；符号 `aria-hidden`（文字已含语义）、与文字**同色同档** ⇒ 去色后仍靠字形 + 文字可辨。命中区：按钮 36px（`--nue-box-size-df`）、行高 ≥40px，**30px 例外作废**（`DESIGN.md` §3 撤回），键盘可达与 `focus-visible` 不降级。

## 9 实现契约 · 坑 · AC · 作图

- **测试钩子**：R2 根 `data-setting-id="update-status"` + `data-update-state="<枚举>"`（含 `unsupported`）+ `data-update-platform-degraded`；R1 `data-setting-id="version"` / `data-setting-action="check-update"`；`DesktopUpdateManualReason` 增 `'dev'`，`resolveInstallMode` **先按 `isPackaged` 判 dev** 再判 mac/deb（v3 增补，沿用）。
- **坑（v4 新增 ②③⑧，其余沿用 v3）**：① 主题无强调色（brand hue 0 + s0 ⇒ 纯灰阶），「有新版本」只能 warning；② **有底色行会作废全部白底实测值** —— 任何新增文字必须先算 `-100` 底比值，`success-90`(3.97) / `-600`(4.60) 是现成反例；③ **有底色行内 `.sd-row__action` 与 `ghost` 都不可用**（底色 / hover 底与行底同为 `-100` ⇒ 元素消失或零反馈），本块按钮只走 `primary` / `secondary`；④ ⛔ 错误原文不外露（AC9b，日志亦不含本机路径）；⑤ `unsupported` 是前置 gate，⛔ 不退化成「`available` 换动作」；⑥ 体积未知不得编 MB；⑦ 百分比不进 `aria-live`；⑧ **⛔ 行不得承接点击**（给 hover 描边等于承诺可点）；⑨ 新加子块先核 §3 对齐判据（v3 走查实报 bug 即此，v4 靠 `calc(...- 1px)` 兜住）；⑩ 块内不另设「主角字号」：组头沿用 `.sd-group__title`（20px）、行文字沿用 `.sd-row__label`（14px），层级靠**档位差 1.43×**；v3 的 15 vs 13 = 1.15× 肉眼无差，是「字号造层级」的失败样本。
- **AC 对照**：AC1 →`available`｜AC2 →`ready` + §7｜AC3 →P1｜AC4 →`failed`（只`打开下载页`，再试走 R1）｜AC4b →`unsupported`（挂载即展示、零请求）｜AC5 →`failed`（校验未过单列）｜AC6 →`up-to-date` 无主按钮｜AC7 →§5 `unsupported`｜AC8 →R1 hint 复用缓存时间、不新增请求｜AC9 →§7｜AC9b →§5 `failed` 原因码映射 + 坑④｜AC10 →R1 与 Web 行共用一套 DOM｜AC11 →P3 + R1 永久可点｜AC12 →§5 `LoadingError` 落点｜AC13 →copy 文件（含 `unsupported` / `manual.dev` / `manual.unknown`）。
- **Penpot 作图清单**（文件「桌面端」/ 页 `设置页`；图层命名 `区块/角色`，颜色一律绑 `nue-*` 同名变量，⛔ 不建第二套色板）：`v4/A-更新块-9态` = 9 张 `720×260`（组头 + 两行）；`v4/A-并排对照` = `1080×420` 三列（更新块 `ready` ｜ 同步状态行 ｜ 本地数据与安全折叠行）；`v4/A-三方对照` = `1080×360` 三行并排（更新块行 ｜ `.nue-div--todo-list-main__row` ｜ `.sd-row`），标注底色 `-100` / 圆角 6 / 行高 40；`v4/B-无底平铺` = 9 张同尺寸（行底透明，其余相同）；`v4/护栏` `520×300`、`v4/rail` 与 `v4/抽屉` `470×300`（沿用 v3 内容）。