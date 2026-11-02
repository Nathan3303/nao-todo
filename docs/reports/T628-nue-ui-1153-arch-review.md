# T628 · `nue-ui 1.13.0 → 1.15.3` 升级 + `NaoRouterLink` 规避回收 —— 架构评审

- 批次：`M20261102-nue-ui-1153` / `v1.16.4`（PATCH）· 分支 `nao/M20261102-nue-ui-1153`（`9d7343dc`）
- 输入：PRD `docs/prds/2026-11-02-nue-ui-1.15.3-upgrade.md`（9 模块 · R-A…R-G · AC1–AC12）
- 上游事实源：`/home/nathan/Projects/nue-ui` 仓（工作区干净，`master`）—— `packages/components/link/link.vue` · `packages/themes/shadlike/src/components/link.css` · `packages/utils/component.ts`（`parseTheme`）· `packages/hooks/use-calendar/index.ts` · 提交 `74667ab8` / `820a36c9` / `926edb24` / `ab2ad15a` / `b922e13d` / `26b7281d` / `5da96222`
- 评审方式：**只读**（未改源码/测试/配置、未 `pnpm install`、未跑测试、未提交）。**本文所有结论均为源码级证据，未做运行期实测**；标 `【实测项】` 的必须在 `T630` 实施期用真实挂载/真实渲染补证据。
- 关联 ADR：`docs/adr/2026-11-02-nue-ui-upgrade-and-workaround-retire.md`

## §0 可行性结论

**有条件可行（技术签字：有条件通过）。**

- PRD §9 NFR（可访问性 / 兼容性 / 构建与体积 / 依赖面）**可达成**；AC1–AC12 **可测**，但 AC4 的「焦点环」在 jsdom 下不可计算，验收口径须改为「源级断言 + 真实渲染走查」双证（见 §2）。
- 签字附 **5 项前置条件**（C1–C5）与 **5 个待 PM 拍板点**（D1–D5，§7）。未满足前置条件则不签。

| 前置条件 | 内容                                                                                                                      |
| :------- | :------------------------------------------------------------------------------------------------------------------------ |
| C1       | 焦点环**先**落到共用层再做回退（顺序不可颠倒，否则出现「导航链接无焦点环」的空窗）                                        |
| C2       | `switch` 的 5 处**本仓自建 a11y 必须同批拆除**（否则 `search-filter-bar` 用例必红 + 生产双触发）                          |
| C3       | 主题类名映射必须用**对象语法**复刻 `route` / `route-icon`（字符串逗号语法易写错且静默失效，见 §1 D2）                     |
| C4       | AC4 焦点环口径改为「`apps/web/src/themes/link.css` 源级断言 + 真实渲染走查」，不得声称 jsdom 能验证 `:focus-visible` 样式 |
| C5       | AC7 的「4 处 `datetime` 是否传 date-only」须在实施期用**实测值快照**落盘（本评审为源码判定，见 §3）                       |

## §1 Q1 回退等价性：`<nue-link route>` 与 `NaoRouterLink` 是否 DOM / 类名 / 视觉等价

**结论：可等价，但有 6 项差异必须显式处理；其中 2 项（类名语法、焦点环）不做就必然出问题。**

### 1.1 差异清单（穷尽）

