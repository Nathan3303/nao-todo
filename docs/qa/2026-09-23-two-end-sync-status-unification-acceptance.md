# 两端一致同步状态展示 + banner 改造 · QA 独立复核报告（T117）

- **任务**：T117（qa 独立复核，按 PM 派单 + 紧急范围削减）
- **验收对象**：TASK-25 阶段一.5 —— 顶部零挂载 + 全部同步状态入面板 + rail 角标（实现 `a31660f8`）
- **权威**：ADR `docs/adr/2026-09-23-two-end-sync-status-unification.md`（r7/r8/r9）· PRD AC（`docs/prds/2026-09-23-web-offline-stage1.md`，AC8/AC9/AC10/AC13b/AC17 二段式）
- **基线**：HEAD `50e8bdd4`（= `a31660f8` + docs-only 提交）｜工作区 **0 改动**（复核期间全部变异已还原）
- **方法**：**独立复跑**门禁 + **读断言/读码** + **真实 Chromium（CDP，一次会话）独立复验** + **契约变异独立重做**；**未修改任何实现代码**
- **纪律**：唯一仓内产物 = 本报告；**不采信 RD 自述**

## 结论（摘要）

**建议：Go（具备用户终签条件）。** AC8 / AC9 / AC10 / AC13b / AC17 二段式口径与实现**一致**；AC-13 web 经**真实 Chromium 独立复验 33/33 PASS**；颜色通道 C14/D2 **逐字零回归**；i18n **不增不删**；变异（新增 4 项 + M1–M6 + DEF-21）**全部如期转红并还原**。**未过项：无。** 附 **3 条需登记/更正**（见 §九）与 **人眼项清单**（§十，交用户）。

---

## 一、全范围门禁独立复跑（与 PM 基线逐项一致）

| #   | 门禁                                           | 我的独立复跑                                               | PM 基线 |
| :-- | :--------------------------------------------- | :--------------------------------------------------------- | :------ |
| ①   | `pnpm exec vp check`                           | **rc=0**；1386 文件格式 OK · 1186 文件 0 warning/lint/type | ✅ 一致 |
| ②   | `pnpm exec vp test --run`（**全仓**）          | **rc=0**；**148 文件 / 1254 例 / 0 红**                    | ✅ 一致 |
| ③   | `pnpm run guard:ddd`                           | **rc=0**（`[guard:ddd] OK`）                               | ✅ 一致 |
| ④   | `pnpm exec vp run webapp build`                | **rc=0**                                                   | ✅ 一致 |
| ⑤   | `pnpm run desktop:build`                       | **rc=0**                                                   | ✅ 一致 |
| ⑥   | 移动端红线（`presentation-react`/`mobileapp`） | **0**                                                      | ✅ 一致 |

**受影响测试文件单跑**（5 文件 / **36 例 / 0 红**）：`sync-status-bar.test.ts` 17 · `use-mirror-loaded-count.test.ts` 4 · `plaintext-notice.test.ts` 3 · `write-gate.test.ts` 5 · `deletion-wipe.test.ts` 7。

---

## 二、AC8 / AC9 / AC13b —— 二段式 + **N-2 降级项核实**

**真实 Chromium 实测（离线，`Network.emulateNetwork offline`）**：

- **零交互（不点开）**：轨道按钮 `class="... sync-rail-btn is-data-warn"` + `aria-label="同步 · 可能不是最新"`；`getComputedStyle(btn,'::after')` = `display:block / 6px×6px / rgb(207,115,23)` ⇒ **warn 角标为伪元素、确实常驻可见**。
- **点开面板**：② 行 =「离线模式 · 数据截至 2026/09/23 20:13」+「可能不是最新」；负向断言 **无 `null` / `Invalid Date` / `1970` / 数据丢失**。
- **AC9（alert 分支）**：本次会话账号已有镜像 ⇒ 走 warn 分支；**alert 分支**由既有 jsdom 用例（`离线 + 无镜像 ⇒ alert + 「尚未同步完成，数据可能不完整」`、面板 ③ 含 `incompleteHint`）覆盖，且 RD 实测同结论。
- **AC13b（在线 + 触顶 ⇒ alert 独立成立）**：jsdom 用例 `在线 + 触顶 ⇒ alert 角标 + ⑤ 行` 通过；N 取实际行数（`200`）/ 取不到退通用文案（`0 ⇒ 不出现「已加载 0 条」`）两例通过。

