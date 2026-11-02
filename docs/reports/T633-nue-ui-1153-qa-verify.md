# T633 · `nue-ui 1.13.0 → 1.15.3` 升级 + `DEF-116` 规避回收 —— QA 独立复验

- 批次：`M20261102-nue-ui-1153` / `v1.16.4`（PATCH）· 分支 `nao/M20261102-nue-ui-1153`
- 复验基线：PM 派单时 HEAD `e337a3de`；**实际复验 HEAD = `0e033e65`**（PM 台账提交，仅 `docs/tasks-state.md`，代码面零差异）
- 输入：PRD `docs/prds/2026-11-02-nue-ui-1.15.3-upgrade.md`（AC1–AC15 · R-A…R-L）· 架构评审 `docs/reports/T628-nue-ui-1153-arch-review.md` · ADR `docs/adr/2026-11-02-nue-ui-upgrade-and-workaround-retire.md`（已接受）
- RD 交付：`7d96dbb7`(S1) · `23ff7af5`(S2) · `a0a013b7`(S3) · `7169ee7f`(S4) · `e337a3de`(AC14)
- 本单形态：**不采信 RD 回执**，逐条自验；**未改任何产品代码**，只新增 3 个测试文件 + 2 份文档（第 4 个用例复核后判定与既有覆盖重复，已撤除，见 §4 M4）
- 环境（复验机）：Node **v24.22.1** · pnpm **11.18.0** · vite-plus **v0.2.6**（vitest **4.1.10** / rolldown **1.2.0** / oxfmt **0.60.0** / oxlint **1.75.0**）· `TZ = Asia/Shanghai`（UTC+8）· 依赖实测 `nue-ui 1.15.3` / `nue-ui-theme-shadlike 0.13.30`（根与 `apps/desktop` 各一）· 复验日期 2026-11-02

## §0 结论

**复验通过，可进入合并（RD 执行）——附 1 条 AC 文字偏差 + 3 个遗留出口。**

- 15 条 AC 中 **13 条直接绿**；**AC8 部分未实测**（像素宽度，jsdom 无布局 ⇒ 走结构判据 + 用户走查）；**AC13 字面判据未满足**（`search-filter-bar.test.ts` 的逐次索引断言**不是「一行未改」**，见 §2 AC13 —— 属必要的口径更新，断言强度未降，需 PM/arch 判定 AC 文字是否订正）。
- 测试口径**未被放宽**：`T628 §4` 末 7 条红线逐条核对通过（§3）。
- 变异探针 **4/4 全部被杀**。其中 **M1 对既有用例杀不死**（既有 `--route-icon` 断言只落在合成 `h(NueLink, …)` 上，不覆盖真实入口）⇒ 覆盖缺口真实存在，已由本单新增用例补齐并用同一次变异反向验证；**M4 由既有 `t603-smart-list-href.test.ts` 杀死**（首轮我把对照选成 T523 的 `smart-list.test.ts`，误判为缺口；复核后已撤除本单临时新增的重复用例，见 §4）。
- 门禁 9 项全绿，全仓 `350 文件 / 2842 例 / 0 红`（§5）。
- 体积增量全部 **< 1%**（最紧的一项是 CSS 原量 **+0.9627%**，来源 = 主题新增 `select/date-picker/message` 三份 CSS，与 PRD 预判一致）（§6）。

## §1 数字基线（AC10 差值解释的前提）

| 节点                                       | 文件    | 例       | 红    | 说明                                                           |
| :----------------------------------------- | :------ | :------- | :---- | :------------------------------------------------------------- |
| 升级前（`cefac3b4`，PRD S0 基线）          | 345     | 2821     | 0     | PM 派单给出                                                    |
| S1–S4 + AC14 落地（`0e033e65`）            | 347     | 2824     | 0     | +2 文件 / +3 例 = `link-focus-ring`(1) + `nue-picker-clear`(2) |
| **本单加 3 个新测试文件后（HEAD+工作区）** | **350** | **2842** | **0** | +3 文件 / +18 例 = AC1(6) + AC7(3) + AC13(9)                   |

> 差值逐条对得上：`347 − 345 = 2`（S2/S3 各新增 1 个测试文件）、`2824 − 2821 = 3`（前者 1 例 + 后者 2 例），本单 `+18` 全部来自新增文件，**无删除既有用例、无跳过、无断言改写**（本单只撤除了自己新增的 1 个重复文件，它不在上述基线内）。

## §2 逐 AC 结论表