| #   | 维度                                                | `NaoRouterLink`（现状）                                                                                  | `nue-link` 1.15.3                                                                                 | 等价性                                     | 依据                                                                                                                                                                                                                                            |
| :-- | :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ | :----------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 根元素 / SPA                                        | `resolveDynamicComponent('router-link')` → `<a>`                                                         | `:is="isRouteMode ? 'router-link' : 'a'"` → `<a>`                                                 | **等价**                                   | 两侧都经 Vue Router 的 `RouterLink`，点击拦截、`aria-current`、`href` 同一实现                                                                                                                                                                  |
| D2  | `.nue-link--route`                                  | 硬编码 `classes` 含 `nue-link--route`                                                                    | 由 `parseTheme(props.theme, 'nue-link')` 产生 ⇒ **必须传 `theme="route"`**                        | **需改写法**                               | `packages/utils/component.ts:10` `parseTheme`：字符串按 **逗号** 切分（`trim().split(',')`），**空格不切** ⇒ `theme="route icon"` 会产出单个类 `nue-link--route icon`（错）                                                                     |
| D3  | `.nue-link--route-icon`                             | `iconLink` prop ⇒ 硬编码该类                                                                             | 只能由 `theme` 产出 ⇒ 需同时出现 `route` 与 `route-icon` 两项                                     | **需改写法（高危）**                       | 同上；`nue-link` 无 `iconLink` prop。字符串须写 `theme="route,route-icon"`；**推荐对象语法**（与原包装件 `a514bc3e` 的历史写法一致）：`:theme="{ route: true, 'route-icon': iconLink }"`                                                        |
| D4  | `.nue-link--route-<size>`                           | `size` prop ⇒ 硬编码该类                                                                                 | `nue-link` **声明了 `size` prop 但完全未使用**（`link.vue` 模板/`classes` 均无引用）              | **陷阱**                                   | 传 `size="small"` 在 1.15.3 **静默无效**；须用 `theme` 的 `route-small`。本仓 11 处**当前无一处传 `size`** ⇒ 无迁移成本，但需写进使用约束                                                                                                       |
| D5  | `active-class`                                      | 硬编码 `nue-link--actived`                                                                               | `routeTarget && !href ? 'nue-link--actived' : ''`                                                 | **等价**                                   | route 形态恒有 `routeTarget` ⇒ 同值                                                                                                                                                                                                             |
| D6  | 内部节点：`prepend`                                 | 无该节点                                                                                                 | `<nue-div v-if="$slots.prepend">` ⇒ 恒渲染 **`<!--v-if-->` 注释占位**（首个子节点）               | **DOM 不同、视觉等价**                     | 上游 `link.test.ts` L-05 基线字符串以 `<!--v-if-->` 开头（`'<!--v-if--><!--v-if--><span class="nue-text …">'`）。注释节点不参与 flex 布局 ⇒ 零可视变化；**唯一风险**是 `:first-child` 类选择器（全仓 `nue-link` 无 `:first-child` 命中 ⇒ 安全） |
| D7  | 内部节点：icon / content / append                   | `nue-icon` → `nue-text.nue-link__content` → `nue-div.nue-link__append`                                   | **同一顺序同一类名**                                                                              | **等价**                                   | 逐行比对上游 `link.vue` 模板                                                                                                                                                                                                                    |
| D8  | `append` 双层嵌套                                   | 包装件产出 `.nue-link__append`，`smart-list` 的 `#append` 内又给一层 `.nue-link__append`                 | 同结构（上游也产出一层）                                                                          | **等价（双层嵌套是既有形态，本批不消除）** | `smart-list.vue:53-57`；改为单层会动 `themes/link.css` 的 `> .nue-link__append` 选择器 ⇒ **不在本批**                                                                                                                                           |
| D9  | attrs 透传（`aria-label` / `draggable` / `data-*`） | 直接落到 `<component>`                                                                                   | `mergeProps(navigation, { title }, attrs)` ⇒ 落到根 `<a>`                                         | **等价**                                   | 上游 `linkAttrs`；`aria-label` 在 4 个图标入口与 `pomodoro/indicator` 是**可访问名唯一来源**，回退后必须仍在 `<a>` 上                                                                                                                           |
| D10 | `title` 语义                                        | 非 prop ⇒ 作为 attr 透传（`smart-list` 传 `:title`）                                                     | **声明为 prop**，再以 attr 形式回写（`props.href \|\| props.title`）                              | **等价**                                   | 落点同为 `<a title="…">`；无 `href` 时不会凭空产生 `title`                                                                                                                                                                                      |
| D11 | `href`                                              | `router-link` 自算                                                                                       | `linkAttrs` 只绑 `to`，**不再绑 `href=undefined`**                                                | **等价（这正是 #108 的修复点）**           | `74667ab8` 的 diff：删掉 `:href="disabled \|\| !href ? void 0 : href"`                                                                                                                                                                          |
| D12 | `to` 残留 / `[object Object]`                       | 无（`to` 是 RouterLink 的 prop）                                                                         | 无（`to` 已声明为 prop，且不再序列化对象）                                                        | **等价**                                   | `74667ab8` 补 `to?: NueLinkRoute`                                                                                                                                                                                                               |
| D13 | 焦点环                                              | 自带 `:focus-visible { outline: 2px solid var(--nue-primary-color-600); outline-offset: 2px }`（scoped） | **上游主题 `link.css` 无任何 `:focus-visible` 规则**（已 grep 两主题全部 CSS：`link.css` 0 命中） | **不等价（缺口）**                         | 见 §2；这是唯一「功能回退」项                                                                                                                                                                                                                   |
| D14 | `disabled`                                          | 无该 prop                                                                                                | 有（`nue-link--disabled` + 不绑任何导航属性）                                                     | **无影响**（本仓 0 处使用）                | —                                                                                                                                                                                                                                               |
| D15 | 空 `.nue-link__content`                             | `v-if="$slots.default"` ⇒ 无默认插槽时**不渲染** content 节点                                            | 同（`<slot>{{ href }}</slot>` 的兜底**不可达**，因为外层 `v-if="$slots.default"` 已挡住）         | **等价**                                   | 4 处图标入口（`aside` / `float-aside` / `aside-v2` / `aside-v2-drawer` / `pomodoro/indicator`）均无默认插槽 ⇒ 两侧都无 content 节点                                                                                                             |

> **PRD 里「空 `.nue-link__content`」这个猜想不成立**：两侧都由 `v-if="$slots.default"` 守住。真正的上游新内部节点是 **`prepend` 的注释占位（D6）**。

### 1.2 11 处调用点回退映射（+ `smart-list` 动态面）

| #   | 文件:行                                                                | 现 props                                                                       | 回退写法（建议）                                                                     |
| :-- | :--------------------------------------------------------------------- | :----------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| 1   | `apps/web/src/components/app/aside/aside.vue:49`                       | `icon` `route` `aria-label` `icon-link`                                        | `<nue-link :icon :route :aria-label :theme="{ route: true, 'route-icon': true }" />` |
| 2   | `apps/web/src/components/app/aside/float-aside.vue:60`                 | 同上                                                                           | 同上                                                                                 |
| 3   | `apps/web/src/components/app/aside-v2/aside-v2.vue:87`                 | 同上                                                                           | 同上                                                                                 |
| 4   | `apps/web/src/components/app/aside-v2/aside-v2-drawer.vue:86`          | 同上                                                                           | 同上                                                                                 |
| 5   | `apps/web/src/components/pomodoro/aside/aside.vue:41`                  | `icon` `route` + 默认插槽                                                      | `theme="route"`                                                                      |
| 6   | 同上 `:44`                                                             | 同上                                                                           | 同上                                                                                 |
| 7   | 同上 `:45`                                                             | 同上                                                                           | 同上                                                                                 |
| 8   | 同上 `:48`                                                             | 同上                                                                           | 同上                                                                                 |
| 9   | `apps/web/src/components/tasks/aside/aside.vue:48`                     | `icon` 对象 `route` + `#append`                                                | `theme="route"`                                                                      |
| 10  | 同上 `:85`                                                             | 同                                                                             | `theme="route"`                                                                      |
| 11  | `packages/presentation/pomodoro/components/indicator/indicator.vue:65` | `icon` `route` `aria-label` `icon-link`                                        | 对象语法（同 #1）                                                                    |
| +   | `packages/shared/components/smart-list/smart-list.vue:43`              | `route` `icon` `title` `draggable` `data-drag-item` `data-drag-id` + `#append` | `theme="route"`                                                                      |

> 全量 `grep -rn "<nao-router-link" --include=*.vue apps packages` = **11 处**（PM 计数正确）；`smart-list` 为动态面，不在这 11 处内。

