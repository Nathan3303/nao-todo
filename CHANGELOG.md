# Changelog

本仓库为私有 monorepo（root `private: true`，内部依赖 `workspace:*`）。版本策略：功能批次 → minor（root 协同版本 + 实际变更包各自语义化 bump）；发布以注解 tag 记录。历史 PRD 明细见 [docs/prds/](docs/prds/)。

## [v1.4.2] - 2026-09-11

发布批次：TASK-02 子任务行布局精简（补丁）。Tag: `v1.4.2` · root `1.4.2` / `@nao-todo/presentation` `0.1.3` / `@nao-todo/desktopapp` `1.4.2`。范围：**仅 web + desktop**（均消费 `@nao-todo/presentation`）；**移动端不动**。明细见归档 PRD（`docs/prds/2026-09-11-subtask-row-layout.md`）+ ADR（`docs/adr/2026-09-11-task-02-subtask-row-layout.md`）。

### Changed（行为变更）

- **子任务行布局（TASK-02）**：开始/结束时间由第二行 meta **移至名称末尾内联**；**脱离父任务**按钮由独立操作列**移至名称末尾**，该列整体移除。布局判据 = **α + 时间相对上限**：时间 `flex: 0 0 auto`（宽度随内容、**不收缩**）+ `max-width`（默认 `60%`，CSS 变量 `--subtask-row-time-max-width` 可调）+ 省略号；名称 `flex: 1 1 auto; min-width: 0` ⇒ **空间不足时名称先被省略号截断、时间保持完整**；时间被截断时**全文由 `title` 提供**。
- **子任务改名入口收敛**：行内改名唯一入口（编辑按钮）移除后，**改名唯一入口 = 点击名称进入该子任务详情页标题**（`task-details/main/index.vue` 标题 textarea → `updateTaskDetails`）⇒ **能力不丢**。点击导航**仅挂在名称元素**：点击时间、点击脱离按钮**均不触发**详情导航。
- 描述**仍居第二行**（无描述则不渲染该行）；时间内联后 `metaText()` 的“时间 ~ 描述”拼接**死分支**一并清理。**不新增可见文案**（i18n 三文件未动）。

### Removed（移除）

- 子任务行内改名机制整体删除：编辑按钮 + 编辑输入框 + 编辑态 check/clear 按钮 + `data-editing` 属性 + 仅其使用的 CSS（`editingId`/`editingName`/`startEditName`/`submitEditName`/`cancelEditName`）。**`TaskHandler.updateTaskName` 保持零调用**（登记死代码，不在本单删）。

### 质量门槛

- `vp test run` **55 文件 / 495 例全绿**（本单 +1 文件 +6 例；TASK-01 既有 489 例**无回归**）；`vp check --no-fmt` **1004 文件 0 错 0 警**；提交前后各跑一次一致。
- 实机冒烟（Electron/CDP，`scripts/electron-smoke --feature task-02`）：**AC①…⑧ + 追加 A/B 全 PASS（PASS 34 / FAIL 0 / SKIP 0）**。关键实测：AC③ 时间截断 `181px ≤ 上限 183.2px`（占行宽 59.9%）；整行 `scrollWidth == clientWidth`（**无横向溢出**）；脱离按钮 `width=14 > 0` 且**未被裁掉**；`opacity` hover/focus 单帧 `0 → 1`（**无 transition**）。
- **TASK-01 冒烟回归**（`--feature task-01`，同文件被改）：case1–case4 + case1recheck **0 FAIL**。
- 提交：`2f04ec93`（实现）→ 发布提交（版本协同 + CHANGELOG）。

### 已知遗留（非阻断）

