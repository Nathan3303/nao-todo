# 2026-09-10 SHELL-02：桌面端同步状态并入侧栏轨道（跨端宿主契约 + 堆叠基线治理）

- **评审对象**：SHELL-02 PRD 摘要 + 第二轮《交互定稿》（用户拍板：现成组件组合 = Tooltip + Dropdown + Button）
- **结论**：✅ **有条件可行**（约束 C1–C16；待拍板 D2/D5）
- **评审日期**：2026-09-10（架构评审终签日；第二轮复核同日）
- **范围**：`apps/web` 侧栏注入点 + `apps/desktop` `SyncStatusBar` 改造；无后端改动
- **代码边界**：本 ADR 为纯文档产出，评审方不修改仓库代码（零代码红线；验证用探针置于仓库外 `~/shell02probe`）

## 修订记录

| 轮次   | 日期           | 变更                                                                                                                                                                                                                                                                                                                                               |
| :----- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| r1     | 2026-09-10     | 首轮闸门评审：宿主契约（注册表）+ 宿主解析（元素目标）+ 堆叠治理 + 版本漂移 + NFR；待拍板 D1（弹层原语 A 自绘落池 / B 沿用 tooltip）                                                                                                                                                                                                               |
| **r2** | **2026-09-10** | **D1 的 A/B 两个候选均被用户裁定的「现成组件组合」取代**（Tooltip 标签 + Dropdown 面板 + Button 触发，无自绘）；据实测证据收紧/放宽 C1–C3 的适用范围；登记 skill 偏离；补 6 条新约束（C11–C16）与 2 项新待拍板（D5/D6 归并）                                                                                                                       |
| **r3** | **2026-09-10** | **`right-center` 落位判据修正**（QA Electron 实测 + 我方 Chrome/CDP 复现）：原写“dy 居中”**不成立**——纵向按“打开瞬间”尺寸算 center 并会因溢出回退为 start/end，且**非 `transparent` 模式下面板内容变尺寸不重定位**（漂移 = Δh/2，实测 Δh=106 ⇒ +54px）。⇒ 改为“**声明偏好、非像素判据**”（横向 dx 稳定），并新增风险 R13 与 D5 附加论据            |
| **r4** | **2026-09-10** | **D5 用户拍板 = B（`transparent: true`）**：理由 = 面板开着时齿轮**一次点击生效** + **消除 R13 纵向漂移**（库在 `transparent` 分支装 ResizeObserver）；R13 状态改为“已消除”；**C11 由“必需”降级为“防御性”**（B 模式下全屏透明 overlay 不存在 ⇒ 原 ≤240ms 残留吞点击窗口随之消失）；§4 补一行 **B 模式待 QA 复验**项（源码/CSS 推导，不声称已实测） |

---

## 1. 背景与根因（证据）

| 事实                                   | 证据                                                                                                                           |
| :------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| 浮层锚定视口左下（与齿轮坐标系不一致） | `apps/desktop/src/renderer/src/components/sync-status-bar.vue:82-85`（`position:fixed; left:1rem; bottom:1rem; z-index:9999`） |
| 齿轮锚定轨道底部                       | `apps/web/src/components/app/aside-v2/aside-v2.vue:74-88`（`aside__bottom` 内齿轮 + 空 `<slot name="bottom"/>`）               |
| 轨道被双重裁切                         | `aside-v2.css:11-13` + `nue-ui-theme-shadlike/dist/components/container.css`（`.nue-aside{overflow:auto;overflow-x:hidden}`）  |
| 9999 越过弹层池基线                    | `nue-ui-theme-shadlike/dist/components/popup-pool.css`（`--nue-popup-pool-actived-z-index:99`）                                |
| 弹层池是唯一"合法顶层"容器             | 同上；对话框/抽屉/下拉/选择器均经 `usePopupPool`/`usePopupAnchor` 入池                                                         |

---

## 2. 裁决记录

### D-1 / Q1：跨端注入契约 = **宿主元素注册表**（r1 裁决保持，与弹层实现无关）

desktop 与 webapp 不是运行时跨包边界，而是构建期装配缝（`apps/desktop/electron.vite.config.ts:16-22`：`@` → `../web/src`；先例 `AppRoot.vue:4`）。落地：webapp colocate `rail-host.ts`（`shallowRef<HTMLElement|null>`，与 SHELL-01 `components/settings/dialog/state.ts` 同构）；消费侧 `<Teleport v-if="railBottomHost" :to="railBottomHost">`。