## §2 Q2 焦点环归属：上游有没有？没有 ⇒ 落点在哪

**结论：上游 1.15.3 的 `nue-link` 没有焦点环。必须由本仓补「一次」，落点 = `apps/web/src/themes/link.css`（项目主题覆盖层，单点）。**

**证据（源码级）**

1. 上游 `packages/themes/shadlike/src/components/link.css` 与 `glass/.../link.css`：全文 **0 处** `:focus-visible`（已 grep 两主题全部 CSS，仅 `input/switch/select/date-picker/message/button` 有）。
2. `nue-link` 组件内部无 `<style>` 块（`link.vue` 全文无 style）。⇒ 上游不做焦点环是**设计现状**，不是本版回归；但我们的规避件自带，回退即**功能回退**（R-C 违反）。
3. 现状焦点环来自两处：
    - `packages/shared/components/router-link/router-link.vue:48`（scoped，随包装件一起删除）；
    - `apps/web/src/components/tasks/aside/aside.vue:141`（scoped `.nue-link:focus-visible`，为 DEF-124 的原生 `button` 补的，**会随组件根 scope-id 继承继续作用于子组件根**，因此只有任务侧栏「碰巧」还亮，其它侧栏全暗）。

**建议落点（唯一）**：`apps/web/src/themes/link.css`

- 该文件是**本仓既有的 `.nue-link` 项目级覆盖层**（已含 `.nue-link--route` 的定制），由 `apps/web/src/themes/index.ts` 引入；`apps/web/src/main.ts` 与 `apps/desktop/src/renderer/src/main.ts` 都 `import '@/themes'` ⇒ **Web + 桌面端一处覆盖两端**（`apps/desktop/electron.vite.config.ts` 的 `@` → `../web/src`）。
- 声明与现口径**逐字一致**：`outline: 2px solid var(--nue-primary-color-600); outline-offset: 2px;`（不新增 token，符合「不另创体系」）。
- 顺带统一 3 处重复实现（`router-link.vue` 删除后剩 `tasks/aside` `:141`、`sign-in.vue:201`、`sign-up.vue:145`）。**本批只加不删**（删属去重清理，AC12 范围外；且保留它们等于多一层保险）。

**可断言口径（AC4 要能测到）**

- **必须改口径**：jsdom **不计算** `:focus-visible` 样式（无 CSSOM 级联，且 `:focus-visible` 伪类不匹配）⇒ 「断言到具体样式值」只能在**源码层**做：
    1. 新增/复用 `apps/web/src/themes/__tests__/*.test.ts` 模式（`button-overrides.test.ts` 已示范 `import.meta.glob(..., { query: '?raw' })` + `sourceOf()` 防「glob 写错恒真」）：断言 `link.css` 源内存在 `.nue-link:focus-visible` 且含 `outline: 2px solid var(--nue-primary-color-600)` 与 `outline-offset: 2px`；
    2. 运行期断言只到「可聚焦 + `focus()` 命中 `activeElement` + 有可访问名」（`t603` 现有三重证据，**不得削弱**）；
    3. 视觉走查清单一项：「键盘 Tab 到侧栏导航项 ⇒ 可见 2px 环」（用户执行）。
- **禁止**：每处调用点各写一份；也**不建议**给上游提 patch/覆写 `nue-ui` 包内 CSS（主题包升级即失效）。

## §3 Q3 跨版本 4+1 项行为变更的落点

**先说一件 PRD 未列但已核实无影响的事**：`v1.15.0` 还含 `3057a7d6`（`nue-calendar` 新增 `valueFormat`）。本仓 `<nue-calendar` 用量 **0**（`grep -rn "<nue-calendar" --include=*.vue apps packages` = 0，命中的 `nue-calendar-*` 均是我们自己的 class 名）⇒ **无影响**。`8a498519`（滚动契约）只改 **glass** 主题，本仓用 shadlike ⇒ 无影响。

### 3.1 `1.14.0` a11y（`b922e13d`）——**命中面最大，且是必须改的**

