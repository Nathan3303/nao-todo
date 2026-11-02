# T636 · `DEF-130` + `DEF-128` 双缺陷修复 —— QA 独立复验 + 批末门禁

- 批次：`M20261102-def130-128`（目标 `v1.16.5` · PATCH）· 分支 `nao/M20261102-def130-128`
- 复验 HEAD：**`ae5eea69`**（派单给的就是它，工作区干净、无在制改动）
- RD 交付：`050d0287`（`DEF-130`「专注模板」清除键拼写）· `ae5eea69`（`DEF-128` 专注依赖下拉键盘可达）
- 本单形态：**不采信 RD 回执，逐条自验**；**未改任何产品代码**、**未改 RD 任何既有断言**，只新增 2 份文档（本报告 + 走查清单）
- 探针：一次性 13 例（4 个文件），全绿后**已从工作区删除**（副本留 `/tmp/t636-probes/`，跑完 `git status` 干净）—— 故不影响全仓计数
- 环境（复验机）：Node **v24.22.1** · pnpm **11.18.0** · vitest **4.1.10** · `nue-ui 1.15.3` / `nue-ui-theme-shadlike 0.13.30` · `TZ = Asia/Shanghai`（CST）· 复验时段 2026-11-02 23:5x – 2026-11-03 01:0x

## §0 结论

**门禁全绿、`DEF-130` 通过；`DEF-128` 只算「半个通过」——「取消关联」在真实页面生效，「触发入口『专注』」在真实页面未生效** ⇒ **建议打回 rd-fe 补一处调用点（一行级），本批不宜按现状发布。**

| 项                               | 结论                                                                                                                          |
| :------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `DEF-130` 清除键                 | **✅ 通过**（真挂载：清除键存在/可聚焦/点击回「全部」/再点筛选 emit 为空；`clearabl` 全仓与 DOM 残留均 0）                    |
| `DEF-128`「取消关联」            | **✅ 通过**（真实页面挂载实测 = `BUTTON.nue-link.nue-link--depend-status-clear`，`tabIndex 0`，类名与 `parseTheme` 实跑一致） |
| `DEF-128`「触发入口『专注』」    | **❌ 未生效**（见 §1.3：唯一调用点用 `#default` 插槽覆写，页面渲染的是 **SPAN `tabIndex=-1`**，Tab/Enter 仍不可用）           |
| 口径诚实性（jsdom 不能验 Enter） | **✅ 诚实**（RD 未把 `element.click()` 包装成「已验键盘激活」；我另实测 jsdom 中 Enter/Space 确不激活，§1.4）                 |
| 红基线（RD 自证）                | **✅ 独立复现一致**（`DEF-130` 2/2 红；`DEF-128` 4 红 / 3 绿，§1.5）                                                          |
| 批末门禁 9 项                    | **✅ 全绿**（全仓 **353 文件 / 2855 例 / 0 红**，§3）                                                                         |
| 基线与差值                       | **✅ 逐条对得上**，但**派单给的基线需订正**：`v1.16.4` 实际 **351 / 2846**（非 350 / 2842），见 §2                            |

> 为什么这条「未生效」不是文字挑刺：用户走查项 ② 要求「`Tab` 能停到『专注』上、`Enter` 能打开」。按 HEAD 现状，**用户在实际页面上一定过不了这一项**，而 CI 全绿——正是本仓 `AGENTS.md`「断言公共组件是否透传须真实挂载、stub/自模板不算证据」所防的静默失败。

## §1 独立复验（逐条实测，不采信回执）

### §1.1 `DEF-130`：「专注模板」选择器清除键

口径：**真实挂载筛选面板**（真 `nue-*`，`attachTo: document.body`），按**筛选项标签文本**定位（不按 `modelValue` 猜），`flushPromises()` 等 `nue-select` 把 `modelValue` 映射成 `selectedOption`。