- **跳端不一致（C-R1；用户明确“移动端不动”）**：移动端子任务行 = `checkbox + 名称 + 删除(✕)`，**无时间展示 / 无行内改名 / 无脱离父任务**；web/desktop 端**无删除** ⇒ 两端**动作集不相交**。文档与验收**不得声称两端一致**；跨端收敛另立单。
- **名称截断事实口径**：详情抽屉内容宽固定 ~404px，内联时间约占 218px ⇒ **名称可用 ≈138px ≈ 10 个中文字**后省略号。用户已确认**保持 60%**（降上限会切掉尾部「截止 <时间>」= 本域锚点）；若要给名称腾空间 ⇒ “**压缩时间文案**”另单。
- `common.edit` 词典键三处定义**保留**（移除按钮后零引用属**预期**，**不得**当死键清理）。
- 时间整体截断**可能切在 `~` 中间**（预期；不拆分分段 `span`）。
- **`DEF-STORE-01`（观察项，暂不定级）**：任务实体在两 store 各存一份（`TasksStore.tasks` ↔ `TaskDetailsStore.tasks`，两个独立 `useMapperStoreBase` Map、无跨 store 同步）；且**两副本同 id 同时在场是必然**（`TaskUseCase.get` 末尾 `addTask` 写列表 store；子任务列表由 `subTaskUseCase` 写详情 store）⇒ 任一侧后续写入会让另一侧陈旧。但“用户可见的陈旧”**属未复现而非否定**：探针差异 0/10 的**前置条件未满足**（未断言两副本同 id 同时在场、且那轮未产生写入）⇒ **保持观察**；复现且该行曾被渲染出陈旧值 ⇒ P1。
- 其余沿用 v1.4.1/v1.4.0 已登记遗留（`DEF-SYNC-04` 服务端 `startAt` 覆盖、错误文案 i18n、离线写入边界、fmt 基线、nue-ui 双版本等）。

[v1.4.2]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.2

## [v1.4.1] - 2026-09-10

发布批次：TASK-01 子任务创建继承父任务清单与时间窗（补丁）。Tag: `v1.4.1` · root `1.4.1` / `@nao-todo/presentation` `0.1.2` / `@nao-todo/desktopapp` `1.4.1`。明细见归档 PRD（`docs/prds/`）+ ADR（`docs/adr/2026-09-10-task-01-subtask-inherit.md`）。

### Added（新增功能）

- **子任务继承父任务参数（TASK-01）**：任务详情页「添加子任务」创建时，新增继承父任务的**清单**（`projectId`）与**时间窗**（`startAt`/`endAt`）。规则 = **以 `endAt` 为锚的快照拷贝**：两者皆有效且 `start ≤ end` ⇒ 逐字拷贝两者；仅 `endAt` ⇒ 拷贝 `endAt` 且 `startAt=null`；`endAt` 缺失/无效 ⇒ 均**未安排**；`startAt` 缺失/无效/倒置 ⇒ 仅 `startAt=null`（**保留有效 `endAt`**）；`projectId` 原样拷贝（`''`/`null` 均＝收集箱）。新增**模块内**纯函数 `resolveSubTaskDraft`（单一实现；**不经包公开面导出** ⇒ 仍属 patch 变更）+ 5 例单测（U1–U5）。

### Changed（行为变更）

- **父任务未排期时，新建子任务不再默认落在「今天」**，而是**未安排**（此前硬编码 `endAt = 当天`）。注：子任务数据结构性隔离（写 `taskDetailsStore`，与日历/任务视图读的 `tasksStore` 分离）⇒ **不进日历、不进未安排桶、不影响计数**。
- 继承为**创建时快照**：父任务之后改清单/时间窗**不回写**已存在子任务（禁级联）。

### 质量门槛

- `vp test run` **54 文件 / 489 例全绿**（本单 +5 例）；`vp check --no-fmt` **1003 文件 0 错 0 警**；提交前后各跑一次结果一致。
- 提交：`5117cc48`（功能）→ 发布提交（版本协同 + CHANGELOG）。

### 已知遗留（非阻断）