| AC                          | 判据                                                                | 我的实测（命令 / 输出）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 结论                     |
| :-------------------------- | :------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------- |
| **AC1（依赖）**             | 两处 `package.json` 版本；锁文件零夹带；无 `npmmirror` / 旧版本残留 | ① `grep nue-ui package.json apps/desktop/package.json` ⇒ `1.15.3` / `0.13.30` ×2；② `node -e require('…/nue-ui/package.json').version` ⇒ 根 **1.15.3**、`apps/desktop` **1.15.3**（theme 两处均 `0.13.30`）；③ `git diff cefac3b4..HEAD -- pnpm-lock.yaml \| grep '^[+-][^+-]' \| wc -l` ⇒ **28**，逐行归类后**全部**属于 `nue-ui` / `nue-ui-theme-shadlike` 的 `specifier`/`version`/`integrity`/`packages`/`snapshots`（2 个 importer × 2 包 + 2 个 packages 条目 + 2 个 snapshots 条目）；④ `grep -c npmmirror pnpm-lock.yaml` ⇒ **0**；⑤ `grep -rn '1\.13\.0\|0\.13\.28' pnpm-lock.yaml package.json apps/desktop/package.json \| grep nue-ui` ⇒ **0 行**                    | **绿**                   |
| **AC2（主路径）**           | 11 处导航入口真挂载后 `href` 非空且 = `router.resolve(path).href`   | `t603-nav-a11y` AC1①②③④（真实 router + 真实 `nue-link`，13 例全绿）；`hrefs()` 用 `toEqual([...expected])` 逐项比对，**不是**「非空即过」                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | **绿**                   |
| **AC3（边界，动态面）**     | `smart-list` 0 / 1 / 多 条均有 `href`                               | **既有 `packages/shared/components/smart-list/__tests__/t603-smart-list-href.test.ts` 已充分覆盖**（真 router + 真 `nue-link`）：AC2① 0 条 = 无锚点 + 空态文案；AC2② 1 条 = `href === router.resolve(route).href` + `nue-link--route`；AC2③ 7 条顺序比对；AC2④⑤ `ProjectSmartList` / `TagSmartList` 两处包装各 3 条；AC3 附加 可聚焦 + 可访问名。**6 例绿**。（本条初查误判为缺口——当时只跑了 T523 的 `smart-list.test.ts`；复核后撤除了本单临时新增的重复用例，见 §4）                                                                                                                                                                                                          | **绿（既有覆盖）**       |
| **AC4（可访问性三证）**     | ①运行期 ②源级 ③走查                                                 | ① `t603` AC3①②③：每个导航锚点 `tabIndex >= 0` + `focus()` 后 `document.activeElement === a` + 可访问名非空（`aria-label \|\| title \|\| textContent`）；②**自读源文件** `apps/web/src/themes/link.css` 含 `.nue-link:focus-visible { outline: 2px solid var(--nue-primary-color-600); outline-offset: 2px }`；`link-focus-ring.test.ts` 用 `?raw` + `sourceOf()`（断言 glob 恰好命中 1 文件）取**规则块内**文本比对；**加证**：`apps/web/dist/assets/index-*.css` 内实际产物含 `.nue-link:focus-visible{outline:2px solid var(--nue-primary-color-600);outline-offset:2px}` ⇒ 两端（web/desktop 共用 `@/themes`）均生效；③ 走查项见 `M20261102-nue-ui-1153-user-acceptance.md` ② | **绿（③待用户）**        |
| **AC5（负向）**             | 无 `to="[object Object]"`；点击仍走 SPA                             | `git grep '\[object Object\]' -- apps packages` ⇒ 仅 `t603` 断言文本，**源码 0 处**；模板 `to="` 命中 3 处全为 `<teleport to="body">`；`t603` AC4①a–d 断言无 `a[to]` 且 html 不含 `[object Object]`；AC4② 派发真实 click ⇒ `defaultPrevented === true` 且 `router.currentRoute.path === '/calendar'`                                                                                                                                                                                                                                                                                                                                                                             | **绿**                   |
| **AC6（规避回收）**         | grep = 0 + 目录已删 + 导出面无残留                                  | `git grep -n 'NaoRouterLink\|shared/components/router-link' -- apps packages` ⇒ **rc=1（0 命中）**；`ls packages/shared/components/router-link` ⇒ 不存在；`grep 'router-link\|NaoRouterLink' packages/shared/components/index.ts` ⇒ **0**                                                                                                                                                                                                                                                                                                                                                                                                                                        | **绿**                   |
| **AC7（日期回归）**         | 3 组 emit 快照 + 结论句                                             | 新增 `packages/presentation/task/components/date-selector/__tests__/t633-ac7-datetime-emit.test.ts`（3 例绿），逐字值见 §2.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | **绿**                   |
| **AC8（选择器回归）**       | 清除行为 + `disabled` 跟随 + 键盘可达 + 面板 picker 宽度前后一致    | ① 清除：`nue-picker-clear.test.ts` **2 例真跑绿**（`nue-select` / `nue-date-picker` 各 1），实测清除键 = 原生 `button[type=button]` + `aria-label`（`清除选择` / `清除日期`）、`focus()` 后 `activeElement` 命中、点击后值清空 + 键消失、`disabled` 时带 `disabled` 属性；② **宽度：未实测**（jsdom 无布局）——结构判据见 §2.2，判定**补丁有依据且无副作用**                                                                                                                                                                                                                                                                                                                      | **绿（宽度部分未实测）** |
| **AC9（头像）**             | 坏 `src` → 好 `src` 恢复显示                                        | **本单未复验**（PM 未派），由走查项 ⑥ 覆盖 + 上游 `#109`（`820a36c9`）保证；本仓 7 处 `nue-avatar` 的 `src` 均为 computed ⇒ 换地址即重试                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **未覆盖（转走查）**     |
| **AC10（门禁）**            | 九项 + 精确数字                                                     | 见 §5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **绿**                   |
| **AC11（桌面端）**          | `desktop:build` exit 0 + 其 `node_modules` 版本                     | `apps/desktop/node_modules/nue-ui/package.json` ⇒ **1.15.3**（theme `0.13.30`）；`pnpm run desktop:build` ⇒ exit **0**（16.50s，产物 `apps/desktop/out/`）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | **绿**                   |
| **AC12（零夹带）**          | diff 只含依赖/回退/测试口径/文档                                    | `git diff --stat cefac3b4..HEAD` + 本单新增文件清单逐条核对：依赖 3 文件、回退 17 文件、S3 行为面 10 文件、测试口径/新增 4 文件、文档 2 文件；**无无关重构**（`git diff cefac3b4..HEAD -- apps/web/vite.config.ts vite.config.ts` 空）                                                                                                                                                                                                                                                                                                                                                                                                                                           | **绿**                   |
| **AC13（switch 去双实现）** | 5 处自建 a11y 全拆、`aria-label` 保留、`search-filter-bar` 断言强度 | ① `git show a0a013b7` 逐文件读：`search-filter-bar` 删 `role`/`:aria-checked`/`tabindex`/2 条 `@keydown.*`，`:aria-label` **新增**（原为无）；`reminder-panel` ×4 同口径删 4 组、`:aria-label` **保留**；② 本单新增 `apps/web/src/__tests__/t633-ac13-switch-single-source.test.ts`（9 例绿）把「可疑写法消失」+「每个开关有可访问名」+「上游 `disabled ⇒ tabindex=-1`」+「一次按键恰好一次上抛」变成可跑事实；③ **偏差**：见下方 §2.3 — `search-filter-bar.test.ts` **不是「一行未改」**                                                                                                                                                                                        | **绿（附 1 条偏差）**    |
| **AC14（newTaskId 追认）**  | JSDoc C-1…C-4 + 用例头注                                            | 读 `packages/presentation/task/components/kanban/types.ts`：`newTaskId` JSDoc 含 C-1（命令通道，禁 `update:` 回写 / 禁当状态读 / 禁参与渲染）、C-2（id 唯一性前提 + 「同值重复须改 `{id, seq}`」）、C-3（先写 store 后广播，否则静默丢弃）、C-4（非第二数据源），并附 3 个指针；`view-adapters/kanban-view-adapter/__tests__/t620-ac14-add-task.test.ts` describe 上方有命令通道口径头注（含「⛔ 不许改来适配同值重复下发」）；ADR `2026-11-01-kanban-column-paging.md:16` 决策 2 已回写「arch 2026-11-02 追认：有条件接受」                                                                                                                                                     | **绿**                   |
| **AC15（3 处补名）**        | `timer-setting` ×2 / `task-remind-setter` ×1 补 `aria-label`        | 读 `git show a0a013b7`：3 处均补 `:aria-label="t(<同键>)"`，可见文案改用**同一 i18n 键**（无硬编码中文）；新增 3 键 `pomodoro.timerSetting.autoStartNextFocusSession` / `pomodoro.timerSetting.autoRest` / `task.reminder.enabled` 在 `zh-CN` / `en-US` / `types` **三处齐备**（运行期断言：`messages[locale][key]` 非空）                                                                                                                                                                                                                                                                                                                                                       | **绿**                   |

