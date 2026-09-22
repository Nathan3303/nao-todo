# 任务状态（PM 维护，运行时事实）

> 每次派发 / 回执 / 验收 / 抢占后更新本文件；PM 会话重开（`ensure --force`）后**先读本文件重建状态**再继续调度，不依赖历史消息。
> 归档后的历史见 `docs/prds/` 与 `docs/adr/`；本文件只记**运行时**任务状态，保持精简（**已终签批次只留一行 + 提交号**）。

## 一、当前状态（2026-09-23）

- **进行中批次**：**TASK-22「导出对话框多格式优化」**（JSON 格式 + HTML 账单单据 + 框内 LoadingError）——PRD 定稿并已提交（`0b9037e2`，`docs/prds/2026-09-23-task-export-multi-format.md`），**用户 2026-09-23 开工确认通过（按卡执行）**，T94 已派发。**发版进行中**：v1.8.0（见 §七）。_（TASK-13/15/16/17/18/19/19B/20/21 已全部 ✅ 用户终签通过，见 §二。）_
- **调度授权**：2026-09-21 用户授权「持续推进到落地」（继续有效）。
- **发版策略（用户 2026-09-22 再次确认推迟）**：「先不发版，新需求做完统一发一次版」⇒ 本地 `feat/ocdev` **领先 origin 92**，**push 与 tag 一并推迟到用户发话**。
- **工作区**：干净（除 `.agents/**` 在制品，见 §四）。
- **需求池**：
    - **TASK-14**「日历视图刷新功能」—— 用户 2026-09-21 **撤回**，待其自行测试一段时间后再提（未澄清、未开工、无 PRD）。
    - **DEF-1**（缺陷，**入池待排**）：`packages/infrastructure` 的 `sync.test.ts > Q3` 约 1/10 偶发失败（`listDirty()` 多 1 条 = `fake-indexeddb`/`syncQueue` **共享状态跨用例泄漏**）。已核实与 TASK-20 **无因果**（不含 `apps/web`/CSS 亦复现；单跑该包 157 例全绿）。**修测试隔离**（归 `packages/infrastructure`，建议角色 rd-be）。
    - **DEF-2**（舰队资产**副本滞后**，**待 nao-skill-dev 裁示同步方式**）：nao-todo 副本 `.agents/scripts/nao-fleet.sh` 行 577 缺 `TASK=""`，`set -u` 下行 597 `cmd_ensure "$FORCE" "$MODEL" "$TASK" …` 在 **`ensure` 不带 `--task`** 时抛「TASK: 未绑定的变量」⇒ 常驻会话拉起路径不可用。**上游已修**：nao-skills 提交 `a363f12`（2026-09-22，message 含「naotodo-pm 跨仓报备」）。`diff -rq` 证实两者**唯一文件差异**即此文件（nao-todo 另多 `.nao-version`=`0.5.1`）⇒ **nao-todo 副本从旧修订同步而来**，**不再是代码缺陷**。**临时绕过**：`TASK= bash .agents/scripts/nao-fleet.sh ensure <role>`（未改共享资产）。**2026-09-23 用户指示已跨仓发 nao-skill-dev**（问 a 同步命令 / b `.nao-version` 0.5.1→CLI v0.6.0 间的预期改动 / c `update` 是否会改写 `AGENTS.md`/`roles.yaml`（人工 LF+2/4 不变量风险）/ d 回报要求）；**等其回执**。
- **更新**：2026-09-23

## 二、已终签归档（2026-09-22 全部通过）