- **跳端不一致（D7-a=B，用户裁决）**：移动端 `packages/presentation-react/src/logic/compose-task-usecase.ts:129` 的同源 `createSubTask` **未同步修** ⇒ 手机端新建子任务仍为「收集箱 + 当天」。**故本次不触发移动端发版**（`presentation-react` 不在本版版本表内属**有意**：`apps/mobile` 依赖的正是该包、不含 `presentation`）。升级判据 B-5（同类硬编码第二次回归）已命中 ⇒ 下一次触碰“子任务创建默认值”应直接升级为 application 层默认解析，不再逐端修。
- 存量数据**不回填**：同一父任务下新旧子任务可并存（旧为“今天”、新可能“未安排”），**不得当缺陷报**。
- 本单**不新增**子任务行内的日期编辑 UI（未安排子任务仍可进详情页设日期）。
- 待清理死代码登记（另立清理批次）：`CreateTaskValueObject.fillStartAt()`（`create-task.ts:98`，零调用点）、`taskDetailsStore.taskDetails/setTaskDetails`（零调用点）、`LocalUserRepoImpl`。
- 其余沿用 v1.4.0 已登记遗留（错误文案 i18n、离线写入边界、fmt 基线、nue-ui 双版本等）。

[v1.4.1]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.1

## [v1.4.0] - 2026-09-10

发布批次：SHELL-02 桌面端同步状态并入侧栏轨道 + SHELL-03 离线可用性（离线白屏 / 门壳终态完备 / 同步状态运行级语义 / 离线进入路由与守卫 / 离线身份呈现）。Tag: `v1.4.0` · root `1.4.0` / `@nao-todo/shared` `1.2.0` / `@nao-todo/infrastructure` `0.2.0` / `@nao-todo/domain-identity` `1.1.0` / `@nao-todo/presentation-identity` `1.1.0` / `@nao-todo/desktopapp` `1.4.0`。

> 两单同日交付且交叉依赖已闭合（SHELL-02 的失败可见性依赖 SHELL-03 的运行级语义；SHELL-03 的离线壳依赖 SHELL-02 的轨道注入点），故合并为一个发布批次。明细见 [docs/prds/2026-09-10-desktop-sync-status-rail-merge.md](docs/prds/2026-09-10-desktop-sync-status-rail-merge.md) 与 [docs/prds/2026-09-10-shell-03-offline-availability.md](docs/prds/2026-09-10-shell-03-offline-availability.md)，约束与决策见 [docs/adr/](docs/adr/)。

### Added（新增功能）

- **轨道同步入口（SHELL-02）**：同步状态由「视口左下角悬浮层」改为「主侧栏 70px 轨道底部、齿轮上方」的常驻按钮（`NueTooltip` 标签 + `NueDropdown` 面板 + `NueButton` 立即同步），面板含上次同步时间 / 待推送 / 失败 / 错误摘要（2 行截断 + `title` 全文）；附 `aria-label`、`aria-expanded` 与常驻读屏活动区域（只播摘要，不播错误全文）；中英三处新增 `sync.*` 7 键。
- **离线身份呈现（SHELL-03）**：本地缓存**昵称**（白名单 `{userId, nickname, cachedAt}`，明文 localStorage、无 TTL、失败静默、解锁前可读）→ 首字母头像（复用 `NueAvatar` 的 `default` slot + 确定性哈希色块映主题令牌）+ 离线标识；新增 `@nao-todo/presentation-identity` 的 `UserInitialAvatar` 组件与 `identity.*` / `gate.*` 4 键。
- **桌面端实机测试基建**：`scripts/electron-smoke/`（CDP 驱动真实 Electron、零第三方依赖、凭据只走环境变量；含 `checks/` 断言脚本、`lib/` 驱动、人工对照单）。

### Fixed（缺陷修复）