- 否决四层 slot 透传（同步组件挂在 `AppRoot`，位于 `App` 之上，slot 需穿 `router-view` 边界，改 5+ 文件零收益）。
- 注入点仍保留 id `AppAsideRailBottomSlot`（调试/人工几何断言），但不作契约通道。
- 宿主缺失（`profile` 未就绪 / ≤445px 抽屉 / 非 index 路由）→ 组件整体渲染空：**连同 Dropdown/Tooltip 一起不挂载**，这是负向单测的锚点。

### D-2 / Q2：宿主解析 = **元素目标 + v-if 门控**（r1 裁决保持）

Vue 3.5.41 `TeleportImpl`：字符串目标仅在挂载时解析一次，失败即 warn 且**不渲染**；`to` 不变则永不重解析；宿主元素被替换 → 指向脱文档旧元素（静默丢失、零告警）。元素目标 + 注册表天然规避。

### D-3 / Q3：堆叠基线治理（r1 裁决保持 + r2 实测补强）

- 本次实现：删 `position:fixed` 与 `z-index:9999`；**不新增任何 z-index**（面板经 Dropdown 自带池 = popup 池 99，自身 z-index auto）。
- 铁律：① 新增浮层一律经池；② 应用/壳层不得声明 `z-index ≥ 100`；③ 禁止用"再高一点"修遮挡；④ 同级竞争只允许覆盖池变量 `--nue-popup-pool-actived-z-index` 且需评审放行。
- **r2 实测补强（池激活生命周期，Chrome 152 / 真实时间）**：Dropdown 关闭态 Teleport 为 `disabled`，内容落在包装器内的 **`<template>`（inert）**：rect 0×0、不参与命中、不参与焦点、池 `childNodes=0`（`data-actived=false`）；打开时 `mountPopupAnchor()` 追加 anchor → 池 `childNodes=1`、`data-actived=true`（99）；关闭经 ~0.24s 动画 → `animationend` → `unmountPopupAnchor()` → **池回到 `childNodes=0` / `data-actived=false`**、内容回落到 inert `<template>`。⇒ 池激活完全由库管理，壳层**无需**也不能手动 `setZIndex()`（r1 的"忘激活则不可见"风险对本方案不存在）。（**r4 注**：本段 overlay 尺寸与命中数据为 **A 模式（默认）** 实测；**D5=B 后 overlay 为 0×0**，但池激活/关闭回落机制与 inert `<template>` 行为不变——B 模式的差异项见 §4 新增行“待 QA 复验”。）

### D-4 / Q4：版本漂移 → **升级为"两版行为等价子集"**（请求项，采纳）

**实测等价证据（同一探针脚本、同一 DOM 场景，1.10.58 UMD vs 1.11.0 UMD，Chrome 152 真实时间，输出逐项一致）**：

| 观测项                            | 1.10.58                                                               | 1.11.0                |
| :-------------------------------- | :-------------------------------------------------------------------- | :-------------------- |
| 关闭态内容位置                    | `<template>`（inert）                                                 | `<template>`（inert） |
| 关闭态池 `childNodes` / `actived` | 0 / false                                                             | 0 / false             |
| 关闭态命中齿轮                    | `#gear`                                                               | `#gear`               |
| 打开后池 `childNodes` / `actived` | 1 / true                                                              | 1 / true              |
| overlay 尺寸 / 是否获得焦点       | 1000×657 / 是                                                         | 1000×657 / 是         |
| overlay 内可聚焦元素              | `#syncnow`（1 个）                                                    | `#syncnow`（1 个）    |
| `right-center` 偏移               | **横向 dx=8（0.5rem）稳定；纵向“声明偏好”非像素判据**（见 §4 修正行） | 同                    |
| 关闭后池 / 命中齿轮 / 动画事件    | 0 / `#gear` / `open,close`                                            | 同                    |

源码级等价（逐文件核对）：`NueOverlay` 两版同构（`tabindex="-1"` + `watch(visible)` → `setTimeout(focus)` + `onKeydown esc → emit('escape')`，**非焦点陷阱**）；`NueDropdown` 两版同构（`#trigger{trigger,visible}` / `#header` / default / `#footer`；`setup(props,{expose})` → `expose({open,close})`；overlay `onEscape=close`；`ul onClick.stop`；`mountPopupAnchor`/`unmountPopupAnchor`；`data-executeid`；`NueDropdownItem.loading`）；`NueButton` 两版同 props；`usePopupAnchor` 两版同构（`tpState={disabled:true,to:'body'}` 初值 → 挂载时同步 `to:'#id'`+`disabled:false`+`setZIndex()`）。
**PM 复核请求结论：全部成立**，其中"1.11 `NueDropdownItem` 仅 `onClick`、无 `tabindex/role/keydown`" 两版同源成立（1.10.58 亦无）。

