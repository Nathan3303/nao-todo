# Changelog

本仓库为私有 monorepo（root `private: true`，内部依赖 `workspace:*`）。版本策略：功能批次 → minor（root 协同版本 + 实际变更包各自语义化 bump）；发布以注解 tag 记录。历史 PRD 明细见 [docs/prds/](docs/prds/)。

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