| #   | 判据                       | 实测                                                                                                                                    | 结论 |
| :-- | :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 1   | 源码不再有错拼             | `git grep -n "clearabl" -- apps packages`（排除 `clearable` 误命中）⇒ **0 行**                                                          | ✅   |
| 2   | 已选模板值 ⇒ 清除键存在    | 该筛选项触发器内 `button[aria-label="清除选择"]` **恰好 1 个**；`tagName=BUTTON`、`type=button`、`class` 含 `nue-select__clear`         | ✅   |
| 3   | 清除键可聚焦               | `clear.focus()` 后 `document.activeElement === clear`                                                                                   | ✅   |
| 4   | 点击 ⇒ 值回「全部」        | 触发器文本 由 `模板B` → `全部`；清除键消失；再点「筛选」⇒ `update:filters` 的 `pomodoroId ∈ {'', undefined}`                            | ✅   |
| 5   | 无属性残留                 | DOM 内正则 `/clearabl(?![e])/` 命中 **0**（注：`clearable` 本身含子串 `clearabl`，故必须用该精确判据）                                  | ✅   |
| 6   | 清除键位置前提（不压箭头） | 触发器实测类 = `nue-select__trigger nue-select__trigger--clearable nue-select__trigger--small` ⇒ 激活主题预留规则；产物 CSS 实证见 §1.6 | ✅   |

### §1.2 `DEF-128`：「取消关联」为原生 button（生效）

真实组件挂载（真 `nue-*` + 真 Pinia + 注入上下文；仅 `ListViewAdapter` 用替身），并另在**真实页面**复核（§1.3）。

| #   | 判据                     | 实测                                                                                                                                 | 结论 |
| :-- | :----------------------- | :----------------------------------------------------------------------------------------------------------------------------------- | :--- |
| 1   | 元素形态                 | `BUTTON`，`type="button"`                                                                                                            | ✅   |
| 2   | 类名逐字                 | `className === "nue-link nue-link--depend-status-clear"`                                                                             | ✅   |
| 3   | 类名非猜测               | 运行期实跑 `parseTheme('depend-status-clear','nue-link')` ⇒ `["nue-link--depend-status-clear"]`（`nue-ui` 导出函数，非读压缩源推断） | ✅   |
| 4   | 可聚焦 / 可访问名        | `tabIndex = 0`；`focus()` 后 `activeElement` 命中；文本「取消关联」                                                                  | ✅   |
| 5   | 行为零回归               | `click()` ⇒ `emit('selectPreset', [null])`；任务 Tab 下 ⇒ `emit('clearTask', [[]])`（RD 用例覆盖，我抽查运行期 DOM 为 BUTTON）       | ✅   |
| 6   | 无 href 的 `<a>`         | 两个 Tab 下挂载级统计 **0 个**                                                                                                       | ✅   |
| 7   | 同族残留（全仓只读核查） | 脚本解析**整标签**（跨行）后统计：生产代码中 `<nue-link>` 无 `route`/`href`/`to` = **0 处**                                          | ✅   |

### §1.3 `DEF-128`：「触发入口『专注』」在真实页面**未生效**（本单阻塞项）

**事实链**：

1. 组件默认插槽内容确实改成了 `<button type="button" class="nue-link" @click="trigger">`（源码 L131）。
2. 但**唯一调用点** `apps/web/src/components/pomodoro/index.vue:66-72` 用 `<template #default="{ open }">` **覆写了插槽**：

```text
<template #default="{ open }">
    <nue-text theme="task-select-trigger" @click="open" title="专注">{{ dependLabel }}</nue-text>
</template>
```

3. 全仓调用点清点：`grep -rn "PomodoroFocusDependDropdown\|pomodoro-focus-depend-dropdown" --include=*.vue apps packages`（排除测试与 `index.ts`）⇒ **仅 `pomodoro/index.vue` 一处**，且该处就是覆写方。
4. **真实页面挂载**（`components/pomodoro/index.vue` = `routes.ts` 里 `/pomodoro/timer`、`/pomodoro/focus` 的组件；真 Pinia + 真 vue-router(memory) + 真 `nue-*`，仅 stub 计时器/笔记/轮次/头部等无关子件；造「已关联」态 `sessionStore.currentPomodoroName = '深度工作'`）实测：

