# 任务状态（PM 维护，运行时事实）

> 每次派发 / 回执 / 验收 / 抢占后更新本文件；PM 会话重开（`ensure --force`）后**先读本文件重建状态**再继续调度，不依赖历史消息。
> 归档后的历史见 `docs/prds/` 与 `docs/adr/`；本文件只记**运行时**任务状态，保持精简（**已终签批次只留一行 + 提交号**）。

## 一、当前状态（2026-09-23）

- **进行中批次**：**TASK-22「导出对话框多格式优化」**（JSON 格式 + HTML 账单单据 + 框内 LoadingError）——PRD 定稿并已提交（`0b9037e2`，`docs/prds/2026-09-23-task-export-multi-format.md`），**用户 2026-09-23 开工确认通过（按卡执行）**。**进度**：**T94 ✅ 已验收**（qa `60c96a29`：8 文件全在 `__tests__/`、新例 **51 = 红 48 + 绿 3**、supersede 恰为 D8 的 3 处且等强度、TASK-13 四个保护文件零触碰、`skip/only` 为空；PM 独立复跑 `7 failed|7 passed files` / `13 failed|64 passed tests` 逐字一致，且**撤回**了一处对 51=48+3 账目的怀疑——QA 数字零误差）→ **T95 已派 rd-fe**；**T95-辅助 ✅**（qa `42c889eb` 修正 HTML 合计段过度断言，1 文件 +3/−2，按 D10 加强边界；PM 核验改动与裁示逐字一致、与我方 `a5bbb53c` 顺序入库无 HEAD 锁）；**T96/T97 排队** → **T95 ✅ 已验收**（rd-fe `c25ac0ec`：7 文件未夹带测试；`export-markdown.ts` 仅 5 个 additive 类型字段、**渲染逻辑零变更**；`use-export-task.ts` +5 行 = 5 赋值 0 删除；新字段全 `?` 且 `toExportNode` 全赋值；`export-html.ts` **零外部资源**；PM 独立复跑 **47/47 绿**（JSON 9 + HTML 14 + markdown-zero-change 3 + export-markdown 13 + regression-change1 8），目录 **绿 91 / 红 23** 与自述一致）→ **T96 已派 rd-fe**（红窗口闭合点）。**发版进行中**：v1.8.0（见 §七）。_（TASK-13/15/16/17/18/19/19B/20/21 已全部 ✅ 用户终签通过，见 §二。）_
- **调度授权**：2026-09-21 用户授权「持续推进到落地」（继续有效）。
- **发版策略（用户 2026-09-22 再次确认推迟）**：「先不发版，新需求做完统一发一次版」⇒ 本地 `feat/ocdev` **领先 origin 92**，**push 与 tag 一并推迟到用户发话**。
- **工作区**：干净（除 `.agents/**` 在制品，见 §四）。
- **需求池**：
    - **TASK-14**「日历视图刷新功能」—— 用户 2026-09-21 **撤回**，待其自行测试一段时间后再提（未澄清、未开工、无 PRD）。
    - **DEF-1**（缺陷，**入池待排**）：`packages/infrastructure` 的 `sync.test.ts > Q3` 约 1/10 偶发失败（`listDirty()` 多 1 条 = `fake-indexeddb`/`syncQueue` **共享状态跨用例泄漏**）。已核实与 TASK-20 **无因果**（不含 `apps/web`/CSS 亦复现；单跑该包 157 例全绿）。**修测试隔离**（归 `packages/infrastructure`，建议角色 rd-be）。
    - **DEF-2**（舰队资产**副本滞后**，**✅ 2026-09-23 已闭环**）：nao-todo 副本 `.agents/scripts/nao-fleet.sh` 行 577 缺 `TASK=""`，`set -u` 下行 597 `cmd_ensure "$FORCE" "$MODEL" "$TASK" …` 在 **`ensure` 不带 `--task`** 时抛「TASK: 未绑定的变量」⇒ 常驻会话拉起路径不可用。**上游已修**：nao-skills 提交 `a363f12`（2026-09-22，message 含「naotodo-pm 跨仓报备」）。`diff -rq` 证实两者**唯一文件差异**即此文件（nao-todo 另多 `.nao-version`=`0.5.1`）⇒ **nao-todo 副本从旧修订同步而来**，**不再是代码缺陷**。**临时绕过**：`TASK= bash .agents/scripts/nao-fleet.sh ensure <role>`（未改共享资产）。**2026-09-23 用户指示已跨仓发 nao-skill-dev**（问 a 同步命令 / b `.nao-version` 0.5.1→CLI v0.6.0 间的预期改动 / c `update` 是否会改写 `AGENTS.md`/`roles.yaml`（人工 LF+2/4 不变量风险）/ d 回报要求）；**等其回执**。
        - **闭环（2026-09-23）**：nao-skill-dev 回执 `[DEF-2] done` 确认「上游无待改代码，只差一次 sync+commit」。**PM 独立复核（不采信自述）**：先在 `/tmp/nao-shadow` 影子副本（含 `AGENTS.md`）跑 `update` 复现 —— 仅 **2 文件**变化、`AGENTS.md` 与 `roles.yaml` **md5 不变**、`nao-fleet.sh` exec 位仍 `775`、影子 `check` exit 0。随后对真仓执行 `node /home/nathan/Project/nao-skills/bin/nao-skill.js update /home/nathan/Project/nao-todo -v` ⇒ **复制 0 / 覆盖 1 / 相同跳过 27**，提交 **`ce55edbc`**（精确 pathspec：`scripts/nao-fleet.sh` + `.nao-version` 0.5.1→0.6.0）。**三项守卫全过**：① `nao-fleet.sh check` **exit 0**（**不再需要 `TASK=` 绕过**），负向探针 `ensure __def2_probe__` 现报「未知角色」（而不再是「TASK 未绑定」）；② `.agents/**` **29 文件 CR = 0**；③ `roles.yaml` **Tab = 0** / 2 空格角色行 5 / 4 空格字段行 15。**提交后复核**：钩子未改资产（工作区 = HEAD）、`git grep HEAD` CR = 0、`check` exit 0。**追加（同日）**：上游续交付 **v0.6.1 `dcd3914`**（`check` 新增 EOL/缩进文本契约校验），本仓再同步至 **`7284e116`**（`复制 0 / 覆盖 1 / 相同跳过 27`；`.nao-version` 0.6.0→**0.6.1**），同步前同样先在 `/tmp/nao-shadow2` 影子副本独立验证 4 条正/负路径（细节见 §四）。
    - **DEF-3**（**跨仓**，**已登记待用户安排，2026-09-23 用户决定暂不处理**）：`nao-todo-server/.agents` 为 0.2.0 前旧装（**无 `.nao-version`**、与 nao-skills 源仓差 **15 处**、缺 `roles.yaml`/`checklists`/`templates`），且带**同一 `TASK` 未绑定缺陷**（该仓行 376）⇒ 对其跑 `update` 是**整包升级**而非补丁，故不适用本次的「补丁型」处置。
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