### §2.1 AC7 三组 emit 快照（本机 `Asia/Shanghai`，UTC+8；实测逐字值）

| 组  | 输入 `modelValue`            | 面板时分 | 点选 11-15 后 `emit` 值    | 断言口径（时区无关）                                                                              |
| :-- | :--------------------------- | :------- | :------------------------- | :------------------------------------------------------------------------------------------------ |
| ①   | `2026-11-02T08:30:00.000Z`   | `16:30`  | `2026-11-15T08:30:00.000Z` | 本地日期 = 11-15，本地时分 = 16:30（= 输入的本地时分）⇒ **时刻保持**                              |
| ②   | `''`（空值，系统时刻 21:47） | `21:47`  | `2026-11-15T13:47:00.000Z` | 本地日期 = 11-15，本地时分 = **21:47** ⇒ **仍为「现在时刻」**（锁上游 `5da96222` 未触 else 分支） |
| ③   | `2026-11-02`（date-only）    | `00:00`  | `2026-11-14T16:00:00.000Z` | 本地日期 = 11-15，本地时分 = **00:00** ⇒ 上游新口径                                               |

- 断言不写死 ISO 串，一律 `new Date(iso)` 取本地 `getHours()/getMinutes()` 比对 ⇒ 换测试机时区不会假红。
- **结论句**：本仓 **4 处 `type="datetime"`** 的取值链恒为「完整 ISO 或空串/null」——
  `task-date-selector.vue:69-70`（`props.startAt`/`endAt`，任务 VO 写入路径一律 `.toISOString()`，保存侧 `:82-89` 再 `dayjs(v).toISOString()`）、
  `task-multi-select-panel.vue:40`（`ref<string|null>(null)` → 仅由 picker emit 写入）、
  `reschedule-panel.vue:17/21/28`（`''` → `dayjs(...).toISOString()`），
  且全仓**无任何**把 `startAt`/`endAt` 写成 `YYYY-MM-DD` 的生产写入（`git grep` 核实：`format('YYYY-MM-DD')` 命中均为只读展示/计算）。
  ⇒ **本仓不产生 date-only 输入，③ 在本仓不可达；用户可感知行为不变**（① 常态路径与升级前一致，② 空值仍补现在时刻）。
  ⇒ ③ 的作用是「上游若把 else 分支也改成 `00:00`（或改回去）这里会红」，属**口径哨兵**而非本仓路径。