**约束升级（替换 r1 的 C6–C8 表述）**：

- **C6′** 只用**两版行为等价**的根导出：`NueButton/NueDiv/NueText/NueTooltip/NueDropdown/NueDropdownItem/NuePopupPool/usePopupPool`。
- **C7′** 禁 `nue-ui/dist/**` 深路径与 `@nue-ui/*` 子包导入（未安装为独立包，且绕过"等价子集"）。
- **C8′** 禁依赖未文档化内部行为：`tpState`/`popupAnchor`/`mountPopupAnchor` 等**不得由我方代码直接调用或断言**（仅可作为评审证据/测试的间接观测，如 `data-actived`）。
- **C8″** 若未来升级 desktop 至 1.11.0+，等价子集需重新验证（等价性有版本时效）。

### D-5 / Q5：NFR 可行性（r1 结论保持；颜色令牌项仍待拍板）

零 layout shift ✅（注入点 `display:contents`；弹层/tooltip 均池外置；`.nue-dropdown-wrapper`/`.nue-tooltip-wrapper` 均 `flex:none;width:fit-content` 不撑轨道）｜无无界定时器 ✅（本方案零自建定时器；库内 `setTimeout(focus)` 为单次；`transparent` 模式的 scroll/ResizeObserver 为事件驱动且关闭即断开）｜lastError 禁 v-html ✅（`:title` + 文本插值；截断用 CSS；`aria-live` 只播摘要）｜i18n 类型强制 ✅（`LocaleKey = keyof LocaleMessages`，`packages/shared/locales/types.ts:701`）｜三态颜色：**现状两处令牌无效**（`var(--warning-color)` 裸用 HSL 三元组 / `var(--nue-danger-hsl-color)` 全仓无定义）→ 改用实测存在的 `--nue-warning-color-60` / `--nue-error-color-60`（见 D2 待拍板）。

---

## 3. r2 新增约束（针对"现成组件组合"）

| #       | 约束（硬）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 依据                                                                                         |
| :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------- |
| **C9**  | 面板**内容**用库的 `open/close` 事件门控（`@open` → 渲染，`@close` → 移除），**不得**只依赖 `afterClose`：`afterClose` 由关闭动画 `animationend` 触发，jsdom/无动画环境不触发（实测 jsdom 下 anchor 与内容常驻池中）                                                                                                                                                                                                                                                                                                                  | r2 jsdom 探针：`after Esc: anchor still in pool = true`；浏览器探针：`animationend` 后才归零 |
| **C10** | 单测"关闭态"断言口径：断言 `[data-visible="false"]` 或"我方门控内容不存在"，**禁止**断言"池为空/面板 DOM 彻底移除"（jsdom 下不成立 → 假失败）                                                                                                                                                                                                                                                                                                                                                                                         | 同上                                                                                         |
| **C11** | **必须**在 `watch(settingsDialogOpen 的 `open` ref)` 为真时调用 `dropdownRef.close()`：池内同级元素按 DOM 序叠放，而 Dropdown 每次打开都 `appendChild` 自己的 anchor → 其 anchor 会排在对话框 anchor **之后**，若不收起，我方 overlay（打开态为 100vw×100vh）会压在对话框之上并吞掉其点击（AC-09 的真实失效路径，非仅"压遮罩"）。**用响应式 `open` ref，不用非响应式的 `isSettingsDialogOpen()` DOM 查询**（**r4：D5=B 后本约束由“必需”降为“防御性”**——B 模式 overlay 为 0×0，无全屏吞点击面；保留以防将来切回 A 或池内新增兄弟弹层） | 源码 `mountPopupAnchor()` 每次 open 调 `appendChild`；SHELL-01 `state.ts` 导出 `open` ref    |
| **C12** | **必须**填满 default slot：库在 default slot 缺失时会往 `<ul>` 里塞 `<span class="nue-dropdown__empty-text">无选项</span>`（`<span>` 直挂 `<ul>` = 非法 HTML + 噪音文案）                                                                                                                                                                                                                                                                                                                                                             | 源码两版 `renderSlot(default, {}, fallback span)`                                            |
| **C13** | 轨道按钮必须 `aria-label`（i18n）+ 用 `#trigger` slot 的 `visible` 绑定 `aria-expanded`；**tooltip 不作为可访问名**（tooltip 仅 mouseenter 触发，键盘不可见）                                                                                                                                                                                                                                                                                                                                                                         | 源码 tooltip 仅 `onMouseenter/onMouseleave`                                                  |
| **C14** | 状态着色走按钮主题令牌（`--nue-button-color` 等）而非硬编码 `color:`；常态/`hover` 与齿轮一致（`--nue-primary-color-600` / `900`）                                                                                                                                                                                                                                                                                                                                                                                                    | 与 SHELL-01 齿轮一致 + 双主题/暗色                                                           |
| **C15** | 「立即同步」不得带 `data-executeid`（避免 `execute`/`closeWhenExecuted` 语义关闭面板）；面板内点击由库 `ul onClick.stop` 吞掉传播，不需要我方加 `.stop`                                                                                                                                                                                                                                                                                                                                                                               | 源码 `de()` 仅对 `dataset.executeid` 生效                                                    |
| **C16** | 焦点归还用 `@close` + `nextTick`（同步、可测），并在按钮 `disabled`（同步中 `:loading` ⇒ `disabled`）时跳过，避免对 disabled 元素 `focus()` 静默失败                                                                                                                                                                                                                                                                                                                                                                                  | 源码 `u = groupDisabled\|\|disabled\|\|loading`                                              |