⭐ **N-2 降级项核实（登记与实际是否一致）**：**一致**。读码 + 实测确认「时间值 X」「引导语 `incompleteHint`」「N 数值」**只出现在面板 `<li>` 内**（组件 ②/③/⑤ 行）；零交互通道只有 `::after` 角标 + `aria-label`（异常态为**通用短语**，触顶用 `truncatedGeneric`、**不编造 N**）。⇒ PRD 登记的 N-2（三项需点开）与实现**逐条吻合**，**非静默降级**。

---

## 三、AC10 —— 写被拦截时 `NueMessage.warn` 为唯一提示时机

- **唯一调用点**：`grep -rn notifyReadOnly apps packages` ⇒ 仅 `write-gate.ts:36`（定义）与 `:77`（`withReadOnlyGuard` 内）⇒ **唯一提示时机成立**；节流 1200ms 由 `write-gate.test.ts` 5/5 绿覆盖（拦截 ⇒ warn 1 次且含「离线」；可写 ⇒ 不调用；节流）。
- **常驻提示已移除**：`grep -rn "readOnlyBanner|OfflineReadOnlyBanner|offline-status|plaintext-notice-banner" apps packages`（排除测试/locales）⇒ **零渲染点**。
- **端隔离**：`apps/desktop/.../usecases/binding.ts` 对 `withReadOnlyGuard` / `decorateUseCase` / `presentation/offline` / `isReadOnly` ⇒ **零引用** ⇒ desktop 写路径不受影响（C-59 r5）。
- **补位 = 轨道角标常驻**：实测离线时 `is-data-warn` 常驻可见（§二）；**窄屏（≤445px）无轨道 ⇒ 补位不成立**（`DEF-30`，见 §九）。

---

## 四、AC17 —— `NueConfirm` 单按钮 / Esc / 遮罩 / 登出后不重复（真实 Chromium 7/7 PASS）

| 检查     | 实测                                                                                                                   |
| :------- | :--------------------------------------------------------------------------------------------------------------------- |
| 首启弹出 | 清 `nao.plaintextNoticeAck` 后进入主界面 ⇒ `.nue-confirm-overlay` 可见，文案含「本地数据为明文保存」**且不含「加密」** |
| 单按钮   | 可见按钮 **仅 1 个**「我知道了」；**无取消按钮**（`unuseCancelButton: true` 生效）                                     |
| Esc      | 关闭 ⇒ `nao.plaintextNoticeAck` **仍为 null**；重载 ⇒ **再次展示**（确认后才不再展示）                                 |
| 遮罩点击 | **不写 ack**（无「确认」动作）⇒ 下次仍展示                                                                             |
| 确认     | 点击「我知道了」⇒ `ack=1` + 模态关闭；重载 ⇒ **不再展示**                                                              |
| 登出后   | 键在 `DEVICE_LEVEL_STORAGE_KEYS` 白名单内（`local-storage-policy.ts:42`）⇒ 登出清库不清 ⇒ 不重复弹                     |

⚠️ **口径更正（登记，非缺陷）**：nue-ui 的 `NueOverlay` **只处理 Esc**（源码 `overlay-*.js`：仅 `onKeydown … escape`，无 mask click 处理器）⇒ **遮罩点击是「无操作」，并非「取消」**。AC 相关结果（不写标记 ⇒ 下次仍展示）**成立**，但 PRD/ADR 写的「**遮罩 = cancel**」措辞不精确，建议改为「遮罩点击不触发确认（不改写已读标记）」。

---

## 五、AC-13 web 独立复验（**真实 Chromium + CDP，一次会话，33/33 PASS**）