### §2.2 AC8 宽度：结构判据（未实测像素）+ 补丁是否有依据、有无副作用

**结论：补丁有依据，且副作用面被限制在任务日期面板内部；像素宽度未实测（jsdom 无布局），由走查项 ⑤ 兜。**

证据链（运行期 dump 实测 DOM，非静态推断）：

```text
# nue-date-picker（1.15.3，真挂载）
root   = DIV.nue-dropdown-wrapper.nue-date-picker
child  = DIV.nue-date-picker__trigger            <- __trigger 是 .nue-date-picker 的【直接子节点】
inside = BUTTON.nue-button + BUTTON.nue-date-picker__clear（同级）
# 主题 CSS（0.13.30）
.nue-date-picker__trigger{position:relative;width:fit-content}     <- 补丁针对的正是这条
.nue-date-picker__clear{position:absolute;right:calc(...);top:0;bottom:0}
```

- **有依据**：`__trigger` 确实存在且 `width: fit-content`，而内层 `.nue-button` 是 `width:100%` ⇒ `100%` 的包含块由「按钮自身」变成 fit-content 的 trigger ⇒ **必然收窄**，补 `__trigger{width:100%}` 是把包含块拉回整行，方向正确。
- **选择器可命中**：`.task-date-selector-panel__row > .nue-date-picker > .nue-date-picker__trigger` 的前缀已由上面的 DOM dump 证实（`__trigger` 是 `.nue-date-picker` 直接子节点）⇒ 不是「写对了但选不中」的死代码。
- **产物级确认**（不是只看源码）：`apps/web/dist/assets/task-*.css` 内三条规则均编译正确——
  `.task-date-selector-panel__row>.nue-date-picker{box-sizing:border-box;width:100%}` /
  `…>.nue-date-picker__trigger{width:100%}` / `… .nue-button{width:100%;…}`。
  嵌套语法被构建期摊平（与 `themes/link.css` 的 `&:is(…)` 同一处理）⇒ **不引入新浏览器要求**。