| 批次     | 主题                                                                                            | 交付提交                                        |
| :------- | :---------------------------------------------------------------------------------------------- | :---------------------------------------------- |
| TASK-13  | 导出任务文本对话框优化（可编辑 + 子任务字段丰富）＋ ADR（只读检查项整体替换）                   | `0527461d` / `facddf27` / `04d90762`            |
| TASK-15  | 日历视图展示顺序（撤销 3 处隐藏排序）                                                           | `e4e1064f`（同批 `TASK-13` 交付）               |
| TASK-16  | 日历界面**日视图**（48×30min 列 / 分钟级连续定位 / 轨道 + 日级 `+N` / 跨日裁剪）                | `0d1b801e` 起                                   |
| TASK-17  | 日视图头部对齐月/周 + 侧边栏收缩按钮                                                            | `9d5f3a77`（其遗留裁决由 TASK-18 T69 采纳解决） |
| TASK-18  | 三视图**子路由化**（D1=a）+ 布局单一基线（D1–D10；ADR C1–C11）                                  | `a15ce8f9` / `c76bc1fd`                         |
| TASK-19  | 日视图**时间轴档位缩放（×1–×4）+ 横向溢出滚动 + 全天任务内嵌泳道**                              | `c08b7b3c` / `5eac8ff9`                         |
| TASK-19B | 日视图 6 项交互调整（刻度建任务 / 全天只读条 / 贴边名称 / 两侧手柄 / 空白平移 / 刻度细分）      | `44bb402d` / `99d81aaf`                         |
| TASK-20  | pan 加固 / **任务条拖动修复（覆盖层命中）** / 拖动反馈 / 格线整数列宽 / **SFC 拆分 911→359 行** | `dee5b8f6` / `70c9723c` / `942116c5`            |

> 记账文档（PRD / ADR / 索引 / 本文件 / 验收清单）由 PM 单独提交；上表只列**实现/测试**交付。

## 三、运行时表（下次开工用）

### 待派发队列

| 任务编号 | 目标会话 | 角色 | 概要                                                                                           | 排队原因                                |
| :------- | :------- | :--- | :--------------------------------------------------------------------------------------------- | :-------------------------------------- |
| T95      | rd-fe    | 前端 | `ExportTaskNode` additive 扩展 + `generateTaskJson` + `generateTaskHtml`（§14 视觉规格）+ i18n | 等 T94 用例先行落地                     |
| T96      | rd-fe    | 前端 | 流程反转 + `use-export-task` 状态机 + 对话框三态/格式分段/重试/iframe 预览                     | 依赖 T95 生成器签名（同包单写者，串行） |
| T97      | qa       | 测试 | 独立验收（AC1–AC5 + 门禁 + 移动端红线 + Markdown 零变更复核）                                  | 等 T95/T96 回执                         |

### 进行中

| 任务编号 | 目标会话 | 角色 | 概要                                                                                                                                                        | 派发时间   | 对应 AC |
| :------- | :------- | :--- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- | :------ |
| T94      | qa       | 测试 | AC1–AC5 用例先行（三渲染器纯函数 + 对话框状态机 + footer 流程反转；预期红）。**含 2026-09-23 D8 定向 supersede 3 处过时流程断言 + D9 props 默认值约束裁决** | 2026-09-23 | AC1–AC5 |

### 已回执待验收

| 任务编号 | 回执摘要（≤150字） | 详情路径 | 待办 |
| :------- | :----------------- | :------- | :--- |
| —        | —                  | —        | —    |

### 挂起（被抢占 / 降级）

| 任务编号 | 挂起原因 | 恢复方式 |
| :------- | :------- | :------- |
| —        | —        | —        |

## 四、治理待办（待用户决定）

