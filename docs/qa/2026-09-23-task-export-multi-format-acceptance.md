# TASK-22 导出对话框多格式优化 —— T97 独立验收报告

- **批次**：TASK-22（JSON 格式 + HTML 账单单据 + 框内 LoadingError + footer 流程反转）
- **验收角色**：qa（T97，独立于 T94 用例作者与 T95/T96 实现者）
- **验收时间**：2026-09-23
- **基线 HEAD**：`445e4ad8`（`git status --porcelain` 为空，工作区干净）
- **实现范围**：`c25ac0ec`（T95：三渲染器 + `ExportTaskNode` additive + i18n）、`2a1df84e`（T96：流程反转 + 状态机 + 对话框）、`af08a270`（iframe 底色修正）
- **引用**：`docs/prds/2026-09-23-task-export-multi-format.md` §5/§6/§7/§14 + §9 D8/D10/D11/D12

## 0. 结论

**通过（ACCEPT）。** AC1–AC5 全覆盖；门禁全绿（导出目录 0 红 / `vp check` 0 错 / `guard:ddd` OK / webapp + desktop 构建 exit 0）；移动端红线零改动；变异验证 M1–M5 **全部按预期转红并已还原**（HEAD 不变、工作区干净）；`export-markdown.ts` 经源码级逐行核对**仅 additive 类型字段**；全批无 `skip`/`only`/`todo(`、无恒真替代；D8/D12 共 4 处 supersede 逐处等强度成立。

**唯一非本单红例** = DEF-4（`apps/web/src/components/calendar/daily/__tests__/daily-view.test.ts` 日期时间炸弹），已独立归因确认与本单无因果。

---

## 1. 门禁复跑（C3 修正口径）

| 项                 | 命令                                                                          | 结果                                                                        |
| :----------------- | :---------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| 导出目录测试       | `vp test --run packages/presentation/task/components/task-details/__tests__/` | **14 files / 114 tests 全绿（0 红）**                                       |
| 类型 + lint + 格式 | `vp check`                                                                    | **exit 0**（1322 文件格式 pass；1131 文件 0 warnings / 0 errors）           |
| 领域隔离           | `pnpm run guard:ddd`                                                          | `[guard:ddd] OK`（exit 0）                                                  |
| Web 构建           | `vp run webapp build`                                                         | **exit 0**（✓ built in 20.08s）                                             |
| 桌面构建           | `pnpm run desktop:build`                                                      | **exit 0**（✓ built in 23.54s）                                             |
| 移动端红线         | `git status --porcelain -- packages/presentation-react apps/mobileapp`        | **0**（另 `git diff --name-only v1.8.0..HEAD -- …` = 0）                    |
| 全仓测试（参考）   | `vp test --run`                                                               | 116 files / 1043 tests：**1042 passed / 1 failed**（唯一红 = DEF-4，见 §2） |

> 全仓无 DEF-1（`packages/infrastructure` sync Q3 偶发）复现。

## 2. DEF-4 独立归因（不采信 PM 结论，独立复核）

**PM 归因**：日历日视图「全天任务渲染为 task-bar（契约变更 B）」为 fixture 日期时间炸弹，与本单无因果。

**独立证据（三项）**：

1. **无日历/测试基建变更**：`git diff --name-only v1.8.0..HEAD -- apps/web/src/components/calendar` → **0 文件**。该测试文件自 v1.8.0 起未被任何提交触碰。
2. **真实时钟锚点**：`apps/web/src/components/calendar/daily/use-calendar-day.ts:55` = `const anchorKey = ref(todayDateKey())`（回退真实时钟）；测试 fixture `daily-view.test.ts:199` 硬编码 `endAt: '2026-09-22 10:00:00'`，而复核日 `date +%F` = **2026-09-23** ⇒ 任务落在锚点日之外，全天泳道 `.cal-item` 数 = 0。
3. **单跑复现（3/3 恒红）**：`vp test --run apps/web/src/components/calendar/daily/__tests__/daily-view.test.ts -t "全天任务渲染为 task-bar"` ×3 次，均：
   `text
AssertionError: expected 0 to be greater than or equal to 1
❯ daily-view.test.ts:207:50  expect(lane.findAll('.cal-item').length).toBeGreaterThanOrEqual(1)
Tests  1 failed | 16 skipped (17)
`
4. 全仓跑同一结果：`daily-view.test.ts (17 tests | 1 failed)`，其余 16 例该文件内为绿。