| 变更                                                                                                                                       | 本仓命中                                                                                                                                                          | 结论                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| :----------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NueSwitch` 根补 `role="switch"` / `:aria-checked` / `:aria-disabled` / `:tabindex`（disabled 时 `-1`）/ `keydown.enter` / `keydown.space` | `nue-switch` **8 处**：`search-filter-bar.vue:271`(1) · `reminder-panel.vue:144/166/184/256`(4) · `timer-setting.vue:129/156`(2) · `task-remind-setter.vue:36`(1) | **5 处（search 1 + reminder 4）已自建同一套 a11y ⇒ 升级后变成双实现**：`role`/`aria-checked`/`tabindex` 是 fallthrough，会**覆盖**组件内部值；`@keydown.enter` / `@keydown.space` 与组件内部监听**同时在同一个根元素上触发** ⇒ 一次按键**两次上抛**。`reminder-panel` 的 `tabindex="0"` 还会把 `disabled` 开关重新拉进 Tab 序（覆盖内部 `-1`）。<br>**必须同批拆除**这 5 处的 `role` / `:aria-checked` / `tabindex` / `@keydown.*`（保留 `:aria-label`）。 |
| 同上                                                                                                                                       | 用例命中：`apps/web/src/components/search/__tests__/search-filter-bar.test.ts:134-142`（Enter / Space 各断言 `emitted('toggleArchived')[0]` / `[1]` / `[2]`）     | 双实现下 Enter 会 emit 两次 ⇒ **索引断言必红**。拆除后由组件内部 `handleClick` → `update:modelValue` → 我们的 `@update:model-value` 上抛，**断言强度不变、仍恰好 1 次**（`state` 由 `watch(modelValue, {immediate})` 同步，故 `aria-checked` 仍随 `:model-value` 翻转）。                                                                                                                                                                                  |
| 同上（无自建 a11y 的 3 处）                                                                                                                | `timer-setting.vue` ×2、`task-remind-setter.vue` ×1（标签是**兄弟** `<nue-text>`，非 `<label>`）                                                                  | 升级后这 3 个开关**新进 Tab 序但无可访问名**（上游只靠 fallthrough 的 `aria-label`/`aria-labelledby`）。建议补 `aria-label`（属「可访问性只增不减」的**补齐**，不是范围扩大）——见 D3。                                                                                                                                                                                                                                                                     |
| `NueInput` 新增 `inputAttrs`                                                                                                               | `nue-input` 多处                                                                                                                                                  | **可选、默认不改变任何落点**（上游明示未动 `inheritAttrs`，且 `v-bind="inputAttrs"` 置于显式属性之前）⇒ 无影响，无迁移动作。                                                                                                                                                                                                                                                                                                                               |
| input clear / eye 补 `role`/`tabindex`/`aria-label`                                                                                        | 现有用例按 `.nue-input__icon-button` 类名取，不按 tabindex 计数                                                                                                   | 无影响。⚠️ 但 `settings/dialog/__tests__/settings-ia.test.ts:820` 的「每个可交互控件都有可访问名」循环选择器含 `[role="switch"]`，`reminder-panel` 的 4 个开关**本已带 `aria-label`** ⇒ 拆除自建 a11y 时**不得**把 `:aria-label` 一起删（否则该用例红）。                                                                                                                                                                                                  |

### 3.2 `1.15.0` select / date-picker 清除键结构变化 + message 关闭键 + textarea `inputAttrs`（`ab2ad15a`）

- **结构**：`.nue-select` / `.nue-date-picker` 的根仍是 `nue-dropdown`，但 `#trigger` 内新增一层 `div.nue-select__trigger` / `div.nue-date-picker__trigger`（`width: fit-content; position: relative`），清除控件从 `nue-button > .nue-button__append > i` 变为**同级原生 `<button class="…__clear">`**。
- **本仓样式依赖面（已穷尽 grep，排除 `dist`）**：
    | 位置                                                                                     | 选择器                                                                                                                           | 新结构下                                                                                                                                                                                                                                                                                                                                 |
    | :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `packages/presentation/task/components/date-selector/task-date-selector.vue:197-207`     | `.task-date-selector-panel__row > .nue-date-picker` + 后代 `.nue-button { width:100%; border:none; box-shadow:none; padding:… }` | **仍匹配**（后代选择器），但 `width:100%` 的**包含块**从「按钮自身是根」变成「`fit-content` 的 trigger div」⇒【实测项 1】测量面板内 picker 触发按钮的 `getBoundingClientRect().width` 升级前后是否一致；若变窄 ⇒ 补 `.task-date-selector-panel__row > .nue-date-picker > .nue-date-picker__trigger { width: 100% }`（不用 `!important`） |
    | `packages/presentation/task/components/project-selector/task-project-selector.vue:52-58` | `.nue-select--project-selector :deep(.nue-button) { max-width:12rem }`                                                           | 仍匹配 ⇒ 无动作                                                                                                                                                                                                                                                                                                                          |
    | `apps/web/src/themes/link.css` 等其余                                                    | 无 `.nue-select__*` / `.nue-date-picker__*` / `.nue-button__append` 依赖                                                         | 无动作                                                                                                                                                                                                                                                                                                                                   |
- **用例面**：`grep -rln "nue-select\|nue-date-picker" --include=*.test.ts apps packages` = **0 文件** ⇒ 无既有断言依赖旧嵌套；AC8 需**新增**实测（清除生效 / `disabled` 跟随 / 键盘可达 / 抽查 ≥2 处实际渲染宽度）。
- **message 关闭键**：本仓 message 走 `usePopupPool` 自建容器（`NueMessage` 直接 import），关闭控件是自有实现 ⇒ 上游变化仅带来主题 `message.css` 新增焦点环，**无冲突**（本仓 `message` 相关自定义样式在 `use-calendar-schedule` 的 `:deep` 里，选择器为 `.nue-message-node-inner__extension`，未触关闭键）。
- **textarea `inputAttrs`**：`nue-textarea` **10 处**，全部无 `inputAttrs`，attrs 落点不变 ⇒ 无动作。

### 3.3 `1.15.1` date-picker 西半球时区（`26b7281d`）

- 只改 `displayValue`：`datetime` + 带 `T`/空格 → 同旧逻辑；其余 → `parseDate()`（该函数**本身支持 ISO 变体**，`packages/utils/date-utils.ts:125` 对 `^\d{4}-\d{2}-\d{2}(T| )` 会 `new Date()` 后取本地三段）⇒ **`type="date"` 收到 ISO 值也不会退化成裸串**（此前担心的「触发器显示 `2026-11-02T16:00:00.000Z`」不成立）。
- 本仓命中：`nue-date-picker` **8 处 = 4 `datetime` + 4 `date`**（PRD 写「3 处 date」，实测 **4 处**：多出 `apps/web/src/components/calendar/monthly/reschedule-menu.vue:122`）。东八区（本项目主时区）本无错一天现象 ⇒ **无可视变化**；`TZ` 相关无既有用例。

### 3.4 `1.15.2` date-only ⇒ `00:00`（`5da96222`）——**R-D 专项**

**改的是什么**（读码，`packages/hooks/use-calendar/index.ts`）：

- 只改 `parseDateTime()` 的**兜底分支**：值里没有可用时刻段（date-only / 不可解析）时，面板 `currentHour/currentMinute` 由「当前时刻」改为 `0/0`。
- 触发链：`watch(modelValue)` → `parseDateTime` → 面板时分；用户再点日期 ⇒ `handleDateSelect` 用 `currentHour/currentMinute` 组装 → `serializeValue(..., 'iso')` → **emit**。
- **注意**：`modelValue` 为空（`''`/`null`）走的是 **else 分支（时分 = 现在）**，该分支**未改**。

**本仓 4 处 `datetime` 是否传 date-only 串？——不传。**