| 任务编号 | 目标会话 | 角色 | 概要                                                          | 排队原因    |
| :------- | :------- | :--- | :------------------------------------------------------------ | :---------- |
| T97      | qa       | 测试 | 独立验收（AC1–AC5 + 门禁 + 移动端红线 + Markdown 零变更复核） | 等 T96 回执 |

### 进行中

| 任务编号 | 目标会话 | 角色 | 概要                                                                                                                                                                                                                                  | 派发时间   | 对应 AC         |
| :------- | :------- | :--- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------- | :-------------- |
| T96      | rd-fe    | 前端 | 流程反转 + `use-export-task` 状态机（loading/error/ready + 重试防重入 + 一次取数缓存）+ 对话框三态/格式分段/iframe `srcdoc` 预览。**红窗口闭合点**：完成后 `vp check` 须 0 错（当前 27）+ 目录 23 红→ 0；**本提交禁止 `--no-verify`** | 2026-09-23 | AC1 / AC2 / AC5 |

### 已回执待验收

| 任务编号 | 回执摘要（≤150字） | 详情路径 | 待办 |
| :------- | :----------------- | :------- | :--- |
| —        | —                  | —        | —    |

### 挂起（被抢占 / 降级）

| 任务编号 | 挂起原因 | 恢复方式 |
| :------- | :------- | :------- |
| —        | —        | —        |