**结论**：与 PM 归因**一致**，属既有 fixture 时间炸弹，与本单无因果（已登记 DEF-4）。**不构成停工条件**。

---

## 3. 必做 A —— 变异验证 M1–M5（判别力）

**纪律**：每个 M **前/后**均记录 `git rev-parse HEAD` + `git status --porcelain`；变异不入提交；跑完即 `git checkout -- <file>` 还原。

**公共不变量**：全部 M 的 BEFORE 与 AFTER = `HEAD 445e4ad8bfc608914453504c083dfdd56fa1d599`、`status=[]`（工作区干净）。

| M         | 变异（临时，已还原）                                                                                 | 命令                                                                                         | 转红断言原文                                                                                                                                                                                                                                                                                                                                                |
| :-------- | :--------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M1 主** | `export-dialog.vue` 删除格式项 `:data-format="item.value"`                                           | `vp test --run <export-regression-change1 / export-dialog-multiformat / export-footer-flow>` | ① `export-regression-change1.test.ts:329` `AssertionError: expected [] to have a length of 3 but got +0` ② `export-dialog-multiformat.test.ts:206` `AssertionError: expected false to be true`（`[data-format="markdown"]`）③ `export-footer-flow.test.ts:285` `Error: Cannot call trigger on an empty DOMWrapper.`。**3 files / 3 failed（预期全部命中）** |
| **M1 次** | `export-regression-change1.test.ts` 的 `ButtonStub` 去掉 `...attrs` 转发                             | `vp test --run <export-regression-change1>`                                                  | `export-regression-change1.test.ts:329` `AssertionError: expected [] to have a length of 3 but got +0`（1 failed / 7 passed）——仅证明用例自身管线不空转                                                                                                                                                                                                     |
| **M2**    | `export-html.ts` 合计组行守卫改为 `checkItems.length && doneCheckItems > 0`                          | `vp test --run <export-html-generator>`                                                      | `export-html-generator.test.ts:226` `AssertionError: expected '<!DOCTYPE html>…' to contain '0/1'`（1 failed / 13 passed）                                                                                                                                                                                                                                  |
| **M3**    | `export-dialog.vue` 删除 `:srcdoc="props.html"`                                                      | `vp test --run <export-dialog-multiformat>`                                                  | `export-dialog-multiformat.test.ts:265` `AssertionError: expected undefined to be '<!DOCTYPE html>…' // Object.is equality`（1 failed / 13 passed）                                                                                                                                                                                                         |
| **M4**    | `export-html.ts` 的 `escapeHtml` 改为恒等函数                                                        | `vp test --run <export-html-generator>`                                                      | `export-html-generator.test.ts:152` `AssertionError: expected '<!doctype html>…' not to contain '<script'`（1 failed / 13 passed）                                                                                                                                                                                                                          |
| **M5**    | `footer/index.vue` 新增 `watch(exportFormat, () => { if (exportVisible.value) void startExport() })` | `vp test --run <export-footer-flow>`                                                         | `export-footer-flow.test.ts:288` `AssertionError: expected 2 to be 1 // Object.is equality`（1 failed / 3 passed）                                                                                                                                                                                                                                          |

**结论**：M1 主变异在 **3 个不同文件的 3 类断言**上同时转红 ⇒ 契约被真实钉死（非用例管线自证）；M2–M5 各自精确命中目标断言。**无「意外未转红」**，无需停工上报。变异结束后经 `git checkout --` 还原，HEAD 与工作区均回到基线。

---

## 4. 必做 B —— `generateTaskMarkdown` 源码级零变更（不靠复跑代替）

**命令**：`git show c25ac0ec -- packages/presentation/task/components/task-details/export-markdown.ts`

**逐行判定**：`--numstat` = `10 0`（**10 行新增、0 行删除**）；全部 10 行均为 `ExportTaskNode` 类型内的 additive **可选**字段声明及其注释：