| 站点                              | 值来源                                                         | 形态                                                                                                                                                                                                                                             | 是否受影响 |
| :-------------------------------- | :------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| `task-date-selector.vue:121/134`  | `handleBeforeOpen`: `props.startAt` / `props.endAt`（任务 VO） | 全仓写入口一律 `.toISOString()` / `dayjs().endOf('day').toISOString()`（`use-calendar-day.ts:76` · `use-calendar-monthly.ts:195/233/234/248` · `reschedule.ts:135` · `task-date-selector.vue:92` 保存即 `dayjs(v).toISOString()`）⇒ **恒带 `T`** | 否         |
| `task-multi-select-panel.vue:161` | 本地 `endAt` 初始 `''` ⇒ 选完即 ISO                            | `''` → else 分支；ISO → `includes('T')` 分支                                                                                                                                                                                                     | 否         |
| `reschedule-panel.vue:95`         | `rescheduleDate = ref('')`，选完 `dayjs().toISOString()`       | 同上                                                                                                                                                                                                                                             | 否         |

**判定与建议：不改调用方、不改口径。** 理由：`00:00` 只在「喂 date-only 串」时可达，而本仓**从不产生 date-only 值给 `datetime` 选择器**（后端任务时间字段只存完整 ISO；日历侧落 `endOf('day')` 亦是完整 ISO）。AC7 只需：

1. 记录 8 处 picker 的 `type` 与取值链（上表）；
2. **实测值快照 3 组**（每组给升级前后 emit 值）：`datetime` + ISO 值点改日期 / `datetime` + `''` 点日期（**应保持「现在时刻」**，是 else 分支，锁住「未被一并改掉」）/ `datetime` + date-only 串点日期（**应为 `00:00`**，锁住上游新口径，同时证明「本仓不产生此输入」）；
3. 明确写进报告：「本仓无 date-only 输入 ⇒ 用户可感知行为不变」。

### 3.5 `1.15.3` 三单

| 变更                                         | 本仓命中                                                                                                                                                                                | 结论                                                                                                               |
| :------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `NueLink` route 出 href（`74667ab8`）        | §1 全部                                                                                                                                                                                 | 这是本批的**前提事实**；回退后 AC2/AC3/AC5 由它保证                                                                |
| `NueAvatar` src 变更复位错误态（`820a36c9`） | `nue-avatar` **7 处**：`app/aside:25` · `float-aside:34` · `avatar-updater:67` · `avatar-viewer:16` · `initial-avatar:43/57` · `comment-row:77`；`src` 全部来自 computed ⇒ 换地址即重试 | **纯增益**。AC9 用「坏 src → 好 src」真实挂载断言；「同 src 不重试」由上游 watch 语义保证                          |
| `NueSwitch` 默认插槽（`926edb24`）           | 8 处全部**自闭合**或无内容 ⇒ `isEmptySlot` 判空 ⇒ **不新增空 `.nue-switch__text` 占位**                                                                                                 | 无影响；`search-filter-bar.vue:268` 那句注释「NueSwitch 忽略默认插槽」已成**陈旧注释**（不改代码，仅文档订正可选） |
| 上游已知缺口 `#117`（头像首字母回退不可用）  | `initial-avatar.vue:43-63` 走的是「有 initial 就渲染 `nue-avatar` + 默认插槽」                                                                                                          | **PRD 已列非范围**；确认本仓未依赖该回退路径（`v-else` 分支自己渲染 `icon="user"`）⇒ 维持非范围                    |

## §4 Q4 测试口径边界：改 vs 不改

### 必须改（口径随依赖更新，**强度不变**）

| 文件                                                                                     | 改什么                                                                                                                                                                                                                                                               | 为什么必须                                                                                              |
| :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| `apps/web/src/components/app/__tests__/t603-nav-a11y.test.ts`                            | ① 头部注释「现状 = `nue-link` 无 `href`」→ 改为「上游 `#108` 已修（1.15.3）；本用例锁 route 形态可达性」；② 删 `import { NaoRouterLink }`；③ `mountNaoRouterLink()` → `mountNueLink()`（`h(NueLink, { route, icon, theme: … })`）；④ `AC1②` / `AC4①b` 标题与文案改名 | AC6 要求 `NaoRouterLink` grep = 0；且该文件**直接 import 了要删的模块** ⇒ 不改则编译失败                |
| 同上                                                                                     | ⑤ `AC1③/④` 的 `expect(className).toContain('nue-link--route')` **保留并加严**：图标入口额外断言 `nue-link--route-icon`                                                                                                                                               | 这正是回退后**最容易静默出错**的点（D2/D3 的 theme 语法）。现在断言它 = 把「类名映射正确」变成可测事实  |
| `apps/web/src/components/app/aside-v2/__tests__/aside-v2.test.ts:78`                     | stub 键 `'nao-router-link'` → `'nue-link'`                                                                                                                                                                                                                           | 用例 `:105` 断言 `.stub-nav-link` 数量 = 2；组件已不存在 ⇒ stub 不命中 ⇒ **必红**                       |
| `apps/web/src/components/app/aside-v2/__tests__/aside-drawer-tools.test.ts:130`          | 同上（无 `.stub-nav-link` 断言，但同样要改名保持一致）                                                                                                                                                                                                               | 避免未知组件告警 / 与真实组件行为分叉                                                                   |
| `apps/web/src/components/search/__tests__/search-filter-bar.test.ts`                     | **不改断言**，靠产品侧拆双实现变绿（C2）                                                                                                                                                                                                                             | 断言本身是对的（「一次按键 = 一次上抛」）。**若有人为了让红变绿去放宽成 `toHaveBeenCalled()` 就是违规** |
| `packages/presentation-identity/src/components/__tests__/t596-def116-auth-links.test.ts` | 头部前提（「`nue-link` 不可用」）加一行「1.15.3 起已修；本用例锁定的是 auth 互链仍走原生 `router-link` 的现状」                                                                                                                                                      | 只订正事实前提，**不动断言**（auth 互链本批不回退，见 D4）                                              |

### 可以不改