```json
{
    "triggers": [
        {
            "tag": "SPAN",
            "class": "nue-text nue-text--task-select-trigger",
            "tabIndex": -1,
            "role": null,
            "type": null,
            "text": "< 深度工作 >"
        }
    ],
    "buttonNueLinkCount": 1,
    "anchorNueLinkCount": 0,
    "statusButtons": [
        {
            "tag": "BUTTON",
            "class": "nue-link nue-link--depend-status-clear",
            "tabIndex": 0,
            "text": "取消关联"
        }
    ]
}
```

- `triggers` ⇒ **SPAN、`tabIndex = -1`、无 `role`** ⇒ Tab 停不到、Enter 无响应（DEF-128 描述的缺陷在页面上**依然存在**）。
- `buttonNueLinkCount: 1` 就是「取消关联」（该半边生效）；`anchorNueLinkCount: 0` ⇒ 无 href 的 `<a>` 已清零（**这部分修好了**）。
- ⇒ **RD 的 7 例用例全部是「裸挂载组件（不传插槽）」**，测到的是用户页面**看不到**的默认插槽分支。按 `AGENTS.md` 前端验证纪律：这类「只证明自己写的模板」的断言不能作为「页面已修」的证据。

**建议修法（交 rd-fe，一行级）**：`pomodoro/index.vue` 的插槽内容改成等价的原生按钮（保留原主题类与 `title`/文案，`@click="open"` 不变）：

```text
<button type="button" class="nue-text nue-text--task-select-trigger" @click="open" title="专注">
    {{ dependLabel }}
</button>
```

配套：用例改为**调用点级/页面级**挂载（传同一份插槽内容，或直接挂 `pomodoro/index.vue`），否则同类漏测会复发。⚠️ 该按钮的 UA 默认样式重置要沿用本批 `focus-depend-dropdown.vue` 的口径（`background/border/padding/font/cursor`），否则会变成「原生按钮外观」——这正是走查项 ③ 要防的。

### §1.4 「键盘可达」口径诚实性

- RD 用例头注明写「**jsdom 不实现原生 `<button>` 的 Enter/Space 隐式激活**」，断言只锁四项前提（原生可激活形态 + 可聚焦 + 可访问名 + 未被 disabled 剥夺），激活行为用 `element.click()`；用例标题亦写作「原生 click 语义（真实浏览器 Enter/Space 的激活路径）」。**未出现「jsdom 验过 Enter」的表述** ⇒ 诚实。
- 我另做反向实测（证明该限制真实存在，而不是 RD 为自己省事）：`focus()` 后派发 `keydown`+`keyup`（`Enter`、`Space`）⇒ `data-visible` **仍为 `false`**（jsdom 无隐式激活）。
- ⇒ 本批「键盘可达性」= **三证**：① 可聚焦 + `tabIndex ≥ 0`（运行期）② 原生可激活形态 `BUTTON[type=button]`（运行期）③ **用户走查体感**（Tab 可见焦点环 + Enter 生效）。**不得**表述为「已验键盘激活」。第三证对「取消关联」有据；对「触发入口」按 §1.3 = **未达成**。

### §1.5 红基线独立复核（不是采信 RD 自证）

做法：临时把产品文件还原到修复前版本 → 跑 RD 用例 → 记录红数 → `git checkout HEAD --` 还原 → 核对工作区干净。

| 缺陷      | 临时还原                                                                  | RD 用例结果             | 与 RD 自证对照                      |
| :-------- | :------------------------------------------------------------------------ | :---------------------- | :---------------------------------- |
| `DEF-130` | `git checkout bd9c885d -- …/records/filter-panel.vue`（`clearabl` 版本）  | **2 failed / 0 passed** | 一致（RD：「2 例全红」）            |
| `DEF-128` | `git checkout 050d0287 -- …/focus-depend-dropdown.vue`（`nue-link` 版本） | **4 failed / 3 passed** | **逐字一致**（RD：「4 红 / 3 绿」） |

还原核对：`git status --porcelain -- <两个文件>` 为空；dev 服务 HMR 已回放（`/tmp/webdev.log` 最后一条该文件更新为还原时刻）⇒ 无残留。