- **`.agents/**` —— ✅ 已纳入版本管理（2026-09-22 用户决定）**：提交 **`2c8cba0d`**（**29 文件**：角色卡 5 / 公共规范 2 / 技能 8 / 清单 5 / 模板 4 / 脚本 2 / `.nao-version` / `roles.yaml`）。**提交后核验**：钩子未改动资产（工作区 = HEAD）、HEAD 内资产 **LF 保持**（CRLF = 0）、`roles.yaml` 缩进 **2/4 保持**、`nao-fleet.sh check` **exit 0**、`vp check` exit 0；敏感信息扫描**干净**（无凭据/私钥）。**⚠️ 仍需人工保持的不变量**：`.agents/**` 在 `fmt.ignorePatterns` 内（oxfmt 不接管）⇒ **LF + `roles.yaml` 2/4 缩进靠人守**，守卫 = `nao-fleet.sh check`（应为 0）。
- **`.codegraph/**`、`.pi/**`**：已由 `.gitignore` 排除（`.gitignore:47-48`），**不提交**（索引/运行时产物）。
- **`.agents` 格式化冲突根治项**：① **已完成** —— `.agents/**` 已加入 `vite.config.ts` 的 `fmt.ignorePatterns`（oxfmt 不再接管，CRLF/缩进漂移根因已消除）；② **仍待回流上游（nao-skills）** —— 让 `nao-fleet.sh` 的 awk 解析器容忍 CRLF / 4 空格缩进（防御性）。
- **上游工具缺陷（建议回流 nao-skills / 报 vite-plus issue）**：**`vp config` 不尊重 `.editorconfig`** —— 版本 `vp v0.2.6`（`vite-plus@0.2.6`，devDependency 走 `catalog:`）。**最小复现（4 步）**：① `.editorconfig` 含 `[*] end_of_line = crlf` 且某文件含 `<!--VITE PLUS START/END-->` 区块；② `vp check --fix <file>` ⇒ 全 CRLF（干净）；③ `vp config`（= `prepare`）⇒ **托管区块被重写为 LF**（CRLF 116 → 101、新增 15 个 LF 行）⇒ 工作区**立刻变脏**；④ 再 `vp check --fix` ⇒ 又回全 CRLF ⇒ **无限 ping-pong**。**期望**：注入器应尊重目标文件既有 EOL / `.editorconfig`。**影响面**：任何「CRLF 项目 + Vite+ 托管区块」每次 `pnpm install` 后必现无意义 diff。**本仓已规避**（`.editorconfig` 对 `AGENTS.md` 指定 LF）。
- **命中抽检固化 ✅（T92，`149305fe`）**：已落 `scripts/electron-smoke/checks/day-view-hit.mjs`（feature `day-view`）。**待办：端到端实跑**（需注入 `NAO_QA_EMAIL`/`NAO_QA_PASSWORD`）：`node scripts/electron-smoke/run.mjs --launch --feature day-view`；重点 `bars`/`blank`/`allday`/`ticks` 与 `zoom`（×1/×4）。T92 已用**真实渲染 + 仓库真实 CSS 的合成 DOM** 验证各判据，并做**回归有效性实测**（把 track 改回 `pointer-events: auto` ⇒ `stack`/`blank`/`overlay.track` 三条转红）。
- **「是否引入 Playwright」= 不需要（2026-09-22 核查结论）**：仓库已有 `scripts/electron-smoke/`（CDP 驱动桌面端实机、Node 内置能力、零依赖），README 明写覆盖「真实布局/弹层堆叠/**真实命中测试**」—— 需要真实浏览器的检查（含 TASK-16 **D5** 曾搁置的几何回归）应**扩展该工具**，而非新增依赖。TASK-16 D5「暂不引入 Playwright」据此维持。

## 五、挂账（已知可接受，无需动作）

- **交互契约 ADR**：`useDragSchedule` 的 `pending` 自愈**不改共享壳**（TASK-16 C8 硬约束）⇒ 可选在日视图侧加 2 行兜底；无溢出档位的光标/提示未做；`'floor'` 吸附模式**已退役**（保留函数与用例）；格线最细层 **DPR 门控（`@media min-resolution: 1.5dppx`）** 为兜底备选；×4 档 5min 层若过噪可退 `60/30/10` 三层。
- **PRD 遗留**：TASK-16 §13（死代码 `.cal-aside-toggle`/`.cal-nav-btn`、Playwright 几何回归暂不引入）；TASK-12（`MAX_EXPORT_DEPTH = 5`，超 5 层不导出）；TASK-19 C10③ `replace` 代价（D2 已拍板的用户可见代价）；TASK-13（编辑内容不持久化、「记住上次编辑」需另立单）。
- **TASK-19/19B/20 的 jsdom 不可断言项**：已全部纳入对应验收清单并**由用户人眼验收通过**（sticky 实贴、`clip-path` 副作用、标签居中像素、遮罩显示条件、pan 手感、续接段两侧手柄、×4 帧率、命中抽检）。

## 七、发版 v1.8.0 —— ✅ **已发布并同步**（2026-09-22）

- **结果**：发布提交 **`fb758cf4`**（7 文件：`CHANGELOG.md` + 6 个 `package.json`）+ **注解 tag `v1.8.0`**（tag 对象 `8c124b3c` → peeled `fb758cf4`）。
- **远端**：发布时 `origin/feat/ocdev` = `fb758cf4`；**发版后修复提交** `abc92acc`（`AGENTS.md` EOL 归一，见 §四/§六）已 push ⇒ 现 `origin/feat/ocdev` = **`abc92acc`**（**tag `v1.8.0` 仍指向 `fb758cf4`**，未被移动）。**PM 独立核对**：本地领先 **0**、tag peeled SHA 一致、发布提交 7 文件、无夹带。
- **质量门槛（发布提交上复跑）**：`vp check` exit 0（1313 / 1123，0 error 0 warning）；`vp test` **110 文件 / 993 例全绿**；`webapp build` + `desktop:build` 均 exit 0。

- **版本**：root / `@nao-todo/webapp` / `@nao-todo/desktopapp` → **1.8.0**（功能批次 → minor）；`@nao-todo/presentation` **0.4.6 → 0.5.0**（导出面/功能）；`@nao-todo/domain-task` **1.2.0 → 1.3.0**（新增公开只读原语 `listByTask`）；`@nao-todo/shared` **1.3.0 → 1.3.1**（i18n 键）；`infrastructure` 0.5.0 / `presentation-identity` 1.2.0 / `presentation-react` 0.1.0 **不动**。
- **范围**：web + desktop（`apps/mobileapp`、`packages/presentation-react` 本批零改动）。
- **发布提交**：`chore(release): v1.8.0`（`CHANGELOG.md` + 6 个 `package.json`）+ **注解 tag `v1.8.0`**。
- **push**：`origin/feat/ocdev` + tag `v1.8.0`（remote `git@github.com:Nathan3303/nao-todo.git`）。
- **发版后待办（不阻塞）**：T92 端到端实跑 —— `node scripts/electron-smoke/run.mjs --launch --feature day-view`（需注入 `NAO_QA_EMAIL`/`NAO_QA_PASSWORD`）。
- **已知偶发（入池 DEF-1）**：`packages/infrastructure` 的 `sync.test.ts > Q3` 约 1/10 失败（测试隔离），与本批无因果。

## 六、勘误（教训类保留）

- 2026-09-21：**`nao-fleet.sh status` 假阴性** —— `running()` 用 `pgrep -f 'pi … --name <role>'`，但 pi 进程 argv 被清空 ⇒ 恒报「未运行」。**派发前判定一律以 `intercom list` 为准**；`ensure` 判重同样失效。（待上游修）
- 2026-09-21：**EOL 比对口径教训（重要）** —— 用 `git diff --ignore-all-space` 测得「差异仅 6 行」即判为「噪声」是**错误口径**：`-w` 会**隐藏整文件 EOL 翻转**，近乎为空的 `-w` 差异恰恰是「全文件 CRLF 化」的特征。**涉及 `.agents/**` 的格式化统一，必须显式比对 EOL 与缩进。**
- 2026-09-21：**PM 自我更正（定性错误）** —— 曾把 T59/T62「抢跑」归责 rd-fe：实为 **PM 在同一批消息里同时下发「qa 写基线」与「rd-fe 实现」**；违规的是 PM 的派发方式。**纠正措施：依赖未回执的任务一律不预发内容，严格串行派发。**
- 2026-09-22：**`nao-fleet.sh ensure` 回归缺陷（已修）** —— 新增 `--task` 分支未给 `TASK` 设默认值 ⇒ `set -u` 下常规 `ensure <role>` 报「未绑定的变量」。nao-skills `a363f12` 修复（包 0.5.2），本仓工作区已同步（仅此一行差异）。
- 2026-09-22：**PM 操作事故（HEAD 锁）** —— 我派发 rd-fe 的历史改写任务（T90-B）后**又并发提交记账**，触发 `fatal: cannot lock ref 'HEAD'`（对方正在 `reset --soft`）。**无数据丢失**（核实其新提交正确、我的 docs 编辑仍在工作区）。**纪律：历史改写/并发写者期间，PM 必须静默**（同 cwd 单写者，卡 §六）——本次是我自己破的。
- 2026-09-22：**提交分组三轮教训（T90 → T90-B → T90-C）** —— ①「提交 1 漏带 `index.css`」根因 = 我只按「feat vs refactor」切分、未检查 SFC 对抽离文件的**引用依赖**；②「qa 用例留作在制品」⇒ **任何干净检出 TS2554**，说明**同一契约变更的实现与其用例必须同提交**；③被实现依赖的 test-infra 配置（`vite.config.ts` 的 `css.include`）**必须排在其前**；④改写验收 = **逐提交干净检出**（`git worktree --detach`）跑 `vp check` exit 0。**已固化为记账纪律。**
- 2026-09-22：**PM 派单口径错误（命中抽检）** —— 我写「`(条左缘+2px)` 命中条本身」**几何上不可能**：左手柄 `.day-task-resize--start { left:-3px; width:8px }` ⇒ 手柄盒 = `[缘−3, 缘+5]`，`缘+2` 落在**左手柄**内（真机实测命中 `SPAN.day-task-resize--start`）。rd-fe 已把「条缘归属手柄」写成显式断言 + 用**缘+10px** 判条体。**教训：涉及命中区/手柄盒的派单口径必须给「几何区间」而非「示意点位」。**
- 2026-09-22：**判别力教训（重要，已入 ADR C12/r8）** —— 「条中点命中 `.cal-item`」**不能**判出覆盖层回归：条内文本 `.cal-item-text`（`z-index: 3`）仍在命中栈顶 ⇒ 覆盖层改回 `auto` 时该断言**仍绿**；必须用 **`elementsFromPoint` 命中栈不含覆盖层** + **空白点 `inTrack=false`** + **覆盖层 computed `pointer-events === 'none'`** 三条判红。**教训：断言要选「只有 bug 存在才失败」的量，而非「bug 存在时仍可能成立」的量。**
- 2026-09-22：**PM 笔误（CHANGELOG 提交号）** —— 我给 rd-fe 的 CHANGELOG 附件把 TASK-19B 第二个提交写成 **`99eac8ff9`**（**仓库不存在**），实际为 **`99d81aaf`**。rd-fe 逐条核对 19 个 SHA 后把该 token 落为真实 SHA，**未按笔误逐字落盘**（正确处置）。**PM 裁定：接受其修正**；**不改写已发布的 tag**（为一个笔误 force-push tag 得不偿失）。**教训：附件里的提交号必须逐条 `git rev-parse` 校验后再下发。**
- 2026-09-22：**`AGENTS.md` EOL 抖动 —— 已根治（方案 B，`abc92acc`）**：实测根因 = **`vp config`（= `prepare`，`pnpm install` 必跑）重写 `<!--VITE PLUS START/END-->` 托管区块时写死 LF 且不读 `.editorconfig`** ↔ **oxfmt 按 `.editorconfig` 强制 CRLF** ⇒ ping-pong（`vp config` 后脏 → `vp check --fix` 改回 → 提交判空被拦）。**修复**：`.editorconfig` 增 `[AGENTS.md] end_of_line = lf` + 该文件整文件归一为 LF（**内容逐字不变**，仅行尾）⇒ 注入器/oxfmt/编辑器**三方一致认 LF**。**PM 独立复核**：`vp config` 后 `git status` 空、`vp check` exit 0 后仍空（幂等，不抖）。