`text

- id?: string
- priority?: string
- isGivenUp?: boolean
- projectId?: string | null
- tagIds?: string[]
  `

**结论**：

- 无任何渲染逻辑 / 字符串 / 分隔符 / 缩进 / 时间格式改动（`ExportLabels`、`formatExportDateTime`、`renderSubTask`、`generateTaskMarkdown` 均未出现在 diff 中）；
- `git log --oneline c25ac0ec..HEAD -- export-markdown.ts` = **空** ⇒ T95 之后无任何提交再触碰该文件；
- 与 §5.5 冻结基准一致：Markdown 输出文本**零变更**。

## 5. 必做 C —— 无削弱扫查

**范围**：本批 9 个测试文件（6 新增 + 3 就地 supersede）。

1. **`skip` / `only` / `todo(`**：`grep -nE "\.(skip|only|todo)\b|\b(it|test|describe)\.(skip|only|todo)" <9 files>` ⇒ **0 匹配**（exit 1）。
2. **恒真替代**：全部 `toBe(true)` 共 29 处逐处核验，均为 `element.exists()` / `findAll(...).some(...)` / `out.endsWith('\n')` 等**对真实 DOM/输出的量化断言**，无 `expect(true).toBe(true)` 类恒真；反向断言（`not.toContain` / `toBeUndefined` / `toHaveLength(0)` / `not.toMatch`）合计 ≥43 处。
3. **D8/D12 共 4 处 supersede 逐处「旧 → 新」等强度论证**：

| #     | 文件                                | 旧断言                                            | 新断言                                                                                                                           | 等强度论证                                                                                                                                                                                                                            |
| :---- | :---------------------------------- | :------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D8-1  | `export-acceptance.test.ts`         | `.export-open===false` + `.export-closed===true`  | `.export-open===true` + `.export-dialog-error` 存在 + 「重试」按钮存在                                                           | **换向而非削弱**：原证「不开框」，新证「开框且为框内错误态」；另**新增** error 态与重试入口 2 条断言。toast（`导出失败：boom`）与 `writeText` 未被调用 **原样保留**。stub 相应补 `status` prop + error 分支渲染（断言仪器化，非放宽） |
| D8-2  | `footer.test.ts`                    | 2 例：失败 ⇒ 不开框（含 toast 一次）；成功 ⇒ 开框 | 合并 1 例：**失败 fetcher 与成功 fetcher 各断言** `.export-open===true`                                                          | 原「避免门控恒闭」的正向对照意图由**双 fetcher 对照**保住（覆盖失败+成功两分支）；toast 断言按 D8 移交 `export-acceptance.test.ts`（同一失败路径仍被断言，未消失）。用例数减少但**分支覆盖未减少**                                    |
| D8-3  | `footer.test.ts`                    | 成功 ⇒ 开框                                       | 被 D8-2 合并吸收                                                                                                                 | 同上（正向分支仍在双对照内）                                                                                                                                                                                                          |
| D12-4 | `export-regression-change1.test.ts` | `texts = all buttons`；`texts.toHaveLength(2)`    | 按 `data-format` 拆分：`formatButtons.toHaveLength(3)` + `footerTexts.toHaveLength(2)` + footer 含还原/复制 + **全量**无「关闭」 | **严格更强**：旧断言在格式选择器引入后恒红（与需求②互斥）；新断言同时钉死「格式 3 项」与「footer 非格式 2 项」，且「无关闭」断言仍扫**全体** button（`allButtons`），覆盖面不减                                                       |

4. **4 处 supersede 的判别力**由 M1 主/次变异实测验证（D12-4 必转红；D8 的 `.export-open===true` 由 M5 外流程覆盖）。

---

## 6. 必做 D —— `env.d.ts` 必要性独立复核

**变异**：临时移除 `env.d.ts` 首行 `/// <reference types="vite/client" />`。

**命令**：`vp check packages/presentation/task/components/task-details/__tests__/export-dialog-multiformat.test.ts`

**报错原文**：

`text
error: Lint or type issues found
x typescript(TS2339): Property 'glob' does not exist on type 'ImportMeta'.
     ,-[packages/presentation/task/components/task-details/__tests__/export-dialog-multiformat.test.ts:297:37]
`