### §1.6 样式影响面（scoped `.nue-link` 重置会不会误伤）

| 判据                                         | 实测                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 源码内 `.nue-link` 出现次数                  | `class="nue-link"` **×1**（L131）· `class="nue-link nue-link--depend-status-clear"` **×1**（L166）· scoped 规则 `.nue-link {` **×1**（L241）· `.nue-link__content` **×2**（BEM 子元素，**不被** `.nue-link` 选择器命中）。其余均为注释文本                                                                                                                                                                                                        |
| 挂载级统计（是否误伤其它元素 / 子组件根）    | 页面 DOM 内 `.nue-link` 元素 **恰好 2 个，均 BUTTON**（`["BUTTON.nue-link", "BUTTON.nue-link nue-link--depend-status-clear"]`）                                                                                                                                                                                                                                                                                                                   |
| scoped 重置的产物形态                        | `apps/web/dist/assets/*.css` ⇒ `.nue-link[data-v-72e349f5]{font:inherit;cursor:pointer;background:0 0;border:0;padding:0}`                                                                                                                                                                                                                                                                                                                        |
| 焦点环仍命中这两个 button                    | 源级：`apps/web/src/themes/link.css` 有 `.nue-link:focus-visible{outline:2px solid var(--nue-primary-color-600);outline-offset:2px}`；**产物级**：`apps/web/dist/assets/index-DwszXe0z.css` 内含同一规则；选择器为「类 + 伪类」，与标签名无关 ⇒ 对 `button` 同样命中；component scoped 样式**未**设置 `outline`/`appearance`（已断言不含）                                                                                                        |
| DOM 结构与改前是否等价                       | 直接读 `nue-ui` 的 `NueLink` 实现：其内容槽固定渲染 `NueText{ clamped:1, class:"nue-link__content" }` ⇒ 新结构（`button > nue-text.nue-link__content`）与改前（`a > nue-text.nue-link__content`）**逐字对齐**，差异只剩 root 标签 `a → button`（UA 默认样式由 scoped 重置抹平；`display` 仍由主题 `.nue-link{display:inline-flex}` 提供）                                                                                                         |
| 字号是否会变                                 | 源级推断：改前 anchor 已被 `themes/link.css` 的 `.nue-link:not(.nue-link--route){font-size:inherit}`（0,2,0）压成「继承值」；改后 scoped `font:inherit`（0,2,0）同样是继承值 ⇒ **等价**。⚠️ 属级联推断，**像素/观感以走查项 ③ 为准**                                                                                                                                                                                                              |
| 清除键与下拉箭头不重叠（`DEF-129` 同族复查） | 该选择器无本仓 `padding` 简写覆盖（`filter-panel.vue` 全文无 `.nue-button`/`.nue-select` 的 padding 覆盖）；产物 CSS 实证 `.nue-select__trigger--small.nue-select__trigger--clearable .nue-button{padding-right:calc(var(--nue-padding-xs) + var(--nue-gap-sm) + 1.025 * var(--nue-text-xs))}` 生效，而 `.nue-select__clear` 是 `position:absolute; right:calc(padding + 1px); width:calc(1.025 * text)` ⇒ 几何上落在预留槽内；**像素仍待走查 ①** |

## §2 数字基线（含派单基线订正）

| 节点                                 |    文件 |       例 |    红 | 说明                                                                              |
| :----------------------------------- | ------: | -------: | ----: | :-------------------------------------------------------------------------------- |
| **派单给的基线（`v1.16.4`）**        |     350 |     2842 |     0 | **实为 T633 复验时点（`0e033e65` + 其 3 个新用例）的数字**，不含 `DEF-129` 的用例 |
| **`v1.16.4` 实算（tag `03751fb5`）** | **351** | **2846** |     0 | = 350 + 1 文件 / 2842 + 4 例                                                      |
| **本批 HEAD `ae5eea69`（我实跑）**   | **353** | **2855** | **0** | = 351 + 2 文件 / 2846 + 9 例                                                      |

**差值逐条对账**（每条都可复跑）：