### C1–C3 的适用范围（请求项 Q1，明确）

- **C1（禁字符串选择器 Teleport）/ C2（禁轮询·MutationObserver）/ C3（禁视口回落 + 零 warn）约束的是**我方代码**（`apps/desktop` 新组件 + `apps/web` 注入点），不约束第三方库内部实现**——依赖内部实现不可控亦不可改。
- 对依赖的要求等价替换为一条**不变量**：_Teleport 目标的生命周期必须与触发组件同属一个组件/提交，且挂载后不会被替换_。Dropdown 满足：anchor 由 `mountPopupAnchor()` 在置 `to/disabled` 之前**同步** `appendChild` 到池（目标必已存在），初始态 `disabled:true, to:'body'` 走 in-place 渲染而**不触发** `resolveTarget` 的缺失告警分支，anchor 仅由同一组件在关闭后移除。
- 库内 `transparent` 模式的 `ResizeObserver`/`window.scroll` 监听为事件驱动、打开注册/关闭断开（源码 `o.transparent && ...` / `stopResizeObserver()`），不构成"轮询"；**默认（非 transparent）模式则不创建 ResizeObserver**。
- 灰色地带纪律：我方**不得**直接调用/断言库内 `tpState`、`mountPopupAnchor`、`usePopupAnchor` 等未文档化出口（C8′）；测试如需观测池状态，只允许观测 `#TopLevelNuePopupPool` 的 DOM 属性（`data-actived`）。

---

## 4. r2 实测证据索引（判定依据）

探针（仓库外）：`~/shell02probe/{rail.html,rail1058.html,cdp.mjs,cdp2.mjs,probe.mjs}`；浏览器 Chrome/152.0.7977.64 headless（真实时间，CDP `Runtime.evaluate` + `awaitPromise`）。

