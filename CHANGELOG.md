# Changelog

本仓库为私有 monorepo（root `private: true`，内部依赖 `workspace:*`）。版本策略：功能批次 → minor（root 协同版本 + 实际变更包各自语义化 bump）；发布以注解 tag 记录。历史 PRD 明细见 [docs/prds/](docs/prds/)。

## [v1.7.6] - 2026-09-20

发布批次：日历界面 UI 优化（TASK-11 ①③ + 触发器改截止时间修订 + ② 还原）+ 用户样式微调（patch）。**Tag `v1.7.6`** · root `1.7.6` / `@nao-todo/desktopapp` `1.7.6` / `@nao-todo/webapp` `1.7.6`（`@nao-todo/presentation` `0.4.4` / `@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（日历 UI）。

### 优化（日历）

- **格子头部两端对齐（TASK-11 ①）**：`.cal-cell-top` / `.wk-cell-top` 撑满格宽 `justify-content: space-between`，日期号靠左、专注角标靠右（无角标时数字仍靠左，列对齐一致）。
- **任务条末尾触发器改显示截止时间（TASK-11 ③ 修订）**：有截止时刻（`showTime` 且 `endAt` 合法）时触发器显示 `HH:mm`（常显），点击仍弹改期下拉；否则回退 `more-vertical` 三点图标（悬停出现，单击仍可改期）；触发器 hover 沿用底色提示；时间/图标共用 `.cal-item-more`，拖拽跳过统一。
- **段末截止时刻（TASK-11 ③）**：任务条时刻内容由 `startAt` 改为 `endAt` 并移至名称末尾；月/周视图可见性判定由「真起始段」改为「真末段」，抽为共享纯函数模块 `segment-time.ts`（可单测）。
- **任务条名称文字抬升（用户调整，`7b5c87f4`）**：`.cal-lanes` 内嵌套 `.cal-item-text { z-index: 3 }`，名称文字高于网格分隔线；仅名称，条背景/色条/触发器仍在网格线下方。

### 还原

- **任务条整条抬升撤销（TASK-11 ②，`c36167e0`）**：任务条整条抬升至网格线之上的尝试经用户实测效果不佳，已撤销；网格分隔线回到任务条上方（TASK-07 状态）。

### 其他（Chore）

- 测试同步：新增 `segment-time.test.ts`（7 例）+ `task-bar.test.ts` 触发器/段末时刻断言（全量 81 文件 / 703 例）。

### 质量门槛

- `vp check`：目标文件 pass（fmt / lint / type）。
- `vp test`：81 文件 / 703 例全绿。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓。

[v1.7.6]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.6

## [v1.7.5] - 2026-09-15

发布批次：日历模块结构 / 视图 UI / 排序下拉 / 标题年月跳转与改期菜单（NueDropdown 化）+ 任务详情子任务节点 UI + 用户样式微调（patch）。**Tag `v1.7.5`** · root `1.7.5` / `@nao-todo/desktopapp` `1.7.5` / `@nao-todo/webapp` `1.7.5`（`@nao-todo/presentation` `0.4.4` / `@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（日历 + 任务详情 UI）。

### 优化 / 重构（日历）

- **结构优化（T6）**：月/周共享样式归并至 `calendar-grid.css`（净减 227 行）；`useCalendarGrid` / `useMonthJump` 抽取为共享 composable；god-composable 拆分（538 → 312 行，`useCalendarTaskQuery` / `useCalendarSchedule`）；周视图 33 个 props 收敛为 provide/inject 上下文；每格派生数据预计算（42 格 × 模板重复调用 → 每格一次）；拖拽卸载清理；死码清理 + 空态工厂（O6）；无障碍语义（`gridcell` / role / `aria-pressed`）。
- **视图 UI（T9，含用户微调）**：网格分隔线覆盖层（线在任务条上方 + 降亮度）；N+ 文本颜色增强对比；任务条行高 16 → 20px（`GRID_ITEM_STEP` 同步 22）；跨周续接圆点移除（数据语义保留）；整格点击不再开当日抽屉（仅 N+ 触发）；用户后续微调末列分隔线渐变修复（`9bcd9272` / `0c0047e0`）。
- **排序下拉（TASK-08，`4eb78a4f` / `726ecee3`）**：月/周视图头部新增排序下拉（优先级 / 开始时间 / 截止时间 / 创建时间 + 升降序），未选字段默认按名称升序（`localeCompare`）；独立 localStorage 键 `naotodo.calendar.sort` 持久化、双视图共享；仅影响日历展示顺序，不回写服务端、不改 `sortId`（拖拽改期仅改日期）。
- **中间标题年月跳转改 NueDropdown（TASK-09，`d6e8b77e` / `4ed8e3fc`）**：废弃手写弹层 `month-jump-panel.vue`（-214 行），新增 `calendar-month-grid.vue` 经 NueDropdown `execute` 委托；开合 / 定位 / Esc / 外点由 NueDropdown 内建；月跳月 / 周落周语义不变。
- **任务条右键菜单移除 + 改期菜单改 NueDropdown（TASK-10，`3350404f` / `cc175949`）**：任务条右键完全禁用（`@contextmenu.prevent`，阻止原生菜单 + 无响应）；`reschedule-menu.vue` 内部改 NueDropdown（任务条三点 + 抽屉「安排到…」统一触发器插槽，同 group 互斥），「选择日期…」保留内嵌 `NueDatePicker`；键盘弹层抑制谓词同步（移除常驻 `.rmenu` 判定，改由 NueDropdown 容器 / popup-pool 覆盖）。
- **测试整理（TASK-14，`1be3c939`）**：19 个 calendar 测试文件统一移入 `monthly/__tests__/`（纯路径变更，用例数不变）。