1. `350 → 351`（+1 文件）：`git ls-tree -r --name-only 03751fb5 | grep -c def-129` ⇒ **1**；同命令在 `0e033e65` ⇒ **0**。即 `packages/presentation/task/components/date-selector/__tests__/def-129-clearable-padding.test.ts` 是 T633 复验**之后**、squash 合并（`8e4cbc85`）时进入的。
2. `2842 → 2846`（+4 例）：`pnpm exec vp test --run …/def-129-clearable-padding.test.ts` ⇒ `1 passed (1)` / **4 passed (4)**。
3. `351 → 353` 与 `2846 → 2855`：`git diff --name-status 03751fb5 HEAD -- '*__tests__*'` ⇒ **只有 2 个新增测试文件**（`DEF-128` / `DEF-130` 各 1），**无修改、无删除**；两个文件单选跑分别 **7 例** / **2 例** ⇒ **+2 文件 / +9 例**，全部对得上。
4. 跳过项口径：本批 = 「1 skipped 文件 / 6 skipped 例」，与 `v1.16.4` 基线**相同**（既有跳过项，非本批引入）；红数 0。

> 为什么用「实跑 − 本批新增」推 `v1.16.4`：`tag → HEAD` 之间**只有** 2 个新增测试文件与 2 个产品文件、1 个台账文件（`git diff --name-status` 全量），没有测试文件被改动 ⇒ 用例总数只可能差这 9 例，推算无歧义；同时它与「T633 的 350/2842 + DEF-129 的 1/4」两条独立来源互相印证，结果一致（351/2846）。

## §3 批末门禁（9 项，精确数字）

| #   | 项目                                | 命令                                                                                           | 结果                                                                                                                                                                                               |
| :-- | :---------------------------------- | :--------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 格式 + lint + 类型                  | `pnpm exec vp check`                                                                           | **exit 0** —— 最终树（含本单 2 份文档）`All 1820 files are correctly formatted`（10.9s）/ `Found no warnings, lint errors, or type errors in 1470 files`（5.1s）；未含文档时同命令为 **1818 文件** |
| 2   | 全仓测试（非子目录）                | `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vp test --run`                            | **exit 0** —— **353 文件**（352 passed / 1 skipped）· **2855 例**（2849 passed / 6 skipped）· **红 0** · 244.32s                                                                                   |
| 3   | `guard:ddd`                         | `pnpm run guard:ddd`                                                                           | **exit 0** —— 「domain 包未引用 shared 根桶 / shared 展示层组件 / ResponseDataPagination」                                                                                                         |
| 4   | `guard:barrel-imports`              | `pnpm run guard:barrel-imports`                                                                | **exit 0** —— 扫描 **1470 文件** · 校验 **1615 条** `@nao-todo` 导入 / **2358 个命名** 均可解析                                                                                                    |
| 5   | `guard:gate-pathspec`               | `pnpm run guard:gate-pathspec`                                                                 | **exit 0** —— 「门禁命令 pathspec 均存在」                                                                                                                                                         |
| 6   | `guard:mobile-imports`              | `pnpm run guard:mobile-imports`                                                                | **exit 0** —— 移动端 **72 个源文件**，未引用 `persistence-local` / `persistence-sync` / `dexie` / infrastructure 根桶                                                                              |
| 7   | `guard:test-location`（计入新测试） | `pnpm run guard:test-location`                                                                 | **exit 0** —— **345 个受检测试文件**（`v1.16.4` = **343**，本批 **+2**；另 8 个移动端白名单未检查）                                                                                                |
| 8   | `webapp build`                      | `pnpm exec vp run webapp build`                                                                | **exit 0**（15.27s）· 产物 `apps/web/dist`（470 文件）                                                                                                                                             |
| 9   | `desktop:build` + 移动端红线        | `pnpm run desktop:build` · `git status --porcelain -- packages/presentation-react apps/mobile` | build **exit 0**（17.91s，产物 `apps/desktop/out/{main,preload,renderer}`）；红线 **0 行**（另：`git diff --name-only 03751fb5..HEAD -- packages/presentation-react apps/mobile` = **0**）         |