- **设置齿轮被同步浮层遮挡（SHELL-02）**：浮层 `position:fixed; left:1rem; bottom:1rem` 与轨道底部齿轮同水平带，指针路径 100% 不可点。修复 = 归位到侧栏轨道布局。
- **`z-index:9999` 压模态（SHELL-02，连带）**：该值越过 Nue 弹层池基线 99，导致设置对话框开启时浮层仍浮在遮罩之上且可点。修复 = 移除该 z-index，面板改由弹层池承载。
- **离线冷启动白屏（SHELL-03 / DEF-OFFLINE-01）**：`unlock-gate.vue` 模板仅 `v-if checking / v-else-if profile` 两分支且 `profile` 仅内存（离线必缺失）、`loadUserProfile()` 返回元组不抛错（原 `try/catch` 永不触发）⇒ 渲染空。修复 = 显式终态机（`checking`/`ready`/`error` + `v-else` 兜底）+ 就绪判据只用本地事实（JWT / 密钥包 / 本地库）+ profile 降级为装饰。
- **拉取阶段失败被同一次运行清空（SHELL-03 / DEF-SYNC-01）**：`markSyncing()` 在两阶段开端均 `set({lastError:null})` ⇒ 面板失败态永不出现。修复 = 同步状态引入运行边界（`beginRun`/`noteRunError`/`endRun`）。
- **队列项全超限时假成功 + `syncing` 永久 true（SHELL-03 / DEF-SYNC-02）**：`pushBody`/`deletions` 皆空时直接 `return` 不结算；且未确认实体仅 `console.warn`。修复 = 所有入口 `try/finally` 必达结算 + 失败/超限/未确认计入运行错误。
- **`lastSyncAt` 失败也推进（SHELL-03 / DEF-SYNC-03）**：`markSynced()` 无条件写时间戳。修复 = 仅无错运行推进（面板「上次同步」在失败运行后不再刷新，属**修正**）。
- **「离线进入」落登录页死路（SHELL-03 / DEF-01）**：离线时 auth 守卫把「有 JWT 但未认证」强制推入检入页，检入离线必败又 `replace('/auth/signin')` ⇒ 壳不可达。修复 = 跳转唯一点归 `AppRoot`（先 `await replace` 再挂载）+ 守卫**四条件**本地事实放行 + 会话级内存 flag + 检入失败分类（网络类不再跳登录页、改页内可重试）。
- **损坏的昵称缓存未清键（SHELL-03 / DEF-02）**：解析/形状失败时直接 `return`，脏键长期留存（与 C-16 文档约定不符）。修复 = `removeItem` 后返回 null。
- **`LoadingError` 潜在空渲染（SHELL-03 / F-5）**：末支 `<slot v-else />` 在调用方未提供 default slot 时渲染空。修复 = 加安全兜底（最小空态占位）。
- **壳耦合：轨道被 `profile` 门住（SHELL-03 / F-6）**：`aside-v2.vue` 的 `v-if="profile"` 使导航/齿轮/同步入口在离线时全部消失。修复 = 轨道常驻 + 身份区仅作装饰降级（含抽屉分支）。
- **凭证类失败不得授予离线进入（SHELL-03 / 安全）**：避免用无效凭证进壳；凭证类失败时「离线进入」隐藏。

### Changed（行为与口径变更）

- 同步状态语义：`lastError` = 本次运行**首个错误阶段**的错误（仅新运行清空）；新增 `errors[]` / `errorCount`；删 `markSyncing()`；`start()`/`manualSync()`/`pullAll()`/`pushAll()` 返回 `SyncRunResult`；初始同步门改以返回值判成败。
- 门/壳就绪判据分层：网络装饰数据（profile/config）**不得**作为就绪或渲染条件；缺失用占位。
- auth 守卫新增四条件离线放行（flag + JWT 用户一致 + 本地会话一致 + 本地已解锁）；**未**使用 `navigator.onLine`、**未**使用昵称缓存；在线且凭证无效仍走 signin/checkin。
- 检入页失败分类：网络类不再跳 `signin`（页内可重试，含「重试」+「重新登录」）；凭证类保持跳 `signin`。
- 初始同步门失败态三键：「重试」+「离线进入」+「登出/重新登录」（会话失效时主按钮文案切「重新登录」）。
- `AppRoot` 的 `initialSynced` 更名 `gatePassed`（语义 = 门已通过，含离线进入）。
- 新增用户可见文案一律 i18n；**存量**硬编码中文（解锁/登出/重试等）本轮不动（登记遗留）。