- **无副作用（逐条排除）**：
    1. 作用域 = 该 `<style>` 块（**非 scoped**，但整块挂在 `.task-date-selector-panel` 下）⇒ 只影响任务时间面板，其它 7 处 picker 不受影响；
    2. **未用 `!important`**（R-E 要求）；
    3. 清除键是 `position:absolute` 相对 `__trigger` 定位，trigger 拉满后清除键落在整行右端 —— 与 1.13.0 时「清除图标在整行按钮 `__append` 末尾」**位置等价**；
    4. 同批另一处选择器依赖 `.nue-select--project-selector :deep(.nue-button)`（后代选择器）——实测新结构 `root=DIV.nue-select.nue-select--project-selector`、`button` 仍在根内 ⇒ 仍匹配，**无需改动**（与 T628 §3.2 判定一致）。
- **未实测项**：`getBoundingClientRect().width` 的升级前后数值（jsdom 无布局引擎；不做无头浏览器截图对比是项目纪律）⇒ **不伪证**，交走查项 ⑤「面板内 picker 宽度与升级前一致」。

### §2.3 AC13 偏差（必须由 PM / arch 判定 AC 文字）

AC13 原文要求：`search-filter-bar.test.ts:134-142` 的「一次按键一次上抛」逐次索引断言**一行未改**且转绿。**实测该文件被改动了 3 行**：

| 位置 | 升级前（`cefac3b4`）                        | 现在                                                               |
| :--- | :------------------------------------------ | :----------------------------------------------------------------- |
| 断言 | `emitted('toggleArchived')?.[1]` = `[true]` | = `[false]`                                                        |
| 新增 | —                                           | 两次按键之间 `setProps({ includeArchived: … })`（模拟父级回写 ×2） |
| 新增 | —                                           | `expect(emitted('toggleArchived')).toHaveLength(3)`                |

**我的判定：这是必要的口径更新，不是放宽；但「一行未改」的字面判据不成立，需订正 AC 或追认。**

理由：

1. `1.15.3` 起上游 `NueSwitch` 是**有状态 toggle**（内部 `ref` + `watch(modelValue)`），点击/按键它自己翻转并发 `update:modelValue`。旧断言 `[1] = [true]` 之所以成立，是因为升级前**我们自己**的 `@keydown.enter` 直接 `emit(!props.includeArchived)`，永不看内部状态 —— 那条 `[true]` 恰恰是**双实现**（上游不处理键盘）的产物。
2. 生产环境是**受控用法**：`apps/web/src/views/index/search/entry.vue:319` 是 `@toggle-archived="includeArchived = $event"`，父级同步回写 ⇒ 测试里补 `setProps` 与真实用法**同构**；不补才是在测一个不存在的用法（内部状态与 prop 发散）。
3. **强度未降，反而加严**：逐次索引断言（`[0]`/`[1]`/`[2]`）**保留**，并新增 `toHaveLength(3)`。变异 M2（把 `@keydown.enter` 加回）下本用例**红**，报错为
   `expected [ true ] to deeply equal [ false ]`（索引错位）与 `expected [[true],[true],[true]] to have a length of 2 but got 3` ⇒ 双实现**杀得死**。
4. 附带证据：`reminder-panel` 同口径删 4 组自建 a11y 后，`settings-ia.test.ts` 的「`[role="switch"]` 均具可访问名」循环仍绿（`:aria-label` 保留）。

> 待办（非本单可改）：AC13 文字改为「逐次索引断言与『每次恰好一次上抛』语义不变（允许按上游有状态语义补受控驱动）」，或由 arch 追认本条变更。

## §3 测试口径是否被放宽（对照 `T628 §4` 末 7 条红线，逐条核对）

| #   | 红线                                                     | 现状                                                                                                     | 结论           |
| :-- | :------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :------------- |
| 1   | `href` 非空**且** `= router.resolve(path).href`          | `t603` AC1①②③④ 全部用 `toEqual([...expected])`；本单 AC3 新增用例同口径                                  | 守住           |
| 2   | `tabIndex >= 0` **且** `focus()` 后 `activeElement` 命中 | `t603` AC3①②③ 逐锚点断言，两条都在（未删 `focusHits`）                                                   | 守住           |
| 3   | 可访问名非空（`aria-label \|\| title \|\| textContent`） | `accessibleName()` 原样保留；本单 AC13 另加「8 个开关全覆盖」不变量                                      | 守住           |
| 4   | 无 `a[to]` 残留、无 `[object Object]`                    | `t603` AC4①a–d 四条原样                                                                                  | 守住           |
| 5   | 点击 `defaultPrevented = true` 且 router 路径变化        | `t603` AC4② 原样（真实 `MouseEvent` + `flushPromises` 后比对 `currentRoute.path`）                       | 守住           |
| 6   | 焦点环只准换断言层面（源级 + 走查），不准删该项          | 源级：`link-focus-ring.test.ts`（含 `sourceOf()` 防伪 + 规则块内两条声明 + 产物 CSS 复核）；走查：清单 ② | 守住           |
| 7   | `search-filter-bar` 的「一次按键一次上抛」逐次索引断言   | 索引断言保留 + 新增 `toHaveLength(3)`；值改为受控语义（见 §2.3，**已在报告显式申报**，非静默放宽）       | 守住（附申报） |