## 四、治理待办（待用户决定）

- **`.agents/**` —— ✅ 已纳入版本管理（2026-09-22 用户决定）**：提交 **`2c8cba0d`**（**29 文件**：角色卡 5 / 公共规范 2 / 技能 8 / 清单 5 / 模板 4 / 脚本 2 / `.nao-version` / `roles.yaml`）。**提交后核验**：钩子未改动资产（工作区 = HEAD）、HEAD 内资产 **LF 保持**（CRLF = 0）、`roles.yaml` 缩进 **2/4 保持**、`nao-fleet.sh check` **exit 0**、`vp check` exit 0；敏感信息扫描**干净**（无凭据/私钥）。**⚠️ 仍需人工保持的不变量**：`.agents/**` 在 `fmt.ignorePatterns` 内（oxfmt 不接管）⇒ **LF + `roles.yaml` 2/4 缩进靠人守**。**⚠️ 守卫缺口 → ✅ 已补齐（2026-09-23）**：原 `check` **不校验 EOL**（nao-skill-dev 指出；**并诚实澄清**：缩进违例此前已会因 `load_manifest` 的严格 awk 子集 **隐式硬失败**，故真正的缺口**只有 EOL 一项**，缩进只是「无独立分组输出」）。用户 2026-09-23 决定**只请上游补校验**（未采纳本仓 `.editorconfig` 定向段），上游已交付 **v0.6.1 `dcd3914`**（`check_eol` + `check_roles_indent`，并入新分组 `== 文本契约 ==`，失败 rc=1，且**报告先于解析 die**），本仓已同步 **`7284e116`** ⇒ 现 `check exit 0` **真覆盖** EOL + 缩进（PM 已独立验证 4 条正/负路径）。**剩余唯一暴露面**：编辑器/IDE 按 `.editorconfig` 保存时把 `.agents/**` 转 CRLF（oxfmt 路径已由 `fmt.ignorePatterns` 关闭）——即**能被守卫发现，但未被预防**。
- **`.codegraph/**`、`.pi/**`**：已由 `.gitignore` 排除（`.gitignore:47-48`），**不提交**（索引/运行时产物）。
- **`.agents` 格式化冲突根治项**：① **已完成** —— `.agents/**` 已加入 `vite.config.ts` 的 `fmt.ignorePatterns`（oxfmt 不再接管，CRLF/缩进漂移根因已消除）；② **✅ 已完成（2026-09-23）** —— **只请上游补校验**（用户决定，**不**在本仓加 `.editorconfig` 定向段 ⇒ 只「防漏检」不加「防产生」）：上游 nao-skills `dcd3914`（**v0.6.1**）为 `check` 新增 `check_eol`（`.agents/**` 含 CR 即 fail 并列文件；排除 `.nao-obsolete/`）+ `check_roles_indent`（角色 id 2 空格 / 字段 4 空格 / 禁 Tab，带行号），并入分组 `== 文本契约 ==`；本仓已同步 `7284e116`。**PM 独立验证（不采信自述）**：正向 exit 0（`✓ 29 个文本文件全 LF`）；注入 CRLF → exit 1 且**列出文件名**；注入 Tab/1 空格角色/5 空格字段 → exit 1 且**逐行号**报错，且 `文本契约`（第 6 行）**先于** `角色清单`（第 13 行）输出；`.nao-obsolete/legacy.md` 放 CRLF → exit 0（排除生效，分母仍 29）。原「让 awk 解析器容忍 CRLF/4 空格」的防御性设想**未采纳**（改为显式校验）。
- **上游工具缺陷（建议回流 nao-skills / 报 vite-plus issue）**：**`vp config` 不尊重 `.editorconfig`** —— 版本 `vp v0.2.6`（`vite-plus@0.2.6`，devDependency 走 `catalog:`）。**最小复现（4 步）**：① `.editorconfig` 含 `[*] end_of_line = crlf` 且某文件含 `<!--VITE PLUS START/END-->` 区块；② `vp check --fix <file>` ⇒ 全 CRLF（干净）；③ `vp config`（= `prepare`）⇒ **托管区块被重写为 LF**（CRLF 116 → 101、新增 15 个 LF 行）⇒ 工作区**立刻变脏**；④ 再 `vp check --fix` ⇒ 又回全 CRLF ⇒ **无限 ping-pong**。**期望**：注入器应尊重目标文件既有 EOL / `.editorconfig`。**影响面**：任何「CRLF 项目 + Vite+ 托管区块」每次 `pnpm install` 后必现无意义 diff。**本仓已规避**（`.editorconfig` 对 `AGENTS.md` 指定 LF）。
- **命中抽检固化 ✅（T92，`149305fe`）**：已落 `scripts/electron-smoke/checks/day-view-hit.mjs`（feature `day-view`）。**待办：端到端实跑**（需注入 `NAO_QA_EMAIL`/`NAO_QA_PASSWORD`）：`node scripts/electron-smoke/run.mjs --launch --feature day-view`；重点 `bars`/`blank`/`allday`/`ticks` 与 `zoom`（×1/×4）。T92 已用**真实渲染 + 仓库真实 CSS 的合成 DOM** 验证各判据，并做**回归有效性实测**（把 track 改回 `pointer-events: auto` ⇒ `stack`/`blank`/`overlay.track` 三条转红）。
- **`AGENTS.md` 危险警告已过期——已修正（2026-09-23）**：原段写道「跑过一次 `vp check --fix` 或提交钩子后 `.agents/**` 会被转 CRLF、`roles.yaml` 会被重排」，**实拍已不成立**：`.agents/**` 在 `vite.config.ts` 的 `fmt.ignorePatterns` 内 ⇒ **实测全仓 `vp check --fix` 前后 `.agents` 脏项恒为 0**、`roles.yaml` CR=0 且缩进 2/4 保持、`fleet check` exit 0；叠加 nao-skill **v0.6.1** 的 EOL/缩进守卫后，**唯一剩余暴露面 = 编辑器/IDE 保存**（且能被 `check` 发现）。**影响**：rd-fe 曾据旧文限缩 `--fix` 范围（无害但前提错），并在回执里把它记为 C2 偏差。**已改写该段**（并注明「勿再据旧文报警 / 无需限缩 `--fix` 范围」）。
- **D11（PM 授权例外，2026-09-23）：「HTML 导出用字面色值」不算 UI token 违规**。PRD §14.2 强制字面值（自包含硬约束：外部环境无 `--nue-*` 变量，用变量即渲染失败）⇒ rd-fe 清单里的「UI token 硬编码色值」**不计未过项**，`T97` / 后续审计**不得据此判缺陷**。
- **「红基线提交」显式例外 —— ✅ 已决定（2026-09-23，非待办）**：本仓「用例先行」会产生**红基线**（T94 `60c96a29`：新例 51 中 48 例因 T95/T96 契约未实现而红，含 3 个 suite 因模块缺失未收集）。而 pre-commit 钩子（`vp staged` → `vp check --fix`）的类型检查是**全仓**的 ⇒ 红基线**结构性无法过钩子**。**PM 裁定 = 接受红基线入库，不改写历史**，理由：① `reset --soft` 回退**解决不了问题**（8 个跨角色测试文件留在工作区，rd-fe 的 T95 提交同样被阻断 ⇒ 只是把 `--no-verify` 从 qa 挪到 rd-fe，还丢掉证据）；② **无 CI 门**（`.github/workflows` 仅 `release.yaml`）+ 本批**未推送** ⇒ 无自动化影响；③ 为「逐提交 green」而改写历史，正是本仓**有事故记录**的操作（TASK-20 HEAD 锁、T90-B 教训），为本地未推送的红基线引入改写风险不划算。**三项约束**：**C1** `--no-verify` 仅授权「红基线/红窗口」提交且 message 必须注明原因（非红窗口禁用）；**C2** 每次 `--no-verify` 前必须**单独跑格式化**（钩子同时承担 `vp check --fix`）；**C3** 红窗口必须在本批内闭合——T95+T96 完成后最终 HEAD 必须 `vp check` exit 0（T97 复核），若仍红则停工上报、不得带红交付。**交付验收口径据此修订为**：「最终 HEAD green」+「**自首个实现提交起**逐提交 green」，**`60c96a29` 红基线白名单化**。（此条为对 T90-C 教训「同一契约变更的实现与其用例必须同提交」的**定向例外**，仅适用于「用例先行覆盖多任务」场景。）
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
    - **❌ 该条后半句为错（2026-09-23 更正）**：所谓「本仓工作区已同步」**不成立** —— 2026-09-23 实测 nao-todo 副本行 577 **仍缺** `TASK=""`，`ensure` 不带 `--task` **抛错**，常驻会话拉起路径**整体不可用**（当时仅因拉起走的是 `TASK=` 绕过而未暴露）。**真因**：`diff -rq` 显示副本是从**旧修订**同步来的（副本 mtime 晚于上游修复提交，但内容为旧版），当初的「已同步」结论系**未经 `diff` 逐文件比对即下的断言**。**教训：跨仓资产同步状态必须用 `diff -rq`/逐文件比对取证，不得凭「刚同步过」推定**；已于 2026-09-23 经影子副本复核后同步（提交 `ce55edbc`，见 §一 DEF-2）。