### 质量门槛

- `vp test run` **53 文件 / 484 例全绿**（本批新增 58 例）；`vp check --no-fmt` **1000 文件 0 错 0 警**；`webapp` / `desktopapp` 构建通过；`guard:ddd` OK。
- QA 实机（Electron 43.4.1 / Chromium 150，CDP 真实命中 + 内嵌证据）：**SHELL-02 PASS 51 / FAIL 0**；**SHELL-03 复跑 PASS 17 / FAIL 0 / SKIP 0**（BC-6 采单测口径，登记为验证方法选择）；测试前后 hash 逐条一致（无不明写入）。
- 冻结基线：SHELL-02 6 文件 / SHELL-03 最终 41 文件 hash 见两份 PRD 归档。

### 已知遗留（非阻断）

- 错误文案 i18n（infrastructure 内硬编码中文，如「拉取失败：网络错误」）与「等 N 项」计数文案。
- 离线**写入**完整口径（本地写上限、超限暂停提示、回在线批量回传可见性）；`retryCount` 无重置路径 ⇒ 永久超限设备每次冷启动停在 failed（可「离线进入」）。
- 离线专属常驻 UI（顶栏/图标「离线」标识）；`apps/mobile` 同类壳耦合未扫。
- 昵称缓存白名单之外的字段（**头像图片/邮箱**）若需缓存须**重新评审**（ADR 明载：白名单扩展即「有条件可行」结论失效）。
- `isCredentialFailure` 依赖错误文案匹配（现由文案集固定保证）；更稳做法是 `SyncRunResult` 增显式标记。
- `LocalUserRepoImpl` 疑似死代码；`NueAside` 的 `v-model:displayed` 为惰性写法；nue-ui 双版本并存（web 1.11.0 / desktop 1.10.58）；全仓 oxfmt 基线漂移（v1.3.0 已记 860 文件，本批 846）。
- QA 本地 dev 账号 `probe@x.local`（后端无 DELETE 用户端点）与昵称 `QA-Shell03`，登记待清理。

## [v1.3.3] - 2026-09-09

发布批次：SHELL-01-DEF-01 生产缺陷修复。Tag: `v1.3.3` · 修复提交 `5bc18ecd` · root `1.3.3` / `@nao-todo/presentation-identity` `1.0.1` / `@nao-todo/presentation` `0.1.1`。

### Fixed（缺陷修复）

- **设置对话框切「修改密码」致背景任务列表置空（SHELL-01-DEF-01）**：浏览器凭据自动填充把已保存账号邮箱写入任务名筛选框 → `GET /tasks?name=<邮箱>` 空返回 → 列表空态。修复 = 双保险：改密表单三密码输入标注 `autocomplete=current-password/new-password`（源侧隔离，浏览器不再视其为登录表单）+ 任务名筛选框内层 input `autocomplete="off"`（受害字段屏蔽，一处覆盖 全部/项目/标签 三视图）；附组件级回归单测 5 断言。

### 质量门槛

- vp test 42 文件 / 419 例全绿（含新增 5）；lint 0 错；webapp 生产构建通过（terser）。
- 真实浏览器自动填充路径 headless 无法触发，由新增单测覆盖（符合「仅生产复现则以断言覆盖」条款）；生产实机复验以用户指示发布为终签。

### 已知遗留（非阻断）