## §4 变异探针（4 处，全部被杀；含 1 处「既有用例杀不死」的发现）

流程：备份 → 改 → 跑指定用例 → 记红 → `git checkout --` 还原 → `sha1sum` + `cmp` 双重确认逐字节一致。

| 变异 | 内容                                                                                                              | 目标用例                                                                                        | 结果                                                                                                                                                                                                                                                                              | sha1 前后（一致）                                                 |
| :--- | :---------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------- |
| M1   | `apps/web/src/components/app/aside/aside.vue`：`:theme="{ route: true, 'route-icon': true }"` → `theme="route"`   | ① 本单 `t633-ac1-route-icon-class`（应红）② 既有 `t603-nav-a11y`（对照）                        | ① **红 2 例**，报错 `第 1 个导航项缺 nue-link--route-icon…实测 class="nue-link--actived router-link-exact-active nue-link nue-link--route"`；② **绿 13/13** ⇒ **既有用例杀不死**（其 `--route-icon` 断言只落在合成 `h(NueLink, …)` 上，不覆盖真实入口）⇒ 本单新增用例正是补这条   | `1dd86c56…fd33` → 改 `ae44328a…8f53` → 还原 **`1dd86c56…fd33`** ✓ |
| M2   | `search-filter-bar.vue`：给 `nue-switch` 加回 `@keydown.enter.prevent="emit('toggleArchived', !includeArchived)"` | `search-filter-bar.test.ts`                                                                     | **红 2 例**：① `Enter / Space 可切换…` ⇒ `expected [ true ] to deeply equal [ false ]`；② `只上抛 toggleArchived，不触发其它维度 / 清空 / 保存事件` ⇒ `expected [[true],[true],[true]] to have a length of 2 but got 3` ⇒ **双实现必红，且报具体哪两条**                          | `aa278e1b…29d3` → 改 `86edfb2c…5c17` → 还原 **`aa278e1b…29d3`** ✓ |
| M3   | `apps/web/src/themes/link.css`：删除整个 `.nue-link:focus-visible { … }` 规则块                                   | `link-focus-ring.test.ts`                                                                       | **红 1 例**：`expected -1 to be greater than or equal to 0`（`indexOf` 未命中）                                                                                                                                                                                                   | `ddb13e6c…de20` → 改 `6f890ffa…66d` → 还原 **`ddb13e6c…de20`** ✓  |
| M4   | `smart-list.vue`：删掉 `theme="route"`                                                                            | ① 既有 `smart-list.test.ts`（T523 表头，对照）② 既有 `t603-smart-list-href.test.ts`（AC3 正主） | ① **绿 9/9**（该文件用 `RouterLinkStub` 且不断言 `--route`，本就不覆盖此面）；② **红 2 例**：AC2② 与 AC2③ ⇒ `expected 'nue-link' to contain 'nue-link--route'` ⇒ **既有用例杀得死**。⇒ 首轮把对照选成 ① 才误判「杀不死」，**复核后确认 AC3 无缺口**，本单临时新增的重复用例已撤除 | `16318d78…0079` → 改 `a12b4333…d925` → 还原 **`16318d78…0079`** ✓ |

- **没有「杀不死」的变异**（4/4 全杀）。**M1 暴露的覆盖缺口是真实存在的**（图标入口的 `--route-icon` 只被合成挂载断言覆盖），已如实标注并**由新增用例（不改既有断言）**补齐后重跑验证；M4 复核后确认既有用例已覆盖，本单据此撤除了自己新增的重复用例。
- 为什么不改既有断言：PM 纪律 + `T628` 反指标（「为过门禁放宽既有断言 = 打回」）。新增文件只**加覆盖**，不动 `t603` / `smart-list.test.ts` 的语义。

## §5 批末门禁（9 项，精确数字）