### Added（新增）

- **任务详情子任务节点 UI（TASK-06，`a250cd96` / `3cc7ada2`）**：移除「脱离父任务」按钮；时间与描述合并单行（`·` 分隔，`clamped=2`）；名称行右侧新增检查项 / 子任务数量徽标（>0 渲染）。

### 其他（Chore）

- 用户样式 / 图标调整（iconfont 重新生成，新增 `icon-ntd-disconnect`，移除未引用图标）。

### Changed

- 版本协同 bump（patch）：root / `@nao-todo/desktopapp` / `@nao-todo/webapp` `1.7.4 → 1.7.5`；`@nao-todo/presentation` `0.4.3 → 0.4.4`（T7 / TASK-06 改动 `subtasks.vue`，沿 v1.7.1 先例）。其余包不动（i18n 文案新增不触发 bump，沿 v1.7.3 先例）；无公开 API 导出面破坏。

### 质量门槛

- `vp check`：目标文件 pass（fmt / lint / type）。
- `vp test`：80 文件 / 691 例全绿（含日历排序 / 年月跳转 / 改期菜单 NueDropdown 迁移与 19 文件 `__tests__/` 迁移）。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓。

[v1.7.5]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.5

## [v1.7.4] - 2026-09-14

发布批次：子任务行标签栏 flex 压缩修复 + oxfmt 全仓归一化 + .agents 目录重组（patch）。**Tag `v1.7.4`** · root `1.7.4` / `@nao-todo/desktopapp` `1.7.4` / `@nao-todo/webapp` `1.7.4`（`@nao-todo/presentation` `0.4.3` / `@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（presentation 子任务行样式）+ 全仓工程（oxfmt 归一化 / .agents）。

### Fixed（修复）

- **子任务行标签栏 flex 压缩修复（`b0db5d6`，用户手动修复）**：`.subtask-row__title-line` `gap` `xs → 2xs` + `flex-wrap: nowrap`；`.subtask-row__tags` `flex 0 1 auto → 0 0 auto` + `nowrap`，移除 `max-width: 55%` 上限——修复长标签把名称挤没 / 标签栏被压缩的布局问题。

### Chore（工程）

- **oxfmt 全仓归一化（`764044c`）**：829 文件（ts / vue / css / json / md）统一 oxfmt 规范，含换行符对齐 `.editorconfig`（CRLF）；`git diff -w` 验证纯格式零语义变更。
- **.agents 目录重组（`4b7eae3`）**：prompts / common / scripts / skills 重构与技能包拆分，删除旧命令 / 技能。

### Changed

- 版本协同 bump（patch）：root / `@nao-todo/desktopapp` / `@nao-todo/webapp` `1.7.3 → 1.7.4`；`@nao-todo/presentation` `0.4.2 → 0.4.3`（subtasks.vue 真实样式修复，沿 v1.7.1 先例）。其余包不动（oxfmt 纯格式零语义，不触发语义 bump）；无公开 API 导出面破坏。

### 质量门槛

- `vp check`：1219 文件格式全对 + 1045 文件无 lint / type 错误。
- `vp test`：73 文件 / 645 例全绿（含 `subtasks.test.ts` 14/14）。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓。

[v1.7.4]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.4

## [v1.7.3] - 2026-09-14

发布批次：设置-应用设置新增版本号显示（patch；webapp 首次纳入版本协同）。**Tag `v1.7.3`** · root `1.7.3` / `@nao-todo/desktopapp` `1.7.3` / `@nao-todo/webapp` `1.7.3`（新增 version 字段，首次纳入协同；`@nao-todo/presentation` `0.4.2` / `@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` 不动）。范围：web + desktop（设置页 UI + 构建配置）。

### Added（新增）

- **设置-应用设置版本号显示**：底部（语言 / 主题之后）新增只读版本号行（i18n `settings.version`，zh-CN / en-US / types 同步）。版本号**双端区分**：vite `define` 构建期从各自 package.json 注入 `import.meta.env.VITE_APP_VERSION`——Web 显示 `@nao-todo/webapp` 版本、Desktop 显示 `@nao-todo/desktopapp` 版本（desktop 复用 web 源码，经构建期注入区分）。
- **webapp 首次纳入版本协同**：`apps/web/package.json` 新增 `version: 1.7.3`（此前无此字段）。

### Changed

- 版本协同 bump（patch）：root / `@nao-todo/desktopapp` `1.7.2 → 1.7.3`；`@nao-todo/webapp` `1.7.3`（新增）。其余包不动；无公开 API 导出面破坏。

### 质量门槛

- `vp test`：73 文件 / 645 例全绿。
- `vp check`：目标文件 pass（fmt / lint / type）。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓；产物核验：web 注入 `1.7.3`、desktop 注入桌面端版本（bump 前实测 `1.7.2`，bump 后 `1.7.3`）。

[v1.7.3]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.3

## [v1.7.2] - 2026-09-14

发布批次：桌面端同步状态栏 UI 重构 + 日历月/周边距微调（patch）。**Tag `v1.7.2`** · root `1.7.2` / `@nao-todo/desktopapp` `1.7.2`（`@nao-todo/presentation` `0.4.2` / `@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` 不动；webapp 无 version 不参与）。范围：web + desktop（renderer UI 层）。

### Fixed（修复 / 重构）

- **桌面端同步状态栏 UI 重构**：面板结构 nue-text 化（li 行改直挂面板根）、`placement` 调整 `right-center → top-start`、新图标 `ntd-sync2`、footer 动作按钮去包装；内容可见性改由库 `data-visible` 控制（移除组件级 @close 卸载）。
- **日历月 / 周边距微调**（`apps/web/src/components/calendar/monthly|weekly/index.vue`）；新增 iconfont 图标（`iconfont.css` / `.woff2`）。
- **测试同步**（`sync-status-bar.test.ts`）：选择器对齐新结构（`.sync-panel__row` / `.sync-panel__footer` / `.sync-panel__error` → 面板根 / 按钮 / title 全文定位），行为断言全部保留（三态文案 / 错误 title 全文+无子元素 / 焦点归还 / live summary / 无障碍）。

### Changed

- 版本协同 bump（patch）：root / `@nao-todo/desktopapp` `1.7.1 → 1.7.2`。其余包不动；无公开 API 导出面破坏。

### 质量门槛

- `vp test`：**73 文件 / 645 例全绿**（含 `sync-status-bar.test.ts` 4/4，原 2 failed 已同步修复）。
- `vp check`：目标文件 pass（fmt / lint / type）。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓。

[v1.7.2]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.2

## [v1.7.1] - 2026-09-14

发布批次：TASK-04 详情面板子任务行标签展示（patch）。**Tag `v1.7.1`** · root `1.7.1` / `@nao-todo/desktopapp` `1.7.1` / `@nao-todo/presentation` `0.4.2`（`@nao-todo/shared` `1.3.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/domain-task` `1.2.0` / `@nao-todo/domain-project` `1.1.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（presentation 层）。设计记录：PRD `docs/prds/2026-09-14-task-details-subtask-tags.md`。