**还原**后：`git checkout -- env.d.ts` ⇒ `git status --porcelain` 为空；`vp check`（全仓，见 §1）exit 0。

**结论**：`env.d.ts` 的 `vite/client` 引用为 `import.meta.glob('…?raw')`（用于源码级 `min-height` 断言）所**必需**，属必要测试基建，**非无谓改动**。

---

## 7. AC 覆盖核对（PRD §7）

| AC                  | 覆盖                                                               | 独立证据                                                                                                                                                                                                                          |
| :------------------ | :----------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 主路径          | 浮层立即开 + 默认可编辑 Markdown + 三格式项                        | `export-footer-flow`（点导出立即开框，取数未完成时已开）、`export-dialog-multiformat`（ready 默认 textarea / 三 `data-format` 项）、`export-markdown-zero-change`（冻结串逐字符）、`export-acceptance`（T37-NFR autosize + 类名） |
| AC2 多格式 + 零重取 | JSON 只读 / HTML 只读预览 / 取数次数不增加 / 无「还原」            | `export-json-generator`（§5.3 schema）、`export-html-generator`（§5.4/§14）、`export-footer-flow`（Markdown→JSON→HTML 取数调用数不变，M5 判别力已证）、`export-dialog-multiformat`（JSON/HTML 下无「还原」）                      |
| AC3 复制            | 三格式 payload + 自包含可独立渲染                                  | `export-dialog-multiformat`（草稿 / JSON 文本 / 完整 HTML 源码）、`export-html-generator`（完整文档 + 无外链 + 无脚本 + 字面值样式）、`export-acceptance`（copy→剪贴板回传）                                                      |
| AC4 边界 + 安全     | 空段省略 / `null`\|`[]` / 换行差异 / 转义 / `sandbox=""` / 5 层    | `export-json-generator`（空值归一 + ISO + 换行 + 递归）、`export-html-generator`（空段省略 + `0/1` 边界 + 五字符转义 + 注入载荷 + 深度上限 5 + pre-wrap）、`export-dialog-multiformat`（JSON `<pre>`、`iframe[sandbox=""]`）      |
| AC5 负向 + 工程     | 框内错误态 + 重试 + toast / 防重入 / 门禁 / 移动端 / Markdown 冻结 | `export-loading-error`（idle→loading→ready\|error、retry 恢复、防重入、reset、缓存）、`export-footer-flow`（失败仍开框 + 框内 error + 重试恢复 + toast）、§1 门禁、§4 源码级零变更                                                |

**NFR 核对**：纯度（三渲染器纯函数，`generatedAt`/`exportedAt` 注入）✔；iframe 仅 `:srcdoc`（NFR「可测接缝」）✔（M3 判别力已证）；自包含无外部请求 ✔；布局稳定 `min-height: min(60vh, 32rem)` ✔（源码级断言 + `env.d.ts` 必要性复核，见 §6）；移动端零改动 ✔。

---

## 8. §13 人眼项（**需人眼、勿默认可用**）

以下 jsdom 不可覆盖，**本报告不视其为已验证**，须用户/人眼在桌面端与 Web 端实机核对：

1. HTML 单据实际渲染观感（等宽数字对齐、撕口虚线、合计计量条、纯灰阶完成标记、打印友好）。
2. iframe `srcdoc` 在桌面端 Electron（`sandbox: false`）与 Web 端的渲染一致性。
3. 框内「加载态 → 内容态」高度不跳变（`min-height` 已静态钉死，视觉需目视）。
4. 中英切换下格式项与单据文案实际显示。
5. 长描述（>10k 字）在 JSON/HTML 视图的滚动表现。

## 9. 遗留风险与发布建议

- **遗留缺陷**：DEF-4（日历测试日期时间炸弹，非本单）——建议另立单，修 fixture 为相对当日锚点；**不阻塞本单**。
- **本单风险**：低。Markdown 冻结基准经源码级核对零变更；新增面（JSON/HTML）由纯函数单测 + 变异判别力双重保护；流程反转的「框内错误态 + 重试」经组件与集成两层断言。
- **发布建议**：**可随 TASK-22 批次发布**；发布前执行 §8 人眼项，并保持门禁（`vp check` / 导出目录测试 / 两构建）为绿。