| #   | 项目                                | 命令                                                                                           | 结果                                                                                                                                      |
| :-- | :---------------------------------- | :--------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 格式 + lint + 类型                  | `pnpm exec vp check`                                                                           | **exit 0** —— `All 1813 files are correctly formatted` / `Found no warnings, lint errors, or type errors in 1468 files`                   |
| 2   | 全仓测试（非子目录）                | `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vp test --run`                            | **exit 0** —— **350 文件**（349 passed / 1 skipped）· **2842 例**（2836 passed / 6 skipped）· **红 0** · 183.38s                          |
| 3   | `guard:ddd`                         | `pnpm run guard:ddd`                                                                           | exit 0 ——「domain 包未引用 shared 根桶 / shared 展示层组件 / ResponseDataPagination」                                                     |
| 4   | `guard:barrel-imports`              | `pnpm run guard:barrel-imports`                                                                | exit 0 —— 扫描 **1468 文件** · 校验 **1614 条** `@nao-todo` 导入 / **2357 个命名**，均可解析                                              |
| 5   | `guard:gate-pathspec`               | `pnpm run guard:gate-pathspec`                                                                 | exit 0 ——「门禁命令 pathspec 均存在」                                                                                                     |
| 6   | `guard:mobile-imports`              | `pnpm run guard:mobile-imports`                                                                | exit 0 —— 移动端 **72 个源文件**，未引用 `persistence-local` / `persistence-sync` / `dexie` / infrastructure 根桶                         |
| 7   | `guard:test-location`（计入新测试） | `pnpm run guard:test-location`                                                                 | exit 0 —— **342 个受检测试文件**（基线 `0e033e65` = **339**，本单 +3；另 8 个移动端白名单未检查）                                         |
| 8   | `webapp build`                      | `pnpm exec vp run webapp build`                                                                | **exit 0**（17.2s）· 产物 `apps/web/dist`（470 文件）                                                                                     |
| 9   | `desktop:build` + 移动端红线        | `pnpm run desktop:build` · `git status --porcelain -- packages/presentation-react apps/mobile` | build **exit 0**（16.50s）；红线 **0 行**（另：`git diff --name-only cefac3b4..HEAD -- packages/presentation-react apps/mobile` = **0**） |

> 口径说明：全仓测试「1 skipped 文件 / 6 skipped 例」在升级前基线即存在（既有跳过项），非本批引入；红数 0。

## §6 NFR 体积对照（判据 `<1%`）

方法：`git worktree add /tmp/nue-pre cefac3b4`（升级前）→ 各自 `pnpm install --frozen-lockfile` + `pnpm exec vp run webapp build` → 比 `apps/web/dist`；**两侧构建配置零差异**（`git diff cefac3b4..HEAD -- apps/web/vite.config.ts vite.config.ts` = 空，仅 `package.json` 版本行 + 锁文件变化）；gzip 口径 = 逐文件 `gzip -9` 后求和（两侧同法）；测完 `git worktree remove`。

| 指标       | 升级前（`cefac3b4`） | 升级后（HEAD） |     增量 |       百分比 |
| :--------- | -------------------: | -------------: | -------: | -----------: |
| JS 原量    |          1,284,140 B |    1,285,250 B | +1,110 B | **+0.0864%** |
| CSS 原量   |            390,347 B |      394,105 B | +3,758 B | **+0.9627%** |
| 合计原量   |          1,674,487 B |    1,679,355 B | +4,868 B | **+0.2907%** |
| JS gzip    |            425,605 B |      425,781 B |   +176 B | **+0.0414%** |
| CSS gzip   |             79,558 B |       79,928 B |   +370 B | **+0.4651%** |
| 合计 gzip  |            505,163 B |      505,709 B |   +546 B | **+0.1081%** |
| 产物文件数 |                  472 |            470 |       −2 |            — |

- **六项全部 < 1%**，达标。最紧的一项是 **CSS 原量 +0.9627%**，来源与 PRD 预判一致：`nue-ui-theme-shadlike 0.13.30` 新增 `select.css` / `date-picker.css` / `message.css`（≈143 行）。
- 文件数 −2 是 chunk 合并/搬家的结果（同 `T125` 结论口径：chunk 有搬家、首屏构成不变），不构成本批风险。

## §7 未覆盖项 / 已知边界（如实申报，不替代）