> **勿采信 RD 的 18/18** —— 本轮为**独立脚本**（自建临时账号、自行导航、自定义检查集，不读 RD 的 report.json）。

| 检查                       | 实测                                                                                                                                              |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **顶部零挂载**             | 文档内 `.offline-status` **不存在**；`[class*=offline-status\|read-only-banner\|plaintext-notice-banner]` **零节点**；内容区直接子节点仅路由内容  |
| **注入点**                 | `#AppAsideRailBottomSlot` = `display:contents` 且 **rect 0×0**（父 `div.nue-div--aside__bottom`）                                                 |
| **按钮唯一且入注入点**     | 全文档 `.sync-rail-btn` **count=1**、`slot.contains(btn)=true`；注入点内仅 `div.nue-dropdown-wrapper`(24×24) + `div.sync-live-region`(1×1)        |
| **除同步组件外侧栏零新增** | 侧栏可见节点中，注入点外 **sync/dropdown/live 节点数 = 0**；**基线隔离**（移除注入点子节点 ⇒ 侧栏可见节点**新增集 = ∅**，消失节点全部属同步组件） |
| **齿轮 / 顺序**            | 齿轮中心命中 `AppAsideSettingsGearBtn`；按钮∩齿轮 **交集 = 0**；按钮在齿轮上方；导航可见链接 **4**                                                |
| **24×24 盒（AC-11）**      | 常态与离线角标显示时按钮均 **24×24**、`children.length = 1`（仅 `i.iconfont`）⇒ 角标为伪元素、**零 layout shift**                                 |
| **角标伪元素**             | 常态 `::after` `display:none`；离线 `display:block / 6px×6px / rgb(207,115,23)`                                                                   |
| **零控制台告警**           | `warnings() = []`（无 warn/error）                                                                                                                |
| **无横向溢出**             | `documentElement.scrollWidth <= innerWidth`                                                                                                       |

---

## 六、desktop 替代证据（独立判断）+ 环境阻塞证据链核实

**结论：替代证据内容可用，但「环境阻塞」前提未被独立证实，不宜作为终局替代。**

1. **替代内容核验**：替代运行 = 真实 desktop 装配（`apps/desktop` 依赖 **`nue-ui@1.10.58`**，已核实；webapp/根为 `1.11.0`）+ Chromium 载 `:5174` renderer + 同一 shell-02 检查集（**子集** `smoke-1/smoke-2/extras`）。报告 **PASS 24 / FAIL 5 / INFO 5**；PM 指定子集（AC-01/02/07/11 几何 + 颜色通道）**全 PASS**。
2. **5 项 FAIL 逐条判读（读检查集源码）**：
    - `AC-02.b`（tooltip 期望「按钮上方 top-center」）与 `AC-11.d`（面板期望「向右展开 dx>0」）⇒ **检查集与代码声明不一致**：代码为 `placement="right-center"`（tooltip）与 `placement="top-start"`（面板），且**基线 `67fb1ca1` 逐字相同** ⇒ **非本单回归**（检查集口径问题）。
    - `AC-04.a/c`、`AC-12.e`（同步中 loading/文案/live）⇒ 浏览器替身**无 Electron 会话**，`manualSync()` 未进入 `syncing` ⇒ 环境差异；该三态在 **jsdom 用例**（`三态文案` / `live region`）与既有 SHELL-02 验收中已覆盖。
3. ⚠️ **环境阻塞前提未复现（重要更正）**：我用**最小独立 Electron 探针**（`BrowserWindow{show:true}` 聚焦、data URL，无单实例锁/无后端）实测：**default(X11) / `--ozone-platform=wayland` / `--ozone-platform-hint=auto` 三种模式均 90–92 帧/1.5s、`ResizeObserver` 回调投递 1 次、`visibilityState=visible`、`focused=true`**。⇒ 「Wayland 下 Electron 不产生渲染帧 ⇒ RO 恒不投递」**不可复现**；RD 所述的 `observe body 1.5s → []` **原始产物未落在 evidence 目录**（`/tmp/t115b-evidence/electron*` 为空）。更可能的解释是 electron-smoke README §环境陷阱①所载的**窗口被遮挡/未置前台**（Chromium 判定 hidden ⇒ 节流渲染），而非 Wayland 固有缺陷。
4. **建议**：PM 裁定「采 (b)」我**不推翻**（几何/颜色子集证据充分且非回归）；但应**把「真实 Electron 冒烟」保留为待补项**（环境当前可跑），且文档中「环境阻塞」措辞应改为「本机自动化窗口遮挡导致，非代码缺陷」。