| 观测                                      | 结果                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 对裁决的作用                                                                                                                                                             |
| :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 关闭态内容所在节点                        | `<template>`（`display:none`）→ rect 0×0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 关闭态**不拦截点击/不进 Tab 序/不参与布局** → 无"常驻隐形遮罩"风险（该担忧证伪，不必加 CSS 兜底）                                                                        |
| 关闭态命中齿轮 / 按钮                     | `#gear` / `.nue-text`（按钮标签）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 面板未打开时轨道完全可用（AC-01 前提成立）                                                                                                                               |
| 关闭态池                                  | `childNodes=0, data-actived=false`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 池不常驻激活；`z-index:99` 不常开                                                                                                                                        |
| 打开态 overlay                            | 1000×657（= 视口），获得焦点                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 开启时全屏 overlay（透明）吞"外部首次点击"= 标准下拉语义；焦点落到 overlay → 是 AC-03 Tab 链的前提                                                                       |
| 打开态 overlay 内可聚焦元素               | 仅 1 个 = footer 按钮                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **AC-03「Tab 进 footer 按钮」结构性可达**（overlay `tabindex=-1` 承接焦点，树序下一个可 Tab 元素即 footer 按钮）                                                         |
| 打开态 `right-center` 偏移（**r3 修正**） | **横向 `dx=8px`（= 库默认 gap 0.5rem）稳定**；**纵向不是像素判据**：库按“**打开瞬间**”的 trigger/popper 尺寸算 center，且溢出时按 top→right→bottom→left + 对齐回退。实测三组：① 内容 1 行（h=76）⇒ dyCenter=**+1**（数学居中）；② 内容增至 7 行但**不重开**（h→182）⇒ dyCenter=**+54**（= Δh/2，**未重定位**）；③ 重开后（h=182，视口 657）⇒ dyCenter=**−74**（底部溢出 ⇒ 对齐回退 **end**，面板底≈按钮底）。Electron QA 实测的 +28px 即情形 ②（Δh≈56）                                                                          | AC-11 的“**0.5rem 间距**”由 dx 满足；**不得**用“dy 居中/上沿对齐”作缺陷判据。消除漂移的库内唯一出路：`transparent:true`（`startResizeObserver` 在尺寸变化时重算）→ 见 D5 |
| Esc → 关闭 → 池归零 → 齿轮恢复可命中      | 通过                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | AC-03 Esc / AC-09 / AC-01 全链可证                                                                                                                                       |
| 关闭后内容查询（池内）                    | `#syncnow` 不在池内                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 关闭态"面板不在池"成立；但其 DOM 仍在 inert template 内 → C10 口径                                                                                                       |
| 两版（1.10.58 / 1.11.0）逐项              | 完全一致                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Q5 采纳：等价子集可用                                                                                                                                                    |
| **D5=B（`transparent:true`）模式**        | **待 QA 复验（未实测，以下为源码/CSS 推导）**：① overlay 尺寸应为 **0×0**（`.nue-overlay--transparent{width:0;height:0;overflow:unset}`，主题 CSS 已核）；② 点轨道其它元素/齿轮应**一次点击即作用到目标**（库改走 `window` click 监听，`nextTick` 后注册，不会误关自身）；③ 面板开关与 **Esc 仍可达**（overlay 仍渲染、`tabindex=-1`、open 时 `focus()` 自己、`onKeydown esc→emit('escape')` 均与主题无关）；④ 面板**内容变尺寸会重定位**（`transparent` 分支才调 `startResizeObserver`）；⑤ 焦点链（Tab → footer 按钮）预期不变 | 待复验项：②③⑤（尤其是 **0×0 元素是否可获得焦点/是否进 Tab 链**）；复验前不得当作既成事实                                                                                 |

图标/主题复核：`nue-ui-iconfont/dist/iconfont.css` 含 `icon-refresh` / `icon-loading` / `icon-sync-filled`（`name="refresh"` → `.icon-refresh`；`:loading` 默认 `loadingIcon='loading'` → `.icon-loading` + `nue-icon--spin`）；`.nue-button--primary` 存在（`theme="primary"` 合法）；`NueButton :loading` ⇒ `disabled`（源码 `disabled || loading`）且 icon 被 `loadingIcon` 替换。

**r3 补测（对齐行为，探针 `~/shell02probe/align.html` + `cdp-title.mjs`）**：同一 `placement="right-center"`、同一轨道布局下，三组测量的原始值：

```
打开后(1 行, h=76)      panel.y=557 cy=595 bottom=633 ; btn.y=579 cy=594 ; dx=8 ; dyCenter=+1
内容增长后(7 行, h=182)  panel.y=557 cy=648 bottom=739 ; btn.y=579 cy=594 ; dx=8 ; dyCenter=+54
重开后(7 行, h=182)      panel.y=429 cy=520 bottom=611 ; btn.y=579 cy=594 ; dx=8 ; dyCenter=-74   (视口 1000×657)
```

⇒ 结论：**dx 稳定（= 库 gap 8px）**；**dy 取决于“打开瞬间”的尺寸 + 溢出回退 + 是否发生过内容尺寸变化**，因此**不得**作为验收判据（与 QA Electron 实测 +28px 同一机制：Δh/2）。

---

## 5. skill 偏离留痕（请求项 Q3 结论）

**偏离**：`.agents/skills/nue-ui/SKILL.md`「Dropdown 建议用 `<nue-dropdown-item>`，别用原生 `<li>` 混搭」。