| #   | 项                                                  | 原因                                                                                     | 去向                                   |
| :-- | :-------------------------------------------------- | :--------------------------------------------------------------------------------------- | :------------------------------------- |
| 1   | 面板内 picker 触发按钮**像素宽度**前后一致          | jsdom 无布局引擎；项目纪律不做无头浏览器截图对比                                         | 走查项 ⑤（用户人工）+ §2.2 结构判据    |
| 2   | `:focus-visible` **视觉**结果（2px 环可见）         | jsdom 不计算 `:focus-visible`（伪类不匹配、无级联）                                      | 走查项 ②                               |
| 3   | AC9 头像「坏 src → 好 src 恢复」                    | PM 未派单；jsdom 不做真实图片加载/错误事件                                               | 走查项 ⑥（上游 `#109` 保证）           |
| 4   | 侧栏图标导航项**尺寸/颜色**是否与升级前肉眼一致     | 视觉呈现类，按项目纪律交用户                                                             | 走查项 ①（本批**最高风险静默失败点**） |
| 5   | 上游 `#117`（头像首字母回退不可用）                 | PRD 已列非范围；本仓 `initial-avatar` 的 `v-else` 分支自渲染 `icon="user"`，未依赖该路径 | 非范围（不改）                         |
| 6   | 桌面端打包后的观感（`electron-builder --dir` 产物） | 视觉/真机走查由用户执行；本单只验 `desktop:build` exit 0                                 | 后续用户走查（非本批 AC）              |

## §8 遗留三出口（`task-completion.md` 口径）

| #   | 遗留项                                                                                          | 出口                                                                |
| :-- | :---------------------------------------------------------------------------------------------- | :------------------------------------------------------------------ |
| L1  | **AC13 文字与实现偏差**（`search-filter-bar.test.ts` 非「一行未改」，属必要口径更新，强度未降） | **转办** → PM / arch-designer 订正 AC13 措辞或追认本条变更（§2.3）  |
| L2  | **AC8 像素宽度未实测**（结构判据通过、产物 CSS 已确认、无 `!important`、作用域封闭）            | **接受（含到期日）** → 用户走查项 ⑤ 回填后关闭；到期 = 本轮走查完成 |
| L3  | `docs/releases/v1.16.4.md`（发版说明，PRD §八要求「说人话」版）**尚未落地**                     | **转办** → PM / RD 在 S5 补齐（不影响代码合并，影响发版）           |

无其它遗留（本单未发现新增缺陷；未修改产品代码，故无回滚面）。

## §9 本单新增文件（3 个测试 + 2 份文档）

| 文件                                                                                           | 例数 | 覆盖                                                                                         |
| :--------------------------------------------------------------------------------------------- | ---: | :------------------------------------------------------------------------------------------- |
| `packages/presentation/task/components/date-selector/__tests__/t633-ac7-datetime-emit.test.ts` |    3 | AC7 三组 emit 快照                                                                           |
| `apps/web/src/components/app/__tests__/t633-ac1-route-icon-class.test.ts`                      |    6 | AC1② 图标入口 `--route` + `--route-icon`（真实挂载 + 4 处源级写法）                          |
| `apps/web/src/__tests__/t633-ac13-switch-single-source.test.ts`                                |    9 | AC13 单一语义源 / AC15 每个开关有可访问名 + 上游 `disabled ⇒ tabindex=-1` / 一次按键一次上抛 |
| `docs/reports/T633-nue-ui-1153-qa-verify.md`                                                   |    — | 本报告                                                                                       |
| `docs/reports/M20261102-nue-ui-1153-user-acceptance.md`                                        |    — | 用户走查清单（8 项，可勾选）                                                                 |

## §10 复验命令速查（可重放）

```text
# AC1
grep -n nue-ui package.json apps/desktop/package.json
git diff cefac3b4..HEAD -- pnpm-lock.yaml | grep '^[+-][^+-]'
# AC4② + 产物确认
grep -n "nue-link:focus-visible" -A 3 apps/web/src/themes/link.css
grep -o "\.nue-link:focus-visible{[^}]*}" apps/web/dist/assets/*.css
# AC6
git grep -n "NaoRouterLink\|shared/components/router-link" -- apps packages   # 期望 rc=1
# AC8 产物级
grep -o "\.task-date-selector-panel__row>\.nue-date-picker[^{]*{[^}]*}" apps/web/dist/assets/task-*.css
# 本单新增用例（定向）+ AC3 归属既有用例
pnpm exec vp test --run packages/shared/components/smart-list/__tests__/t603-smart-list-href.test.ts
pnpm exec vp test --run packages/presentation/task/components/date-selector/__tests__/t633-ac7-datetime-emit.test.ts \
  apps/web/src/components/app/__tests__/t633-ac1-route-icon-class.test.ts \
  apps/web/src/__tests__/t633-ac13-switch-single-source.test.ts
# 门禁
pnpm exec vp check
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vp test --run
pnpm run guard:ddd && pnpm run guard:barrel-imports && pnpm run guard:gate-pathspec \
  && pnpm run guard:mobile-imports && pnpm run guard:test-location
pnpm exec vp run webapp build && pnpm run desktop:build
git status --porcelain -- packages/presentation-react apps/mobile
```