### Added（新增）

- **详情面板子任务行标签展示（TASK-04；`d3c5e5cc`）**：名称右侧原时间内联位改挂**只读 small 标签栏**（`clamped=2` 溢出 +N，标签池复用详情上下文，空标签不渲染）；时间下移为名称下、描述上**独立行**（文案 / 拼接规则不变，无时间不渲染）；脱离按钮 hover / focus-within 展示语义锁定；`.subtask-row__tags` 收缩上限防长标签挤没名称。

### Changed

- 版本协同 bump（patch）：root / `@nao-todo/desktopapp` `1.7.0 → 1.7.1`；`@nao-todo/presentation` `0.4.1 → 0.4.2`（TASK-04 展示增强，patch）。无公开 API 导出面破坏；移动端红线 `@nao-todo/presentation-react` 零改动。

### 质量门槛

- `vp test`：TASK-04 目标 14/14 绿（全仓 643/645，2 失败为既有 sync-status-bar 工作树状态，与本次零交集）。
- `vp check`：目标文件 pass（fmt / lint / type）。
- `pnpm webapp build` ✓ / `pnpm desktopapp build` ✓。

[v1.7.1]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.1

## [v1.7.0] - 2026-09-13

发布批次：设置分栏 / 搜索增强 / 离线边界加固 / 离线写入与自动回传 协同收尾。**Tag `v1.7.0` 待 PM 放行后打** · **前置：服务端 `5c0b25d3`（SYNC-DEF-01）已部署** · root `1.7.0` / `@nao-todo/desktopapp` `1.7.0` / `@nao-todo/infrastructure` `0.5.0` / `@nao-todo/presentation-identity` `1.2.0` / `@nao-todo/presentation` `0.4.1` / `@nao-todo/shared` `1.3.0`（`@nao-todo/domain-task` `1.2.0` / `@nao-todo/domain-project` `1.1.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（views / presentation / presentation-identity / shared / infrastructure 层）。设计记录：PRD `docs/prds/2026-09-13-shell-05-offline-boundary-hardening.md`、`docs/prds/2026-09-13-shell-06-offline-backfill.md`；ADR `docs/adr/2026-09-13-shell-06-offline-backfill.md`（C-38–C-45）。

### Added（新增）

- **离线写入与自动回传（SHELL-06）**：单机离线可写 + 恢复后自动补传，失败三分类（凭证 / 网络 / 业务）：
    - **失败三分类 + 退避（C-38/C-39，提交 `8cb1effa`）**：网络类（离线 / 超时 / 5xx / 归一化离线）⇒ 服务级 `pausedUntil`，**不写 item、不消耗重试额度**；业务 / 数据类 ⇒ item `nextAttemptAt` 指数退避（5s → 10s → 30s → 60s → 120s 封顶）；凭证类（401 / 403 / `10041`）维持既有「会话失效不自动重试」。可推判定改为 `isRetryDue`（替换 `retryCount >= MAX_PUSH_RETRY`，删除项同规则）。
    - **回传触发（C-40/C-43）**：启动 / 解锁、前台恢复（`visibilitychange → visible`，节流）、`online` 事件（**仅触发、不作鉴权**）、条件退避定时（有 pending 才存在，5s→10s→30s→60s→120s，成功即清）；全部经 `syncService.enqueue` 串行化 / 去重 / 节流；去除离线期无效推送（G11）。
    - **队列上限可见性与触顶恢复（C-41/C-42，提交 `9b24ce3b`）**：单表 1000 / 总量 2000，**仅提示不阻断、无数据丢失**；状态栏显示「有 N 项修改待同步（离线，联网后自动同步）」+「立即重试」；手动同步 / 网络恢复 / 前台恢复 / 重启经 `resetFailed` 重置暂停与退避并重新入列（含删除项）。
    - **暂停到期定时修复（SHELL-06-DEF-01，提交 `95a9744b`）**：暂停期不再直接 `return`，按 `pausedUntil` 到期安排 tick（clamp ≤120s），到期自动重试；单一定时器可重排、成功即清 ⇒ 修复「网卡在线但后端 5xx/超时」不自愈（BC-13）。
    - 存储层 `SyncQueueRecord` **纯追加可选字段**（`attempts` / `nextAttemptAt` / `lastErrorClass`）；**无 Dexie version bump、无新增索引**（C-44/C-45）。
- **搜索增强（SEA-04；`c11b755b` / `5d1b4366` / `81931547` / `e5733066`）**：URL 深链持久化（查询 / 筛选 / 命中字段 / 已删·已弃开关 / 分页）、搜索历史（本地持久化 + 回填）、命中字段标识与「含已删 / 已弃」开关、i18n 文案；DEF-01（`6e36d2d1`）详情下钻保留查询、DEF-02（`1987a641`）本地状态为单一事实源。
- **离线边界加固（SHELL-05）**：H6 vue-router 去重（`resolve.dedupe`）+ `$router` 降级（`6273acc3`）；门壳必达兜底与同步有界失败（`f7576426`）；全局未捕获错误可观测（`0b031a4c`）；导航目标合法化与回退链（`3f288ffa`）；内容视图去 profile 前置 + 默认视图自愈（`3c6a8fc6`）；离线进入前置校验、结构化凭证失败、`safeReplace` 收敛（`e58cf46f`）；离线登出（本地优先）与缓存昵称占位（`385e1d75`）；判空加固 `c1f86354` / `9e6f41c7`。会话管理离线显示「需联网」占位（G13）。
- **设置对话框左右分栏 + 定尺（SHELL-04；`ed081748`）**。
- **`@nao-todo/shared` 新增 locale 键**：SEA-04 `search.*`、SHELL-05/06 `sync.*` / `identity.*` / `gate.*`（zh-CN / en-US / types 同步）。

### Fixed（修复）

- **任务详情面板标签栏覆盖子任务（TASK-03；`25fef945`）**：`task-details/main` 标签栏与子任务区重叠修复。

### Changed

- 版本协同 bump（功能批次 → minor）：root / `@nao-todo/desktopapp` `1.6.0 → 1.7.0`；`@nao-todo/infrastructure` `0.4.0 → 0.5.0`（离线回传能力）；`@nao-todo/presentation-identity` `1.1.0 → 1.2.0`（离线身份 / 判空）；`@nao-todo/shared` `1.2.0 → 1.3.0`（新增 locale 键）；`@nao-todo/presentation` `0.4.0 → 0.4.1`（TASK-03 修复，patch）。
- **发布前置**：服务端 `5c0b25d3`（SYNC-DEF-01）**已部署**；**无 Dexie 版本迁移**；同步协议 / 表结构 / 游标未变。
- 无公开 API 导出面破坏；移动端红线 `@nao-todo/presentation-react` 零改动。

### 质量门槛

- `vp test --run`：**73 文件 / 641 例全绿**。
- `vp check --no-fmt apps packages`：**1025 文件 0 错 0 警**（仓库内未跟踪 `scripts/electron-smoke/*.mjs` 为 QA 工具脚本，不计入本版范围）。
- `pnpm webapp build` ✓ / `pnpm desktop:build` ✓ / `pnpm guard:ddd` OK。

### 已知遗留

- 本版未打 tag：`v1.7.0` 待 PM 放行后打注解 tag。
- 客户端 `v1.7.0` 发版须晚于服务端 `5c0b25d3` 上线（已部署）。
- SHELL-06 触发源注册与上限提示 UI 未补独立组件测试（能力经纯层单测 + 门禁构建覆盖）；`crypto-service` 多用户隔离用例偶发超时（隔离运行通过）。

[v1.7.0]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.7.0

## [v1.6.0] - 2026-09-13

发布批次：SORT-01 详情面板子任务拖拽排序（per-group `sort_id`）。**Tag `v1.6.0` 待 PM 放行后打** · **前置：服务端 `fc20c74` 需先上线**（`GetMaxSortId` 按组 + `CreateTaskReq.sortId` + `parentTaskId` 查询默认序）· root `1.6.0` / `@nao-todo/desktopapp` `1.6.0` / `@nao-todo/presentation` `0.4.0` / `@nao-todo/infrastructure` `0.4.0` / `@nao-todo/domain-task` `1.2.0`（`@nao-todo/shared` `1.2.0` / `@nao-todo/domain-project` `1.1.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（presentation / infrastructure / domain-task 层；移动端红线零改动）。设计记录：ADR `docs/adr/2026-09-13-subtask-reorder.md`（r3）；PRD `docs/prds/2026-09-13-subtask-reorder.md`（AC1–AC15）。

### Added（新增）

- **子任务拖拽排序（SORT-01；per-group 作用域）**：详情面板子任务区支持整行拖拽重排，排序键 `sortId ASC, id ASC`；组 = 同一 `parentTaskId`（`0` = 顶层组）。落点（提交 `c176c922`）：
    - **`sortId` 全链路透传**：`TaskRes` / `TaskEntity`（尾部可选 `=0`）/ `TaskViewObject` / `UpdateTaskViewObject` / `CreateTaskReq`；`persistence-go`·`persistence-local` 转换器与 `TaskRecord`（**无 Dexie version bump**，ADR §5.3）；旧响应/旧记录缺失兜底 `0`；sync tasks `entityToPush` 白名单 +`sortId`。
    - **`0` 不产出**：`createTaskValueObject2Req` 与 push 载荷在 `sortId = 0` 时省略该字段（ADR B1/G4，防存量推送清零组内序）。
    - **`TaskUseCase.resort(originalId, boundId, isBefore, { allowRebuild })`**：组内浮动间隔 1000 + **仅本组**重建（`1000, 2000, …`，复用 `batchUpdate`）；预检「目标位置 == 当前位置」⇒ no-op；重建触发 `newSortId <= 0`（前插得 0）/ `> 65535` / 相邻差 `< 2`；单条失败 ⇒ 本组重建后重试一次；组 `> 65` 行或未取尽（R1/Q2）⇒ 禁用重建，仅单条浮动赋值。
    - **子任务按组全量加载**（`limit = 100`）并按 `(sortId, id)` 展示，`resortSubTasks` 带 `pagination.total` 判定的 `allowRebuild`（R1 数据顺序阻断项处置）。
    - **拖拽 UI 模仿检查项**：`useEventDragger` 参数化（row/list/idKey，默认值保持检查项契约）+ 同列表守卫 + 交互元素 `dragstart` 防误触；`subtasks.vue` 整行拖拽 + up/down 蓝色插入指示线；dragImage 自定义半透明鬼影（提交 `afdb8228`：`setDragImage` clone，`opacity 0.35`、离屏挂 body、光标对位 offset、异步移除；提交 `c8d12d73`：补 `--nue-primary-color-100` 浅灰底 + `--nue-primary-radius` 圆角）——两列表统一观感。

### Changed

- 版本协同 bump：root / `@nao-todo/desktopapp` `1.5.0 → 1.6.0`；`@nao-todo/presentation` `0.3.0 → 0.4.0`；`@nao-todo/infrastructure` `0.3.0 → 0.4.0`；`@nao-todo/domain-task` `1.1.0 → 1.2.0`。
- `TaskEntity` 构造器新增**尾部可选** `sortId = 0` ⇒ 非破坏 minor，既有调用点零改动；`TaskUseCase.resort` 为新增方法，无导出面破坏。

### 质量门槛

- `vp test run`：**59 文件 / 541 例全绿**（SORT-01 新增 +26 例：resort 10、转换器与 push 白名单、排序与重建守卫、拖拽组件/ghost）。
- `vp check --no-fmt`：**1011 文件 0 错 0 警**。
- 突变验证：重建条件回改 `< 0` ⇒ 2 failed；移除 push 的 `0` 省略 ⇒ 1 failed；注释 `applyDragImage` ⇒ 1 failed。

### 已知遗留

- 顶层任务列表手动排序（组 0）与顶层默认序（需先做 `sort_id = 0` 数据普查/回填）另立（ADR §12）。
- 跨父拖拽 reparent 另立；换父仍走既有父选择器/脱离入口。
- `Restore` 保留原 `sort_id` 不重排（B7）；组内 `> 65` 行重建降级策略、服务端按组 `resort` 接口为观察项。
- 发版顺序约束：客户端 `v1.6.0` 必须晚于服务端 `fc20c74` 上线（本版未打 tag）。

[v1.6.0]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.6.0

## [v1.5.0] - 2026-09-13

发布批次：领域统计属性（计数）字段透传 —— 客户端收尾单。**Tag `v1.5.0` 待 PM 放行后打**（架构评审修正：服务端上线 + `backfill_counts.sql` 回填完成后才可客户端发版；本版只做版本号/CHANGELOG 准备与提交）· root `1.5.0` / `@nao-todo/desktopapp` `1.5.0` / `@nao-todo/presentation` `0.3.0` / `@nao-todo/infrastructure` `0.3.0` / `@nao-todo/domain-task` `1.1.0` / `@nao-todo/domain-project` `1.1.0`（`@nao-todo/shared` `1.2.0` / `@nao-todo/presentation-react` `0.1.0` 不动）。范围：web + desktop（presentation / infrastructure 层）。设计记录：ADR `docs/adr/2026-09-12-stat-counts-denormalized-events.md`（r2）；PRD `docs/prds/2026-09-13-stat-counts-denormalized-completion.md`（AC11–AC15）。

### Added（新增）

- **领域统计属性（客户端只读透传；计数 = 服务端 owned）**：Task +`checkItemCount / commentCount / subtaskCount`，Project +`taskCount`。字段透传（提交 `8ce494cb`，ADR §13.2 全 13 项）：
    - 远程模型 `TaskRes` +3 / `ProjectRes` +1；`taskRes2TaskEntity` / `projectRes2Entity` 映射，旧服务端/存量响应缺失兜底 `?? 0`（AC11）。
    - 实体 `TaskEntity` +3 / `ProjectEntity` +1 **尾部可选参数（默认 0）** ⇒ 既有 8 个 `new TaskEntity(...)` 调用点零改动（AC14）。
    - 视图对象 `TaskViewObject` +3 / `ProjectViewObject` +1；`taskEntityToViewObject` / project 转换器逐字段显式透传（AC12）。
    - 本地 `TaskRecord` / `ProjectRecord` 接口 +字段（**无 Dexie version bump、无索引**，ADR §5.3）；record↔entity 映射 `undefined` 兜底 0（AC13）。
    - `sync-service.ts` push 白名单**不含计数**（双向拒绝客户端计数；服务端 req 亦无），回归断言把关（AC15）。
- **任务详情视图对象计数透传 + 单测**：`TaskDetailsViewObject` 组装器 `use-task-view-object.ts` 显式透传 3 个计数字段（逐字段复制模式的涟漪），并补单测断言计数进入详情视图对象且随 store 同步刷新（QA 复核缺口）。

### Changed

- 版本协同 bump（ADR §9）：root / `@nao-todo/desktopapp` `1.4.5 → 1.5.0`；`@nao-todo/presentation` `0.2.1 → 0.3.0`；`@nao-todo/infrastructure` `0.2.2 → 0.3.0`；`@nao-todo/domain-task` / `@nao-todo/domain-project` `1.0.0 → 1.1.0`。
- 实体构造器为**非破坏 minor**（尾部可选参数，签名不破坏）⇒ 未升 major。
- 无公开 API 导出面变更；`shared` / `presentation-react`（移动端红线）零改动。

### 质量门槛

- `vp test run`：**58 文件 / 515 例全绿**。
- `vp check --no-fmt`：**1010 文件 0 错 0 警**。
- 突变验证：移除详情组装器 3 行计数透传 ⇒ 新增单测 1 failed（真实护栏）。

### 已知遗留

- 计数**展示 UI**（角标位置/文案/项目列表任务数）不在本单，另立 UI 单（ADR §14）。
- 本地乐观增量（离线写后本地计数 +1 回显）首版不做（ADR §5.4 可选增强）。
- 按计数排序若要索引 ⇒ 才需 Dexie version(5)（观察项）。
- 发版顺序约束：客户端 `v1.5.0` 必须晚于服务端上线 + 回填完成（本版未打 tag）。

[v1.5.0]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.5.0

## [v1.4.5] - 2026-09-12

发布批次：任务查询默认排除已删除（快速修复）。Tag: `v1.4.5` · root `1.4.5` / `@nao-todo/infrastructure` `0.2.2` / `@nao-todo/desktopapp` `1.4.5`（`@nao-todo/presentation` `0.2.1` 不变）。范围：本地查询层（web + desktop 共用；mobile 走服务端仓库，零影响）。

### Fixed（缺陷修复）

- **任务查询默认包含已删除任务（含子任务）**：`task-repo-impl.ts` 未传 `isDeleted` 时不过滤，已删除任务（含子任务）照常出现在默认视图查询里——与项目仓库（`project-repo-impl.ts`「对齐远程 GET /projects/ 语义」）及 `isGivenUp`「默认排除」惯例不一致。修复（提交 `8f5dbb6a`）：默认（未传）或 `isDeleted=false` ⇒ 排除已删除；`isDeleted=true` ⇒ 仅已删除（行级过滤，父/子一视同仁）。
- 影响面：父任务选择器显式 `isDeleted:false` 不受影响；「垃圾桶」内置视图（`builtin.deleted`）显式 `isDeleted:true`，**不受默认排除影响**；移动端走服务端仓库，零跨端涟漪。
- 恢复路径（订正，2026-09-12 用户提示「垃圾桶」后核实）：「垃圾桶」内置视图**已存在**（`builtin.deleted`，`default.ts:177` 偏好 `getTasksOptions` 显式含 `isDeleted: true` + `sort: deletedAt desc`）——显式传参不受默认排除影响 ⇒ **恢复入口完好**，本批不触碰它。

### Changed

- 无公开 API 变更（`infrastructure` `0.2.1 → 0.2.2` 为 patch；行为默认值变更属缺陷修复）。

### 质量门槛

- `vp test run`：**503 passed**（唯一失败 = 已裁决的周六边界 flake `task-filter-core tomorrow/week`，与本次无关；`local-repos.test.ts` 59/59 全绿）｜`vp check --no-fmt`：**1007 文件 0 错 0 警**。
- 突变验证：回退旧实现跑新 2 测试 ⇒ 2 failed（真实护栏）。
- 新增测试：默认不查已删除任务 / 默认不查已删除的子任务。

### 已知遗留

- 周六边界 flake（`task-filter-core.test.ts`，presentation-react 红线包内）未修（test-only 修复待用户放行）。
- 其余同 v1.4.4（A6 删除 / 协议 v2.3 落 PRD §9 / DEF-STORE-01 重构 / C4 前半 / §7）。

[v1.4.5]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.5

## [v1.4.4] - 2026-09-11

发布批次：`DEF-STORE-06` 内存 store 未随落库失效（P1 用户可见陈旧）修复。Tag: `v1.4.4` · root `1.4.4` / `@nao-todo/presentation` `0.2.1` / `@nao-todo/desktopapp` `1.4.4`（`@nao-todo/infrastructure` 本版零改动，不 bump）。范围：web + desktop（presentation 层）。设计记录：ADR `docs/adr/2026-09-11-def-store-06-store-invalidation.md`。

### Fixed（缺陷修复）

- **`DEF-STORE-06`（P1，用户可见陈旧）：外部变更经「立即同步」已落本地 DB，但重载前内存 store 与面板行文案仍旧值**。根因 = 失效（invalidation）依赖**视图域订阅**：`nao-todo:data-changed` 的监听与 `RefreshData` 发射绑在 `index-view.ts`（随视图挂载存在/卸载消失），且 `TaskDetailsStore` 无任何 `RefreshData` 订阅者 ⇒ 详情副本只在 `initialize()`（路由变更/重挂载/重试）刷新。修复（ADR 决策，提交 `4e51ca30`）：
    - **方向 1**：新增应用级失效中心 `useStoreInvalidationHub()`（`packages/presentation/task/stores/store-invalidation.ts`）—— `window 'nao-todo:data-changed'` → 全局 `useSubscriber().emit('RefreshData')`，与视图挂载解耦；web/desktop 各一行接线；幂等守卫保证整应用只注册一次。
    - **方向 2**：`use-subtasks.ts` 订阅 `RefreshData` → `retrySubTasks()`（以当前父任务 id 清空整体重取 = 等价 `initialize()` 语义），`onUnmounted` 反订阅。
    - **方向 4（事件不丢失）**：`use-task-loader.ts` 的 `loadAndReplace` 由"在飞时静默丢弃"改为**单槽 pending**（置脏 → 完成后重跑一次；单槽天然防风暴）。
- 验收（QA 实机 T1 断言）：外部直写 + 立即同步 + **静置 3s 零交互** ⇒ `store.details` 与面板行文案**应变新**（重载自愈对照）。【QA 结论：**PASS**（`RUN_TAG=mtwulk95`：T1 时 `store.details`=B 且行文案=新值；T2 重载自愈对照通过；`pulls=1`、重复 pull=0 ⇒ hub 幂等守卫有效）】

### Changed

- 无公开 API 变更（`presentation` `0.2.0 → 0.2.1` 为 patch）。`stores/index.ts` 补导出 `store-invalidation`（接线所需）。

### 质量门槛

- `vp test run`：**55 文件 / 502 例全绿**（499 + 新增 3：在飞不丢失 / RefreshData 重取 / mock 补导出）｜`vp check --no-fmt`：**1006 文件 0 错 0 警**。
- 回归线：`sync-service.ts` / `syncStatus`（BC-3a/b/c）、五个视图适配器、`loadAndPush`/翻页均未触碰。

### 已知遗留

- 列表 store 的"顶层行 T1 仍陈旧"已**静态判定为分页作用域假象**（主列表默认只查顶层任务，子任务不进页内数据集；滚动/筛选触发新批次即新）⇒ **不立新单**。
- `DEF-STORE-01`（观察项，P2-leaning）维持；A6 `fillStartAt()` 死方法删除、§7"内容未变跳过写入"、T1 断言落常驻探针等仍为延后/待触发。

[v1.4.4]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.4

## [v1.4.3] - 2026-09-11

发布批次：`DEF-SYNC-05` 客户端拉取游标修复 + 零调用 API/死字段清理（补丁；含一处**包导出面收窄**）。Tag: `v1.4.3` · root `1.4.3` / `@nao-todo/presentation` `0.2.0` / `@nao-todo/infrastructure` `0.2.1` / `@nao-todo/desktopapp` `1.4.3`。范围：web + desktop（+ `infrastructure` 同步层）；**移动端不动**。设计记录：ADR `docs/adr/2026-09-11-def-sync-05-client-pull-cursor.md` + `docs/adr/2026-09-11-infra-cleanup.md`。

### Fixed（缺陷修复）

- **`DEF-SYNC-05`：外部变更经「立即同步」不回灌本地（P2）**。根因**两处叠加**：① 客户端游标推进用**字符串 max**（`applyPullBatch`，混合 `+08:00`/`Z` 表示法时**字典序即错**）；② 服务端 keyset 为**严格 `>`**（`updated_at > cursor OR (= AND id > cursorId)`，`query/sync.go:26-36`）⇒ 游标一旦越过某行 bump 后的 `updated_at`（毫秒级/同秒 + 更高 `cursorId`），该行**静默漏拉且永不重拉**（重载/重启自愈走的是**非 pull** 路径，故表现得像“能自愈”）。修法（ADR 选 **A**）：游标推进改**瞬时（ms）比较**；请求游标按瞬时**回拉 Δ=1s**，回拉时 `cursorId` 置空（同刻低 id 行否则仍被跳过）、**保持原时区后缀与精度形态**、**不可解析/无时区 ⇒ 原样返回**（退化为修复前行为，不冒险）。**存储游标只前进不后退**；BC-3a/b/c 回归线未触碰（diff 内相关符号出现 0 次）。
- 被否方案：**B**（拉取后以本地 `max(updatedAt)` 比对补偿 —— 受客户端时钟、未推送写入、服务端秒级截断干扰 ⇒ 易假阳性 ⇒ 触发重复拉取风暴）｜**服务端改 `>=`**（破坏 keyset 分页契约）。
- 验收：新增 4 例（含**硬判据**：预置 `syncCursor` ≥ 变更行 `updatedAt`（ms 级）+ fake requester 按服务端 keyset 严格 `>` 过滤 ⇒ 断言该行**仍被应用**）；并做**突变验证**（回退旧实现 ⇒ 新增 4 例**全 FAIL**，硬判据症状 `expected undefined to be defined` = 外部变更行确实未落库）⇒ 证明测试能抓住旧缺陷。

### Changed（API 收窄）

- **移除零调用公开 API 与死字段（`@nao-todo/presentation` 导出面收窄）**：`TaskHandler.updateTaskName` / `updateTaskDescription` / `updateTaskEndAt` / `giveUp`（4 个方法**全仓零引用**）+ `TaskDetailsStore.taskDetails` / `setTaskDetails`（**连带删除孤儿 import**）—— **同批一次删完，禁止半删**（避免留下语义不明的半成品 API）。判据三条：**零引用 + 无孤儿 + 不改运行时行为**。
- **保留**：`common.edit` 词典键（被 TASK-02 单测**反向断言**依赖，删除会静默弱化断言）；`TaskHandler` 其余存活方法。
- **延后**：客户端 `CreateTaskValueObject.fillStartAt()`（保留作服务端 `DEF-SYNC-04` 的语义参考，跨单协调后再处理）。
- ⇒ 版本语义：`@nao-todo/presentation` `0.1.3 → 0.2.0`（**移除导出面成员属破坏性变更**，0.x 下走 minor 位；本仓消费者对这 4 个方法零引用 ⇒ **实际破坏为 0**，语义如实标注）。

### 质量门槛

- `vp test run`：**55 文件 / 499 例全绿**（v1.4.2 基线 495 + 新增 4）｜`vp check --no-fmt`：**1005 文件 0 错 0 警**。
- 实机：QA `defsync05` 探针（外部 API 直写 → 「立即同步」→ 读本地 DB）在修复后应从 FAIL **转 PASS**（列后置复跑）。

### 已知遗留（本版不修）

- **回拉窗口的重复写入**：窗口内已应用的行会被再次 `put()` 并计入 `writtenCount`（`applyPullBatch` 未入队分支无条件 `put`）⇒ 理论上游轮同步**可能多触发一次 `data-changed`（视图重拉）**；**无数据风险**（同 id upsert 幂等）。若观察到刷新抖动 ⇒ 另单加“内容未变跳过写入”。
- **`DEF-SYNC-04`（服务端 P1，另一仓库）**：`FillStartAt()` 覆盖客户端显式 `startAt` ⇒ 已在 `nao-todo-server` 修复（`fae99e2` 提交；`go test -count=1` 三包通过，已独立复跑核对），待该仓发版。
- **`DEF-STORE-01`（观察项，P2-leaning）**：Pinia 任务多副本（两副本同 id 同时在场为**必然**、任一侧后续写入会让另一侧陈旧）；**用户可见陈旧未复现**（受控 P3 阴性）；修复方向 = **单一权威源**（另立设计单，不混入清理单）。
- **`DEF-UI-01`**：**已驳回关闭** —— 原判“已有时间窗子任务日历打不开”系**探针误报**（误找 creator 式按钮 + 误用无效区间）；实测日历可用、无效区间提交**有 toast 校验**非静默。
- **清理单延后/另立**：A6 `fillStartAt()`｜C1 `DEF-STORE-01` 单一权威源重构｜C2 `giveUp()`（含确认弹窗）与批量 `update({givenUpAt})`（静默）的**行为差异**（产品语义决策）｜C3 TASK-01 移动端遗留（继承未覆盖、继承规则升级 B、行内日期编辑）｜C4 SHELL-02/03 遗留（nue-ui 版本对齐、infrastructure 硬编码中文 i18n、离线写入口径、`apps/mobile` 壳耦合）。
- 其余沿用 v1.4.2/v1.4.1/v1.4.0 已登记遗留。

[v1.4.3]: https://github.com/Nathan3303/nao-todo/releases/tag/v1.4.3

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