- 个别浏览器密码管理器对 `autocomplete="off"` 的 username 填充可能不完全尊重——备用方案（筛选框失焦/弹层关闭清空 name 过滤）待业务语义拍板。
- 日历/搜索页等同类型无 autocomplete 文本输入的全站排查建议单独立项（SHELL-01 齿轮全站可用）。

## [v1.3.0] - 2026-09-07

发布批次：日历排期效率 / 导航体验 / 番茄专注徽标三线（`v1.2.0..v1.3.0` 共 13 提交）。Tag: `v1.3.0` · Release commit: `a945a06c` · root `1.3.0` / `@nao-todo/shared` `1.1.0`。

### Added（新增功能）

- **日历排期效率三件套（CAL-07）**：未安排任务批量安排（多选模式 / 今天 / 明天 / 选择日期，部分失败保留选中可重试）；任务条快速改期菜单（右键 + 悬停三点：今天 / 明天 / 下周同日 / 选择日期…）；拖拽排期（未安排行拖出即安排、已排期任务条拖拽 = T1 整体平移改期，5px 阈值消歧点击）；共享改期内核 `reschedule.ts`（T1 平移语义）+ U2「最近一次操作撤销」action-toast。
- **日历导航体验（CAL-08）**：键盘导航（`←/→` 翻页、`T` 今天、`M/W` 切视图、`Enter` 开当日面板、`N` 格内快建；弹层开启 7 键全抑制；输入框守卫；n/p 遮蔽与回退）；标题点击年-月面板跳转（月视图定位 / 周视图落含 1 号周，weekStart 边界）。
- **番茄专注徽标（CAL-09）**：月格 / 周列头显示当日完成番茄轮数（type=1 按 startAt 落日，0 隐藏、99+ cap，含孤儿记录）；侧栏「专注徽标」开关（默认开、localStorage 持久化、off 停拉）。

### Fixed（缺陷修复）

- done 行单行「安排到…」守卫越权变更恢复 B7（单条含 done 可历史回填；仅批量/多选排除 done）。
- 抽屉内「安排到…」菜单外点 / 再点触发器不关闭（外点豁免收窄至 .rmenu / 触发器 / 展开的日期面板）。
- 专注徽标"请求有、徽标无"集成缺陷（store.records 为 Map 被强转数组迭代 → `toTimerRecordList` 归一 + Map 形态集成回归测试）。
- 逾期任务条呈现改版：背景 `error-10`（hover/focus → `error-20`）+ 左缘条仅随优先级（用户两轮裁决定稿）。

### Changed（行为/口径变更）

- `deferToToday`（当日面板"延期到今天"）归入 T1 内核：带 startAt 逾期任务整窗平移至今天（原仅改 endAt 会拉长跨度）。
- 全局 `n`（新建任务）/`p`（新建项目）命令绑定 `index-view` scope（五子 tab 均覆盖，auth 页 inert，无用户可见回归）。
- `@nao-todo/shared`：`Command.available` 上下文新增可选 `event`（供 Enter 等目标守卫判定）。

### 质量门槛

- vitest 39 文件 / 410 用例全绿（含 41+ 组件/集成断言）；vp check 0 错 0 警；webapp / desktopapp 构建通过。
- QA 独立验收（A 线 63 条 / C 线 27 条 / B 线 22 条用例）+ 用户 dev / 桌面（Electron 同源）双端终签冒烟。

### 已知遗留（P3，非阻断）

- `calendar.arrange_*` / `nav_shortcut` / `focus_badge_impression` 埋点口径已定义、落地待基建批次。
- pomodoro records store 跨区间累积不清理（建议 eviction）。
- `?`（快捷键帮助）/ `⌘K`（命令面板）全局实装后需对 C1 键位冲突复测。
- oxfmt 全仓 860 文件格式漂移（存量，另立清理批次）。

[v1.3.0]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.3.0
[v1.3.3]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.3.3
[v1.4.0]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.0