**有据偏离（架构裁决：接受）**：

- 实测两版 `NueDropdownItem` 渲染为 `<li data-executeid onClick=…>`，**无 `tabindex`/`role`/`keydown`** → 键盘不可激活；而本轮 AC-03 明确要求"Tab 进 footer 按钮 → Enter 触发"，只能用真实可聚焦控件承载。
- 该 skill 条目的语境是**菜单选项**（execute-id + `closeWhenExecuted` 语义）；本轮 footer 是**动作按钮**（且按 C15 不挂 `execute-id`），非菜单项，语义不同。
- skill 另一条（component-map:266）本身承认"可给菜单内**任意可点元素**加 `data-executeid`"，与"必须用 item"存在内部张力；`apps/document/tutorial/` 在本仓不存在，skill 指向的权威文档不可用（PM 已核）。

**留痕方式（三处齐备，缺一不可）**：

1. 代码内注释：说明"item 在两版均无键盘激活能力（附版本号），故用 `<li><nue-button/></li>`，并为合法 HTML"。
2. 本 ADR「skill 偏离」章节（本节）+ `docs/adr/README.md` 偏差条目。
3. PRD 业务规则/约束显式写明该偏离与其理由（QA 不得按 skill 条目判缺陷；AC-11 的"`<li>` 包裹合法性"以此为准）。

**附带纪律**：只读信息行用普通 `<li>` + `nue-text`；**不得**给只读行套 `nue-dropdown-item`（会暗示可执行动作）；**不得**给 `<ul>`/按钮补 `role="menu"`/`menuitem` 等未实现键盘语义的 ARIA 角色（误声明比不声明更糟）。

---

## 6. AC 可达性复核（r2）

| AC                                              | 结论                        | 说明                                                                                                                                              |
| :---------------------------------------------- | :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-01 齿轮可点                                  | ✅                          | 关闭态 inert、命中 `#gear`（实测）；叠加 C11 后无跨层吞点击                                                                                       |
| AC-02 hover tooltip + click 面板                | ✅                          | tooltip `top-center`（tooltip 池 100 > 面板池 99，异向避免压面板左上角——PM 判断正确）                                                             |
| AC-03 Tab→Enter 开→Tab 进 footer→Enter→Esc 归还 | ✅                          | overlay 接焦 + 唯一可聚焦 = footer（实测）；Enter 走原生按钮 click；`@close`+nextTick 归还；**同步中按钮 disabled 时跳过归还**（C16，见 §8 边界） |
| AC-04 footer loading + 失败态                   | ✅（同 D2）                 | `:loading` ⇒ disabled + spin 图标（实测）；失败色需令牌修正                                                                                       |
| AC-09 面板不浮于遮罩                            | ✅（需 C11，r4 降为防御性） | 不加 C11 时（A 模式）：池内 DOM 序使面板 overlay 压对话框并吞其点击（实测机制）；**B 模式下 overlay 0×0，该路径消失**                             |
| AC-11 同尺寸同色 + tooltip i18n + `<li>` 合法   | ✅（偏留痕见 §5）           | dx=8px 由库默认满足；**dy 不作判据**（见 §4 r3 修正行与 R13）                                                                                     |
| AC-13 web 零可见变化                            | ✅（需 `display:contents`） | 空注入点不产生 flex gap                                                                                                                           |
| AC-14 SHELL-01 回归                             | ✅                          | 焦点归还齿轮逻辑不受影响；键盘抑制判据（`isSettingsDialogOpen` DOM 查询）不被本组件破坏                                                           |

---

## 7. 风险清单（r2 更新）