| 文件                                                                                | 理由                                                                                                                                                                                                                                                                                                                                 |
| :---------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/tasks/aside/__tests__/t608-ac6-archive-entry-a11y.test.ts` | 被测对象是**原生 `<button class="nue-link nue-link--route">`**，与 `nue-ui` 版本无关；头注里的「现状」描述的是 **T608 红基线时刻**，作为历史快照仍准确。**建议只加一行「当前形态 = 原生 button（DEF-124 已修）」防误读**，断言一行不动                                                                                               |
| `packages/shared/components/smart-list/__tests__/smart-list.test.ts`                | `globalOptions` 已注册 `NueLink`（真组件）+ `router-link: RouterLinkStub` ⇒ 回退后 `<nue-link>` 命中真组件、其内部 `router-link` 命中 stub，`.nue-link__content` 仍是 `.nue-link` 的**直接子节点**（上游 `v-if` 注释节点不影响 `>` 选择器）⇒ 无需改动。【实测项 2】跑一次确认 `:164` 的 `:deep(.nue-link > .nue-link__content)` 仍绿 |
| `apps/web/src/views/auth/__tests__/sign-up-redirect.test.ts`                        | 断言对象是原生 `<router-link>` 互链，与 `nue-link` 无关；`:102` 的注释口径过时可顺手订正（可选）                                                                                                                                                                                                                                     |

### 绝对不许放宽（可访问性强度）

1. `href` 非空 **且** `= router.resolve(path).href`（AC2/AC3）；
2. `tabIndex >= 0` **且** `focus()` 后 `document.activeElement` 命中（jsdom 对无 href 的 `<a>` 也报 `tabIndex 0` ⇒ 单用 tabIndex 无效，这条不可删）；
3. 可访问名非空（`aria-label || title || textContent`）；
4. 无 `a[to]` 残留、无 `[object Object]`；
5. 点击 `defaultPrevented = true` 且 router 路径变化（SPA）；
6. 焦点环**只准换断言层面**（源级 + 走查），**不准删该项**；
7. `search-filter-bar` 的「一次按键一次上抛」逐次索引断言。

## §5 Q5 落地顺序与回滚点

建议 **6 步**（每步一个可独立验收/回滚的提交；squash 前逐步绿）。

| 步     | 内容                                                                                                                                                                 | 验收判据                                                                                                                          | 回滚方式                                     |
| :----- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------- |
| **S0** | **基线数字**：升级前跑一次全仓 `vp test --run`，记录 `文件数 / 例数 / 红数` + 六守卫 exit code（不提交代码）                                                         | 有 baseline 数字，供 AC10 解释差值                                                                                                | 无代码变更                                   |
| **S1** | 依赖升级：根 + `apps/desktop` 的 `nue-ui@1.15.3` / `nue-ui-theme-shadlike@0.13.30`，`pnpm install`，锁文件只允许这两条链变化                                         | `vp check` 0 error；`git diff pnpm-lock.yaml` 只含目标包；全仓 test 仍绿（除 S2 预期红）；`webapp build` + `desktop:build` exit 0 | 版本号两处回改 + `pnpm install`              |
| **S2** | **焦点环集中化**（`apps/web/src/themes/link.css` + 源级断言用例）                                                                                                    | 新增断言绿；**此刻导航链接仍由包装件供环，属双保险**                                                                              | 删两处改动                                   |
| **S3** | **跨版本行为面**（`switch` 拆双实现 5 处 + 3 处补 `aria-label`；`date-picker` 面板/触发器实测与必要时补 `width:100%`）                                               | `search-filter-bar.test.ts` 转绿且断言未动；抽取 2 处 picker 宽度实测值入报告                                                     | 单独 revert 该提交                           |
| **S4** | **回退规避**（11 处 + `smart-list` + 删 `packages/shared/components/router-link/` + `packages/shared/components/index.ts:21` 导出 + 3 个测试桩/断言更新，t603 重写） | **AC2/AC3/AC5/AC6 全绿**；`grep -rn "NaoRouterLink\|shared/components/router-link" apps packages` = 0；全仓 test 绿               | `git revert` 该提交（S2 可保留，环不受影响） |
| **S5** | 文档/台账/发版说明（`docs/releases/v1.16.4.md` 说人话版）+ 缺陷池（`DEF-116` 闭环 + 新登记见 §6）                                                                    | AC10 九项全绿 + 数字差值逐条解释                                                                                                  | 文档单独 revert                              |

**风险最高：S4（回退）**。理由：① 11 处 + 1 动态面 + 删共享组件 + 3 个测试文件同时动；② 主要失败模式是**静默**的 —— `theme` 语法写错（`"route icon"` 用空格 / 漏 `route-icon`）不会报错、不会让 `vp check` 红，只会让**图标型导航项失去方形尺寸与主题色**；③ 用例只覆盖 `nue-link--route` 存在性，`--route-icon` 需要**新增断言**才守得住（这已写入 S4 判据）。次高：**S1**（主题新增 `select.css`/`date-picker.css`/`message.css` ≈143 行，可能造成面板视觉位移，且无既有用例覆盖）。

## §6 Q6 挂账追认：`TaskKanban` 的 `newTaskId`（命令通道）

**结论：有条件接受（追认通过）。**

**是否破坏单向数据流？——否，但它是「prop 承载事件」，不是「prop 承载状态」。**

- 证据链：`use-kanban-view-adapter.ts:85` 只在订阅 `AddNewTaskId` 时写 `newTaskId.value = taskId`；`kanban-view-adapter.vue:101` 单向下传；`use-kanban.ts:86` 只 `watch` 消费；全仓 **0 处** `emit('update:newTaskId')`、0 处子组件回写 ⇒ **无双向绑定、无子→父变更**，单向数据流的硬约束（数据向下、变更向上）未被破坏。
- 真正的问题不是数据流方向，而是**语义类别**：`newTaskId` 表达的是「发生过一次新增」，属**命令/事件**，用 value-identity 的 prop 承载会带来两个固有边界（见下 C2/C3），所以只能在有明确约束时接受。

**为什么没有更轻的等价方案（逐一否决）**

| 备选                                                 | 为什么不采纳                                                                                                                                 |
| :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| A. 只靠 `refreshToken` 重查整板                      | 会把所有列打回第 1 页，直接抹掉用户已加载的分页位置 —— 与 ADR 决策 4（D2「保页」）冲突，属**用户可见回归**                                   |
| B. 模板 ref + `defineExpose({ insertTask })`         | 把编排入口从 prop 变成**隐式命令式调用**：三处页面各持 ref、可测性下降（用例得先拿组件实例）、与既有 `KANBAN_COLUMN_PAGING_KEY` 注册表双入口 |
| C. 把 `subscriber` 下传给 `TaskKanban`，组件内部订阅 | 让纯展示组件直接依赖应用级事件总线（`packages/presentation` 层引入全局总线），耦合更重且脱离页面就失效                                       |
| D. 子组件 `inject` 注册表后由适配器调用              | 方向不成立：注册表是**子**（`TaskKanban`）provide 的，父级适配器 inject 不到                                                                 |
| E. 由父级 emit 反向驱动                              | 事件源在父级之上（全局 `AddNewTaskId`），反向往返徒增一轮                                                                                    |

**接受条件（4 条，建议写进 `types.ts` 的 JSDoc 与用例头注）**

| #   | 条件                                                                                                                                                                       | 现状                                                                                 |
| :-- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| C-1 | 语义固定为「命令通道」：`newTaskId` **只允许**「换值 ⇒ 执行一次插入」，禁止 `update:newTaskId` 回写、禁止当状态/缓存读、禁止参与渲染                                       | 现状满足（无回写）                                                                   |
| C-2 | 单调性前提：**每次新增的任务 id 必须唯一**。若将来出现「同值重复下发」（撤销创建后重建同一 id / 离线重放），watch 不触发 ⇒ 命令丢失，届时须改成 `{ id, seq }` 或单调 token | 现状满足（id 来自创建链路，每次唯一）；**边界须留痕**                                |
| C-3 | `getTask(id)` 必须能在广播时取到（先写 store 再广播），否则 `use-kanban.ts:90` 的 `if (!task) return` 会**静默丢弃**该命令                                                 | 现状满足；T620 AC14 已锁「置顶插入 + `total+1` + 不塌回第 1 页」，保持该断言强度即可 |
| C-4 | 不得成为第二数据源：列内数据唯一来源 = loader + 本地增量                                                                                                                   | 现状满足（`paging.insertTask`）                                                      |

**对 ADR 的处理**：已在 `docs/adr/2026-11-01-kanban-column-paging.md` 决策 2 的「待 arch 追认」后追加追认注记，指向本评审与 `docs/adr/2026-11-02-nue-ui-upgrade-and-workaround-retire.md` 决策 4。

## §7 风险清单

| #   | 风险                                                                             | 影响                                                                                                          | 应对                                                                                                                |
| :-- | :------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------ |
| R1  | `theme` 类名语法写错（空格分项 / 漏 `route-icon`）                               | 图标型导航项失去 `--route-icon` 的方形尺寸、`--route` 的高度/内边距与主题色 ⇒ **视觉回归且门禁全绿**          | C3 强制对象语法；S4 判据新增 `--route-icon` 类断言；用户走查项「图标导航项尺寸/颜色与升级前一致」                   |
| R2  | 焦点环空窗（先回退后补环，或补在 `scoped` 里）                                   | 违反 R-C，AC4 失败                                                                                            | C1 顺序（S2 先于 S4）；落点固定在 `themes/link.css`（web + desktop 共用），**不得**放组件 scoped                    |
| R3  | `switch` 双实现未拆                                                              | 一次按键两次上抛（生产双写/双提示；`search-filter-bar` 用例红；`disabled` 开关被 `tabindex="0"` 拉进 Tab 序） | C2 同批拆除；保留 `:aria-label`；`settings-ia.test.ts:820` 的可访问名循环作为护栏                                   |
| R4  | 主题新增 `select.css` / `date-picker.css` / `message.css`（≈143 行）改变面板布局 | 任务时间面板 / 项目选择器 / 记录筛选的**宽度与内边距**位移                                                    | 抽测 2 处以上实际渲染宽度（含面板内 picker 与项目选择器）；必要时只补 `__trigger { width:100% }`（禁 `!important`） |
| R5  | `smart-list` 的 `theme` 漏写 ⇒ 清单/标签行失去基础样式                           | 侧栏自建清单条目样式崩（用户可见）                                                                            | 与 R1 同一断言覆盖（AC1④ 已断言 `nue-link--route`）                                                                 |
| R6  | 时间语义被 `00:00` 口径顺带改掉（R-D）                                           | 任务时间被静默改写                                                                                            | §3.4 三组快照（尤其 `''` → 仍为「现在」，锁住 else 分支未被改）                                                     |
| R7  | 锁文件被夹带升级                                                                 | 违反 AC1/AC12                                                                                                 | `git diff pnpm-lock.yaml` 白名单核对：只允许 `nue-ui` / `nue-ui-theme-shadlike` 及其传递依赖                        |
| R8  | 依赖回滚不彻底（只改根 `package.json`）                                          | 桌面端仍跑 1.13.0 ⇒ 两端行为分叉                                                                              | AC11 显式断言 `apps/desktop/node_modules/nue-ui/package.json` 版本                                                  |
| R9  | 体积回归                                                                         | 首屏增量 > 1%                                                                                                 | S1 后对比 `webapp build` 产物；超 1% 须说明来源（新 CSS 3 个文件为主要候选）                                        |

## §8 新发现（超出本单范围，按 R-G 登记不改）

| #   | 发现                                                                                                                                                                                                                                       | 建议                                                     |
| :-- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------- |
| N1  | `apps/web/src/components/pomodoro/focus-depend-dropdown/focus-depend-dropdown.vue:129`（触发「专注」）与 `:158`（「取消关联」）用 `<nue-link @click>` **无 `route`/`href`** ⇒ 渲染无 `href` 的 `<a>` ⇒ **键盘不可达**（与 `DEF-124` 同类） | 登记新缺陷（建议编号 `DEF-128` 档；PM 定编号），本批不修 |
| N2  | `packages/presentation-identity/src/components/sign-in.vue:138` / `sign-up.vue:126` 仍是**原生 `<router-link class="nue-link auth-link">` + 自写焦点环**，属同一 `DEF-116` 规避家族，PRD 未列                                              | 见 D4                                                    |
| N3  | PRD 与实测的计数差：`type="date"` 的 date-picker **4 处**（PRD 写 3）；`nue-select` 实测 `<nue-select` = **20 处**（PRD 写 29，疑含 `nue-select-option`）                                                                                  | 订正 PRD 数字，避免 AC 对不上账                          |
| N4  | `search-filter-bar.vue:268` 注释「NueSwitch 忽略默认插槽」已过期（1.15.3 起支持）                                                                                                                                                          | 文档订正时顺手改注释（不改代码逻辑）                     |

## §9 需 PM 拍板的决策点

| #      | 决策点                                                                             | 我的建议                                                                                                                        | 不拍板的后果                                               |
| :----- | :--------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------- |
| **D1** | `newTaskId` 追认（§6）                                                             | **有条件接受**（C-1…C-4 写入 JSDoc）                                                                                            | 挂账继续悬空，后续「同值重复下发」无人守                   |
| **D2** | 焦点环落点与「是否顺手删 3 处重复实现」                                            | 落点 = `apps/web/src/themes/link.css`（单点，web+desktop 共用）；**本批只加不删**（`tasks/aside` / `sign-in` / `sign-up` 保留） | 无落点 ⇒ R-C 无法满足；删重复会让 S4 diff 变大、回归面变宽 |
| **D3** | 3 处无名开关（`timer-setting` ×2、`task-remind-setter` ×1）是否本批补 `aria-label` | **本批补**（升级后它们新进 Tab 序，无名即可访问性赤字；改动 3 行）                                                              | 出现「可达但读屏念不出名字」的新状态                       |
| **D4** | `sign-in` / `sign-up` 的原生 `router-link` 规避是否本批一并回收                    | **本批不做**，登记挂账（它们当前有 `href` + 焦点环 + 可访问名，无用户可见缺陷；顺手改会把身份页互链纳入回归面）                 | 双份实现继续存在（但不产生缺陷）                           |
| **D5** | `N1`/`N2` 等新发现的缺陷编号与归属                                                 | 按 R-G 登记缺陷池，另立小单                                                                                                     | 键盘可达性缺口无声留存                                     |

## §10 技术签字

- **PRD §9 NFRs：有条件通过。** 可访问性（含 `switch` 双语义红线）、兼容性（`inputAttrs` 可选、无 prop 语义变更）、构建与体积（<1% 需实测）、依赖面（白名单）均可达成，前提满足 C1–C5。
- **AC1–AC12：均可行、可测**，三处需改判据：
    1. **AC4** 焦点环改为「`themes/link.css` 源级断言 + 真实渲染走查」双证（jsdom 不计算 `:focus-visible`）；
    2. **AC7** 增补「`datetime` + `''` 点日期仍为『现在时刻』」一组快照（守住 `5da96222` 未触 else 分支）；
    3. **AC8** 增补「面板内 picker 触发按钮宽度前后一致」的实测数字（R4）。
- **不签字项：无。** 未发现需要打回 PM 或降级的需求项。
- **性能/安全：按 PRD §6 不在本批范围**（不涉及数据面与网络契约）。唯一可量化指标 = 首屏体积增量（评审 R9）：以 `webapp build` 产物体积对比为判据，> 1% 须说明来源（候选：新增 `select.css` / `date-picker.css` / `message.css` ≈143 行）。

## §11 参考来源

| 来源                | 位置                                                                                                                  | 结论                                                                                                                          |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| 上游 `NueLink` 实现 | `/home/nathan/Projects/nue-ui/packages/components/link/link.vue`（`master`，含 `74667ab8`）                           | route 形态只绑 `to`；类名全部由 `theme` 产生；无 `iconLink`、`size` 未使用；无 style 块                                       |
| 上游主题            | `packages/themes/shadlike/src/components/link.css`、`glass/.../link.css`                                              | **0 处 `:focus-visible`** ⇒ 焦点环须本仓补                                                                                    |
| `parseTheme`        | `packages/utils/component.ts:10`                                                                                      | 字符串按**逗号**切分；对象按「值为真」的键 ⇒ 类名映射必须用逗号或对象语法                                                     |
| 上游链接用例        | `packages/components/link/__tests__/link.test.ts`（L-01…L-06）                                                        | 路由形态 `href = router.resolve().href`、无 `to` 残留、`disabled` 不可聚焦；`href` 形态 `innerHTML` 基线含 `<!--v-if-->` 占位 |
| `use-calendar`      | `packages/hooks/use-calendar/index.ts`（`5da96222` 后）                                                               | `00:00` 只在「值无时刻段」的兜底分支；空值仍取「现在」                                                                        |
| `parseDate`         | `packages/utils/date-utils.ts:125`                                                                                    | 支持 ISO 变体 ⇒ `type="date"` 收 ISO 值不会退化为裸串                                                                         |
| 上游发版说明        | `docs/releases/nue-ui-1.15.3.md`                                                                                      | 明示「无破坏性变更」；`href` 优先于 route（文档订正项）                                                                       |
| 本仓规避件          | `packages/shared/components/router-link/router-link.vue`（`f9daabf7`）· 历史版本 `a514bc3e`                           | 历史版本用 `theme` 对象语法调 `nue-link` ⇒ 回退写法有现成范式可循                                                             |
| 本仓焦点环现状      | `apps/web/src/components/tasks/aside/aside.vue:141` · `presentation-identity/.../sign-in.vue:201` · `sign-up.vue:145` | 三处 scoped 重复；`themes/link.css` 为既有项目覆盖层（web+desktop 共用）                                                      |