- 2026-09-22：**PM 操作事故（HEAD 锁）** —— 我派发 rd-fe 的历史改写任务（T90-B）后**又并发提交记账**，触发 `fatal: cannot lock ref 'HEAD'`（对方正在 `reset --soft`）。**无数据丢失**（核实其新提交正确、我的 docs 编辑仍在工作区）。**纪律：历史改写/并发写者期间，PM 必须静默**（同 cwd 单写者，卡 §六）——本次是我自己破的。
- 2026-09-23：**diff 行数口径教训（跨仓回执）** —— 我在给 nao-skill-dev 的 DEF-2 回执里写「`scripts/nao-fleet.sh`（+54/−3）」，实则 `git show --numstat 7284e116` 为 fleet.sh **`+53/−2`** + `.nao-version` `1/1` ⇒ **把整提交聚合值挂到了单文件名下**（上游同步回执亦有同类偏差：把 `--stat` 第三列「+ 与 − 之和 = 55」当成新增数）。**教训：汇报行数一律用 `git show --numstat`（分列增/删），并显式区分「单文件」与「整提交聚合」；`--stat` 第三列不是新增数，不得直接引用。** 已核实错误仅存于消息（`tasks-state` 未记行数，无需改文档）；本次同步的 fleet.sh 与上游 HEAD **逐字节相同**（md5 `7cfc9f7ef0cc36f3f57427fe54c08f96`，`cmp` 无输出）。
- 2026-09-22：**提交分组三轮教训（T90 → T90-B → T90-C）** —— ①「提交 1 漏带 `index.css`」根因 = 我只按「feat vs refactor」切分、未检查 SFC 对抽离文件的**引用依赖**；②「qa 用例留作在制品」⇒ **任何干净检出 TS2554**，说明**同一契约变更的实现与其用例必须同提交**；③被实现依赖的 test-infra 配置（`vite.config.ts` 的 `css.include`）**必须排在其前**；④改写验收 = **逐提交干净检出**（`git worktree --detach`）跑 `vp check` exit 0。**已固化为记账纪律。**
- 2026-09-22：**PM 派单口径错误（命中抽检）** —— 我写「`(条左缘+2px)` 命中条本身」**几何上不可能**：左手柄 `.day-task-resize--start { left:-3px; width:8px }` ⇒ 手柄盒 = `[缘−3, 缘+5]`，`缘+2` 落在**左手柄**内（真机实测命中 `SPAN.day-task-resize--start`）。rd-fe 已把「条缘归属手柄」写成显式断言 + 用**缘+10px** 判条体。**教训：涉及命中区/手柄盒的派单口径必须给「几何区间」而非「示意点位」。**
- 2026-09-22：**判别力教训（重要，已入 ADR C12/r8）** —— 「条中点命中 `.cal-item`」**不能**判出覆盖层回归：条内文本 `.cal-item-text`（`z-index: 3`）仍在命中栈顶 ⇒ 覆盖层改回 `auto` 时该断言**仍绿**；必须用 **`elementsFromPoint` 命中栈不含覆盖层** + **空白点 `inTrack=false`** + **覆盖层 computed `pointer-events === 'none'`** 三条判红。**教训：断言要选「只有 bug 存在才失败」的量，而非「bug 存在时仍可能成立」的量。**
- 2026-09-22：**PM 笔误（CHANGELOG 提交号）** —— 我给 rd-fe 的 CHANGELOG 附件把 TASK-19B 第二个提交写成 **`99eac8ff9`**（**仓库不存在**），实际为 **`99d81aaf`**。rd-fe 逐条核对 19 个 SHA 后把该 token 落为真实 SHA，**未按笔误逐字落盘**（正确处置）。**PM 裁定：接受其修正**；**不改写已发布的 tag**（为一个笔误 force-push tag 得不偿失）。**教训：附件里的提交号必须逐条 `git rev-parse` 校验后再下发。**
- 2026-09-22：**`AGENTS.md` EOL 抖动 —— 已根治（方案 B，`abc92acc`）**：实测根因 = **`vp config`（= `prepare`，`pnpm install` 必跑）重写 `<!--VITE PLUS START/END-->` 托管区块时写死 LF 且不读 `.editorconfig`** ↔ **oxfmt 按 `.editorconfig` 强制 CRLF** ⇒ ping-pong（`vp config` 后脏 → `vp check --fix` 改回 → 提交判空被拦）。**修复**：`.editorconfig` 增 `[AGENTS.md] end_of_line = lf` + 该文件整文件归一为 LF（**内容逐字不变**，仅行尾）⇒ 注入器/oxfmt/编辑器**三方一致认 LF**。**PM 独立复核**：`vp config` 后 `git status` 空、`vp check` exit 0 后仍空（幂等，不抖）。
- 2026-09-23：**PM 编辑事故（同一轮连犯两次，已自捕自修）** —— 用 `edit` 给 `tasks-state` §四**插入新条目**时，两次都只把 `oldText` 写成**既有条目的开头**（如 `- **「是否引入 Playwright」= 不需要（2026-09-22 核查结论）**`），而 `newText` 是「新条目全文 + 换行」⇒ 结果变成**新条目正文直接续上旧条目的后半句**，把旧条目的锚点吃掉，形成「…不得据此判缺陷**」后紧接「：本仓「用例先行」…」这种**粘连**（一次吃掉「红基线」条，一次连带吃掉「Playwright」条，共 3 条边界受损）。**自捕方式**：提交前跑 `awk '/^## 四、/,/^## 五、/' | grep -cE '。：'`（粘连计数）与逐条 `^- ` 清单核对 ⇒ 定位并用**两处窄锚点**（`不得据此判缺陷**。：本仓` / `场景。）：仓库已有`）拆回独立条目，复验粘连 = 0、9 条独立。**纪律：给多条目列表插入/替换条目时，`oldText` 必须覆盖**整条（含结尾）**，或改为「锚定上一条的结尾 + 换行 + 本条开头」；改完必须跑「条目数 + 粘连标记」自检。**
    - 同类教训参见上文 2026-09-22 「PM 笔误（CHANGELOG 提交号）」：**PM 的文本编辑也需逐条核验**，不能只靠“看起来对”。