| #                                    | 风险                                                                                                                                                                                                                                               | 影响                                                                                                                                                          | 应对                                                                                                                                                |
| :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1                                   | 字符串 Teleport 三失效模式                                                                                                                                                                                                                         | 状态点静默消失                                                                                                                                                | C1（元素目标 + 注册表） ✅r2 已消                                                                                                                   |
| R2                                   | ~~自绘落池需手动 `setZIndex`，忘调则不可见~~                                                                                                                                                                                                       | —                                                                                                                                                             | **r2 证伪/消解**：池激活由库管理（实测），无此风险                                                                                                  |
| R3                                   | ~~关闭态常驻隐形 overlay 吞点击~~                                                                                                                                                                                                                  | —                                                                                                                                                             | **r2 证伪**：关闭态在 inert `<template>`（实测 rect 0×0、命中齿轮）                                                                                 |
| R4                                   | 面板打开中，外部首次点击被 overlay 吞（含齿轮）                                                                                                                                                                                                    | 体验取舍                                                                                                                                                      | 默认=标准下拉语义；如需"一次点击即生效"改 `transparent:true`（库内改走 window click + scroll + ResizeObserver，关闭即断开）→ 见 D5 待拍板           |
| R5                                   | 面板已开时经 `⌘,` 打开设置对话框                                                                                                                                                                                                                   | （A 模式）池内 DOM 序使面板 overlay 压对话框并吞点击（约 0.24s 关闭动画窗口内仍存）                                                                           | **r4：D5=B 后已消除**（无全屏 overlay）；C11 保留为防御性约束                                                                                       |
| R6                                   | jsdom 无动画 → `afterClose` 不触发                                                                                                                                                                                                                 | 关闭态"内容残留" → 测试假失败                                                                                                                                 | C9/C10                                                                                                                                              |
| R7                                   | 空注入点贡献 flex gap                                                                                                                                                                                                                              | AC-13 失败                                                                                                                                                    | `display:contents`                                                                                                                                  |
| R8                                   | desktop `nue-ui@1.10.58` vs web `1.11.0` 双副本                                                                                                                                                                                                    | 未来新 API 引入时 desktop 先炸                                                                                                                                | C6′–C8″（等价子集）；版本对齐另立任务                                                                                                               |
| R9                                   | root vitest 加 `@/hooks` 前置别名                                                                                                                                                                                                                  | 静默改写全部 webapp 测试语义（`@/hooks` 被 `app.ts:4`、`dialog-adapter.vue:3`、`settings/dialog/index.vue:3`、`calendar/monthly/index.vue:27` 等 10+ 处使用） | **不得**改 root alias；desktop 测试用相对导入 + `vi.mock('@/hooks', factory)`                                                                       |
| R10                                  | 三态颜色令牌失效                                                                                                                                                                                                                                   | AC-04 名义通过、实际无色                                                                                                                                      | D2 拍板后改 `--nue-warning-color-60` / `--nue-error-color-60`                                                                                       |
| R11                                  | 同步中轨道按钮 disabled                                                                                                                                                                                                                            | ① 面板打不开（用户已接受）② 焦点归还 `focus()` 静默失败                                                                                                       | C16 + AC 固化该行为为**预期**（防 QA 误报）                                                                                                         |
| R12                                  | 只读信息行误用 `nue-dropdown-item` 或补 ARIA 角色                                                                                                                                                                                                  | 语义误导                                                                                                                                                      | §5 附带纪律                                                                                                                                         |
| R13（r3 新；**r4：已由 D5=B 消除**） | **面板内容在打开后变尺寸 ⇒ 不重定位**（非 `transparent` 模式不注册 ResizeObserver）：SHELL-02 面板展示**实时同步状态**（同步中 ↔ 时间/计数/错误行），高度会变 ⇒ 纵向对齐相对按钮漂移（漂移 = Δh/2，实测 +54px/Δh=106），极端时可能碰到视口边缘回退 | ~~视觉漂移~~ **已消除**（D5=B：库在 `transparent` 分支调 `startResizeObserver`，尺寸变化会重算）                                                              | ① 保留判据口径：**纵向对齐不作缺陷**（§4/AC-11）；② 面板总高仍建议含 max-height/滚动防溢出回退；③ **待 QA 复验**（§4 新增行④）                      |
| R14（r4 新，B 模式）                 | 切 B 后库内多两个监听（`window` click + `scroll`，以及 ResizeObserver）                                                                                                                                                                            | 活动部件增加；若监听未断开会泄漏                                                                                                                              | 源码已核均为**打开注册/关闭断开**（`stopResizeObserver()` + `removeEventListener`），属事件驱动非轮询；**C2（禁我方轮询）不变**，仅允许库内此类监听 |

---

## 8. 落地约束汇总（可勾选验收）