> 门禁口径提醒：`guard:test-location` 的 345 是我在**删除一次性探针之后**测的；探针（含新增 `__tests__/` 目录）已清空，故不进入任何计数。第 2 项同理（353 不含探针）。

## §4 未覆盖项 / 已知边界（如实申报）

| #   | 项                                                                 | 原因                                                                                                 | 去向                                                                                      |
| :-- | :----------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| 1   | **真实浏览器 Tab 序 / Enter 激活**                                 | jsdom 不实现原生 button 的隐式激活（我实测 Enter/Space 派发后下拉仍关闭），也不实现 Tab 键的焦点推进 | 走查项 ②（「取消关联」有据；**触发入口按 §1.3 当前已实测为不可达**）                      |
| 2   | **`:focus-visible` 焦点环的视觉可见性**                            | jsdom 不匹配 `:focus-visible`、不做级联计算                                                          | 走查项 ②（源级 + 产物 CSS 已证规则存在且对 button 命中）                                  |
| 3   | **像素级外观一致性**（字号/颜色/下划线/间距/原生按钮默认外观残留） | jsdom 无布局引擎；项目纪律不做无头浏览器截图对比                                                     | 走查项 ③                                                                                  |
| 4   | **清除键与下拉箭头的视觉间距**                                     | 同上；已给结构 + 产物 CSS 依据（§1.6）                                                               | 走查项 ①                                                                                  |
| 5   | `DEF-128`「触发入口」的**修复后**复验                              | 现状未生效，无「修复后」可验                                                                         | 待 rd-fe 补调用点后重新复验（本报告 §1.3 给了判据：页面级挂载 + `BUTTON` + `tabIndex 0`） |
| 6   | 桌面端打包产物（`electron-builder --dir`）观感                     | 视觉/真机走查由用户执行；本单只验 `desktop:build` exit 0                                             | 非本批 AC                                                                                 |

## §5 遗留三出口（`task-completion.md` 口径）

| #      | 遗留项                                                                                                                 | 出口                                                                                                                                                              |
| :----- | :--------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1** | **`DEF-128` 触发入口在真实页面未生效**（`pomodoro/index.vue` 插槽覆写；页面渲染 SPAN `tabIndex=-1`）                   | **转办 → rd-fe**：一行级改插槽内容为原生 `button` + 用例改调用点级/页面级；改后需复核 §1.3 判据并重跑走查项 ②                                                     |
| L2     | 键盘激活（Enter/Space 真实触发）无法自动化                                                                             | **接受**：三证口径（可聚焦 + 原生形态 + 用户走查）已写入 `DEF-128` 用例头注与本报告；若日后要有自动化，需引入 Playwright（项目当前无 E2E 层）→ 单独立项，不在本批 |
| L3     | 「类型」选择器未选值时清除键**常显**（`<nue-select-option :value="void 0">` 命中「全部」选项 ⇒ `selectedOption` 存在） | **接受（含到期日）**：属上游既有行为、点击无副作用（本批只读复核，未改）；已写入走查清单 ④「已知不报项」，待到本轮走查回填后关闭                                  |
| L4     | 像素级外观 / 焦点环视觉                                                                                                | **接受（含到期日）**：由走查项 ①②③ 回填后关闭；到期 = 本轮走查完成                                                                                                |

> 无其它遗留：同族「无 `href` 的 `nue-link`」在全仓生产代码中 **0 处**（脚本跨行解析核实）；本单未改产品代码 ⇒ 无回滚面。

## §6 本单新增文件（2 份文档，无代码/无测试）

| 文件                                                   | 用途                                    |
| :----------------------------------------------------- | :-------------------------------------- |
| `docs/reports/T636-def130-128-verify.md`               | 本报告（复验 + 门禁 + 差值对账 + 遗留） |
| `docs/reports/M20261102-def130-128-user-acceptance.md` | 用户走查清单（可勾选，含已知不报项）    |

> 说明：RD 新增的 2 个测试文件（`def-128-…-keyboard.test.ts` 7 例 / `def-130-filter-panel-clearable.test.ts` 2 例）属 RD 交付，不计入本单新增；本单对其**只评估、未改动**。