---

## 七、颜色通道零回归（C14/D2）+ 零 layout shift

- **逐字零回归**：`statusTheme` computed（同步中不着色 > 失败 > 待推送·暂停 > 常态）与基线 `67fb1ca1:apps/desktop/.../sync-status-bar.vue` **diff 为空**（`COLOR CHANNEL IDENTICAL`）。
- **取值集合**：替代运行 `AC-11.c` 常态色一致（`rgb(102,102,102)` vs 同）+ `D2.a/b`（pending=warning / failed=error）**PASS**；jsdom 优先级用例亦绿。
- **零 layout shift**：按钮/齿轮 **24×24**；角标走 `::after`（伪元素，无子节点）⇒ 角标显示前后按钮 rect **逐位不变**（§五实测）。

## 八、i18n 不增不删

- `a31660f8` **未改动任何 locale 文件**（`git show --stat` 无 `locales/**`）⇒ 键集合零增删。
- 无渲染点键**保留**：`offline.freshness.updated` / `offline.readOnlyBanner` 在 `zh-CN.ts` / `en-US.ts` / `types.ts` **三处齐备**；`grep` 渲染点 = **0**。

---

## 九、变异（独立重做，全部转红并还原，工作区最终 0）

| 变异                                                          | 目标断言                    | 结果（该文件红/绿）                                                                                |
| :------------------------------------------------------------ | :-------------------------- | :------------------------------------------------------------------------------------------------- |
| **① 禁用角标通道**（`dataBadgeClass` 恒 `''`）                | 通道③                       | `sync-status-bar.test.ts` **4 红 / 13 绿**                                                         |
| **② 删除面板 ② 行**（并令 ③ 的 `v-else-if` 合法化，隔离变量） | AC8 面板原文案              | **2 红 / 15 绿**（`AssertionError: expected '从未同步立即同步' to contain '离线模式 · 数据截至'`） |
| **③ 改常态 `aria-label`**（追加 `X`）                         | AC-12 既有断言              | **2 红 / 15 绿**                                                                                   |
| **④ 角标改为真实子节点**（破 24×24 盒）                       | AC-11 几何                  | **真实 Chromium 转红**：按钮 rect `24×24 → 32×24`（常态）/ `38×35`（离线），`children 1 → 2`       |
| **M1** `endRun.pullExecuted` 由 `ok` 反推                     | `sync.test.ts`              | **2 红 / 32 绿**                                                                                   |
| **M2** 写闸门套到 desktop                                     | `write-gate-wiring`         | **1 红 / 2 绿**                                                                                    |
| **M3** 触顶 N 换固定 2000                                     | `use-mirror-loaded-count`   | **2 红 / 2 绿**                                                                                    |
| **M4** `userId ?? ''` 兜底                                    | `userId-hard-fail`          | **4 红 / 1 绿**                                                                                    |
| **M5** 镜像新鲜度不落盘                                       | `mirror-status-persistence` | **2 红 / 2 绿**                                                                                    |
| **M6** 清库纳入 `deletionSchedules`                           | `deletion-wipe`             | **1 红 / 6 绿**                                                                                    |
| **DEF-21 分支** 禁用归一化网络类回退                          | `mirror-fallback`           | **4 红 / 9 绿**                                                                                    |

⇒ 契约被钉死（含新增角标通道与面板行）；**M1–M6/DEF-21 与 T111b 基线红数一致**。全部已还原，`git status --porcelain` 最终 **0**。