- [ ] C1 元素目标 Teleport；无字符串选择器主通道（我方代码）
- [ ] C2 无轮询/观察者；无无界定时器；无自建定时器
- [ ] C3 无视口悬浮回落；宿主缺失零 warn（负向单测不可删）
- [ ] C4 注册表随宿主挂载/卸载置位与清空（`onBeforeUnmount` 兜底）
- [ ] C5 ≤445px 抽屉 / 非 index 路由 / `profile` 未就绪 → 整体不渲染
- [ ] C6′/C7′/C8′/C8″ 只用两版行为等价根导出；禁深路径/子包/内部出口依赖
- [ ] C9 面板内容 `@open`/`@close` 门控
- [ ] C10 关闭态断言口径（`data-visible=false`，不断言池空）
- [ ] C11 设置对话框开启 → `close()`（watch `open` ref）——**r4：D5=B 后由“必需”降级为“防御性”**（B 模式无全屏 overlay，≤240ms 残留吞点击窗口已消失；仍保留作确定性约束，防将来切回 A 或池内新增兄弟弹层）
- [ ] C12 default slot 必须填满（避库内 `<span>无选项</span>`）
- [ ] C13 `aria-label`（i18n）+ `aria-expanded`（trigger slot `visible`）
- [ ] C14 状态色走按钮主题令牌；常态/ hover 与齿轮一致
- [ ] C15 「立即同步」不挂 `execute-id`
- [ ] C16 `@close` + `nextTick` 归还焦点，disabled 时跳过
- [ ] NFR 注入点 `display:contents`；i18n 三处；`lastError` 禁 v-html + 摘要播报
- [ ] §5 偏离留痕三处齐备

---

## 9. 决策状态（r4 更新：D5 已关闭）

| ID                            | 议题                                      | 选项                                                                                                                                                                                                                                                                  | 结论                                                                                                                                                                                         |
| :---------------------------- | :---------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D2**（r1 遗留；**待拍板**） | 三态颜色令牌修正的视觉 delta              | 修正（点色首次真正呈 pending 橙 / failed 红）／维持现状（无色）                                                                                                                                                                                                       | 架构建议 **修正**（R3/AC-04 要求可用令牌，属缺陷修复非改版）——仍待用户                                                                                                                       |
| **D5**（r2 新增；**已关闭**） | 面板开启时的“外部首次点击”语义            | A. 默认（非 `transparent`）：全屏透明 overlay —— 点轨道其它元素/齿轮的**第一下只关闭面板**（标准下拉语义，零额外监听）<br>B. `transparent:true`：overlay 0×0，其它元素**一次点击即生效**，但库内改为 window click + scroll 监听 + ResizeObserver（打开注册/关闭断开） | **已采纳 B（用户 2026-09-10 拍板）**：① 面板开着时齿轮**一次点击即生效**；② **一并消除 R13 纵向漂移**。代价 = 库内多两个监听（事件驱动、关闭即断开，见 R14）；**C11 由“必需”降级为“防御性”** |
| D6                            | `<li><nue-button/></li>` 偏离 skill（§5） | 接受（附三处留痕）／改回 `nue-dropdown-item`（放弃 AC-03 键盘触发）                                                                                                                                                                                                   | **接受偏离**（改回将使 AC-03 不可达）→ 需 PM 在 PRD 落该条并知会 QA                                                                                                                          |

> **D5 附加论据（r3，已生效）**：`transparent:true` 额外提供**面板尺寸变化时重定位**（`startResizeObserver` 仅在 transparent 分支调用）——即选项 B **一并消除 R13 的纵向漂移**。切 B 的收益 = “一次点击生效 + 对齐稳定”；代价 = 库内多两个监听（事件驱动、关闭即断开）。
>
> **D5=B 的待复验项（r4）**：见 §4 新增行（0×0 overlay 是否可获得焦点/进 Tab 链、外部一次点击是否作用到目标）——**复验前不得当作既成事实**。
>
> r1 的 D1（弹层原语 A/B）已由用户"现成组件组合"裁定取代，关闭；D3/D4 已由架构裁决，无需拍板。

---

## 10. 变更管理

1. 本 ADR 为评审基线；实现期偏离 §8 任一约束 → 回到架构评审（口头同意不计）。
2. 新增浮层/弹层 → 依 §2 D-3 铁律；越界须留 ADR 例外条目（位置 + 理由 + 收敛计划）。
3. PRD 侧变更（范围/AC 降级）→ PRD 留痕 + 本 ADR 追加"降级影响"章节；**交互定稿若再改（如 D5 切 B）→ 需更新本 ADR 的 C11/R5 段落**。
4. skill 偏离只允许 §5 的一种形态；若 nue-ui 未来为 item 补键盘能力（或 desktop 升级版本），需重评并回收偏离。
5. 归档：本 ADR 落 `docs/adr/`，索引见 `docs/adr/README.md`；日期取评审终签日。