---

## 十、遗留项登记确认（读台账）

- **`DEF-30`（P2，窄屏 ≤445px 抽屉无同步面板 ⇒ AC8/AC9/AC13b 该分支不可验）**：缺陷池已登记，状态「挂账（后续小批次：抽屉亦绑定 `railBottomHost`；需先修订 SHELL-02 C5/AC-08）」✅ 与实际一致。
- **真实 Electron 冒烟遗留**：台账记为「待前台可渲染图形会话补跑」✅ 在册（**注**：见 §六.3，环境当前可跑，建议尽快补跑）。
- **`DEF-31`（P3，内容区头部布局根因待复现）**：缺陷池已登记「挂账（待 RD 提供复现证据后定级）」✅ 与实际一致。

---

## 十一、未做项 / 限制（如实登记）

1. **真实 Electron 冒烟**：按 PM 指示**未再尝试**（已停）；环境阻塞前提见 §六.3 更正。
2. **AC9 alert 分支的浏览器实测**：本轮 Chromium 会话账号已有镜像 ⇒ 实测到 warn 分支；alert 分支由 jsdom 用例 + RD 实测覆盖。
3. **遮罩「取消」措辞**：源码级核实为「无操作」，建议更正文档（§四）。
4. **RD 的 `observe body → []` 原始产物**：evidence 目录为空，未能核实该原始数据。
5. **收尾**：我起的探针/开发服务器已停；`9333` 上的 headless Chromium（`/tmp/t115b-chrome`，**RD 所起**，非本轮）`kill -9` 被 snap 限制**拒绝**（`权限不够`），**未能回收**，建议由用户/PM 处理。

---

## 十二、人眼项清单（**交用户**，机器不可判）

1. **冷启动无密码进入观感**（web/desktop）：进入是否顺滑、有无闪屏/白屏。
2. **轨道角标三态可辨识**：常态（无点）/ 离线·有镜像（warn 橙点）/ 不完整·触顶（alert 红点）在真实屏幕与双主题下是否一眼可分。
3. **面板文案可读性**：点开后「离线模式 · 数据截至 X」/「尚未同步完成…请连接网络后重试」/「已加载 N 条」的排版与可读性。
4. **首启明文告知模态**：观感 + 文案是否引起「已加密/受保护」误解（断言已禁「加密」字样）。
5. **设置页明文声明**（`DEF-22` 已修）：措辞是否清晰、无虚假安全感。
6. **真实 Electron 冒烟**（前台图形会话）：轨道按钮/齿轮几何、颜色三态、面板开合与焦点归还。
7. **窄屏 ≤445px**（已知缺口 `DEF-30`）：确认无同步状态是否可接受。

---

## 十三、证据与复现

- 门禁日志：`/tmp/qa-t117/gate.log`（独立复跑）· `/tmp/qa-t117/test-final.log`（全仓测试）
- AC-13/AC17 Chromium 报告：`/tmp/qa-t117/evidence/t117-ac13-report.json`（33/33）· 截图 `t117-web-ac13.png`
- 变异脚本与备份：`/tmp/qa-t117/mutations.sh` · `/tmp/qa-t117/mut/*.bak`
- desktop 替代报告（RD）：`/tmp/t115b-evidence/desktop-5174/report.json`
- 环境探针（最小 Electron）：`/tmp/qa-t117/el-min/main.cjs`（实测输出见 §六.3）
- 临时账号：`qa.t117.1790165279@qa.local`（id `472012205965971456`）⇒ **已硬删回滚**：`user_configs`/`user_sessions`/`users` 各 1→**0**，其余业务表 0；**通用孤儿扫描 12 表全 0**。

## 变更记录

| 日期       | 变更                                                                                                                                                                  |
| :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-23 | 首次成文（T117）：门禁独立复跑（与 PM 一致）+ AC8/9/10/13b/17 二段式 + AC-13 web 独立复验 33/33 + 变异 11 项全红 + desktop 替代判断与环境链更正 + 遗留确认 + 人眼清单 |