# T738 独立复验 · 桌面端应用内自我更新（Issue #358 · PR #359 @ `0b3dd20f`）

> 复验人：qa ｜ 日期：2026-11-20 ｜ 性质：**独立证伪**（不复述 RD 回执，全部数字自跑）
> 约束遵守：独占工作区（`git status` 空、无并发 vitest）· 未改实现/测试/PRD/设计稿（15 次变异均按字节还原，收尾 `git diff` 空）· 探针全放 `/tmp/t738-probe/`（已删）· 只写本报告 + `358-qa-cases.md`

## 零、结论：**无条件 PASS**（T741 收口后）

产品行为与门禁全绿；T738 提出的 4 项缺陷已由 RD 全部闭环（见 §四），并由 PM 在 T741 做机械复核 —— qa 该轮三次被网络中断（`ECONNREFUSED`）未能复签，复核手段与数字见 §一 末「PM 收口复跑」，全部为亲自变异/复跑，不引用他人宣称。

| AC                           | 判定                 | 判据 / 我的观测手段                                           | 实测值                                                                                                                                                                                           |
| :--------------------------- | :------------------- | :------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 展示版本+新版本+可点     | PASS                 | 内核探针 + 面板 `available` 用例                              | `state=available`·`currentVersion=1.20.3`·`latestVersion=1.21.0`·`sizeBytes=125829120` 透传；面板有 `download` 动作并调 1 次                                                                     |
| AC2 下载→重启（0/0/1）       | **判据缺维度（红）** | 内核探针 install 计数 + 面板 `ready` 用例 + 变异 M14          | 检查后 **0**·下载后 **0**·`install()` 后 **1**·重复点仍 **1**；但「点『稍后』⇒ 不安装」**无任何断言**⇒ M14 存活                                                                                  |
| AC3 Win/AppImage 原地生效    | 部分（无真机）       | 只能核 `resolveInstallMode` + 适配器安装调用                  | `win32`+打包 ⇒ `in-place`·`linux`+`APPIMAGE` ⇒ `in-place`·installer 实调 `quitAndInstall(false,true)`；**生效性无自动化**                                                                        |
| AC4 失败可读原因+重试+下载页 | PASS                 | 探针 5 类错误 + 面板 `failed(check)` + 变异 M11               | `offline/server/timeout/disk/unknown` 五码齐·请求计数 1·`openPage=1`·恒不进 `up-to-date`；M11 杀 5 红                                                                                            |
| AC5 中断/哈希失败不进 ready  | PASS                 | 探针 3 种 outcome + 抛错 + 重启恢复 + 适配器 sha512 + M5      | `failed(download\|verify)`·`installer=0`·`updateAvailable=false`·重试 `downloader=2` 后 `ready`·重启恢复 `available`（非 ready）；M5 杀 1 红                                                     |
| AC6 相等⇒已是最新            | PASS                 | 20 组版本判定表探针 + 面板 + M2                               | `1.20.30>1.20.3`✓·`1.20.10>1.20.9`✓·`v/V` 前缀✓·相等 `false`✓·`1.20.3-beta`/`1.20`/`1.20.3.4`/空/`latest` ⇒ `false`✓；相等态 0 主按钮                                                            |
| AC7 mac/deb 降级             | PASS                 | 9 行判定表探针 + 「降级后 download 计数」                     | `darwin`⇒`download-page+mac`·`linux` 无 `APPIMAGE`⇒`+deb`·`win32` 未打包⇒无原因·判定后 `download=0`、`openPage=1`；M6 杀 2 红                                                                    |
| AC8 24h 缓存                 | PASS                 | 真 temp dir + 注入时钟探针（4 边界）+ M3/M12                  | `23:59:59.999`⇒**0** 请求·`24:00:00.000`⇒**1**·`+1ms`⇒**1**·同毫秒⇒**0**；重启后仍 `available` 且 `lastCheckedAt` 沿用；手动检查 **1** 请求                                                      |
| AC9 数据护栏                 | PASS（有牙）         | 面板 4 用例 + 变异 M1/M13/M15 + 内核闸探针                    | `pendingCount>0`⇒卡 A 开、`restart` 未调；取消后仍 `ready`；`force` 才装（`installer=1`）；换 `failedCount` 判据 ⇒ **5 红**                                                                      |
| AC10 零外溢                  | PASS                 | 面板 Web 用例 + M8 + 静态 + git                               | Web 端更新卡节点 **0**·版本行逐字不变·状态 `available` 也不渲染；web 桩 0 处 `fetch/bridge`；移动端 `diff`/`status` = **0 行**；`guard:mobile-imports` rc=0                                      |
| AC11 失败后可再触发          | PASS                 | 内核（失败→再查→可下）+ 面板（retry 后按钮复原、click=2）+ M7 | 第二次检查 `available`、下载 `ready`；`failed` 态检查按钮非 disabled；M7 杀 1 红                                                                                                                 |
| AC12 三态三重冗余            | PASS                 | 8 态表驱动用例 + M9 + 独立对比度计算 + `DESIGN.md` 登记核对   | 8 态符号/文字/tone 类全断言；`checking` 走 `LoadingError`；文本 **4.95/6.67/8.97**、图形 **3.78/5.31/7.35** 全达标；30px 例外**确在 `DESIGN.md` §3 第 74 行登记**、`checking` 口径在 §4.1 已登记 |
| AC13 i18n                    | PASS                 | locale 用例（40 键双语言）+ M10 + 去注释中文扫描              | 40 键 zh/en 齐备、内部术语黑名单 0 命中、八态文字互不相同；UI 文件中文残留 **0**（仅桌面 hook 4 处 `console.error`，非 UI 文案）；M10 杀 1 红                                                    |

**放行条件（T741 收口后）= 已全部满足**：① QA-01 已补断言并自证有牙（`0b8d4d7a`）② QA-02 已改注释、行为零变更 ③ QA-03 已补 `reason` ④ QA-04 已入库 28 例；②③④ 未走「接受挂账」出口，均当场修完。

## 一、环境与门禁（全范围，精确数字；`pgrep -af vitest` 空 + 工作区干净后开始）

```text
pnpm exec vp test --run          → Test Files 463 passed | 1 skipped (464) · Tests 3656 passed | 6 skipped (3662) · 0 failed · exit 0（292.18s）
pnpm exec vp check               → 2019 文件格式 pass · 1608 文件 lint+type 0 error · exit 0
pnpm run guard:ddd               → OK（domain 未引 shared 根桶/展示层）· exit 0
pnpm run guard:barrel-imports    → 1608 文件 / 1793 导入 / 2598 命名 全部可解析 · exit 0
pnpm run guard:mobile-imports    → 72 文件 0 违规 · exit 0
pnpm run guard:gate-pathspec     → pathspec 均存在 · exit 0
pnpm run guard:test-location     → 456 受检文件全在 __tests__/ · exit 0
pnpm exec vp run webapp build    → built in 15.13s · exit 0
pnpm run desktop:build           → built in 20.31s · exit 0；guard:dist-comments OK（116 产物，无中文注释/内部编号）
```

- 定向面：`vp test --run apps/desktop` = **30 文件 / 296 例 / 0 红**；内核面 **7 文件 / 86 例**；web 卡+hint+locale **58 例**；desktop hook **12 例**（与 RD 自报一致，但数字为我自跑）。
- 产物核对：`apps/desktop/out/main/index.js` 中 `electron-updater` **仅**在 `loadAutoUpdater()` 内 `requireFromMain(...)`（第 413 行），**无顶层引用** ⇒ `d9dae92d` 的惰性加载在产物里成立。
- 环境噪声（不判缺陷）：全仓 292s 高于 82–156s 基线，单次无对照 ⇒ 只记录不结论；1 个 skipped 文件为预存 `t326/t608/t717` 系，与 #358 无关。

**PM 收口复跑（`026314d3` 之后，PM 亲跑；独占工作区、无并发 vitest）**

```text
pnpm exec vp test --run   → Test Files 464 passed | 1 skipped (465) · Tests 3686 passed | 6 skipped (3692) · 0 failed · exit 0（317.84s）
pnpm exec vp check        → 2022 文件格式 pass · 1609 文件 lint+type 0 error · exit 0
guard:ddd / barrel-imports / mobile-imports / gate-pathspec / test-location → 五条全 exit 0
vp run webapp build       → 17.44s · exit 0
pnpm run desktop:build    → 19.59s · exit 0（guard:dist-comments 116 产物 OK）
移动端红线 git status --porcelain -- packages/presentation-react apps/mobile → 0 行
```

PM 复核 4 项闭环（各自独立动手，非引用）：

- QA-01：把「稍后」的 `@click` 改成「改本地态 + `restartAndInstall()`」⇒ 面板 **1 红 / 40 绿**（失败点正是 `restart` 未被调用）；`cp` 还原后 `cmp` 字节一致 ⇒ **41 例 / 0 红**。
- QA-02：`grep -rnE "纵深防御|最后一道闸|双保险|复核队列"` 于 `updater/**` + `shared/types/desktop-update.ts` ⇒ 仅剩否定句；`026314d3` 中 `index.ts` / `core.ts` diff 只含注释与文档。
- QA-03：9 类原因码断言在跑；qa 上一轮自身在该文件的变异（去掉 `reason`）实测 **11 红 / 17 绿**。
- QA-04：`adapter-electron-updater.test.ts` **28 例 / 0 skip**（`it.skip|describe.skip|only|todo` 命中 0）；静态守卫例外按**精确相对路径**放行（常量比较），非按内容匹配 ⇒ 无绕过面。

## 二、主动证伪：15 个变异 → 14 杀 · 1 存活

每次「改 1 行实现 → 跑目标用例 → 观察红 → `git checkout` 按字节还原」，逐次以 `git diff --stat` 确认变异**确实生效**（⚠️ 第一次 M4 因文件是 CRLF，正则未命中 ⇒ 变异其实没打上，是假绿；改用 CRLF 安全的写法重跑才杀到，教训记在此备查）。

| #       | 变异（改一行）                           | 目标 AC | 结果                                           |
| :------ | :--------------------------------------- | :------ | :--------------------------------------------- |
| M1      | 护栏判据 `pendingCount` → `failedCount`  | AC9     | **杀**（5 红，含「判据不是 failedCount」那条） |
| M2      | `isNewerVersion` `>` → `>=`              | AC6     | **杀**（2 红）                                 |
| M3      | `isCheckFresh` `<` → `<=`                | AC8     | **杀**（2 红）                                 |
| M4      | 下载成功即 `await installer.install()`   | AC2     | **杀**（3 红，含「installer 恒为 0」）         |
| M5      | 校验失败也进 `ready`                     | AC5     | **杀**（1 红）                                 |
| M6      | macOS 误判 `in-place`                    | AC7     | **杀**（2 红）                                 |
| M7      | `failed` 态禁止再检查                    | AC11    | **杀**（1 红）                                 |
| M8      | 去掉更新卡 `v-if="isDesktopUpdater"`     | AC10    | **杀**（2 红：Web 端出现更新卡）               |
| M9      | `available` 语义色 `warning`→`muted`     | AC12    | **杀**（1 红）                                 |
| M10     | zh-CN 删 1 个更新文案键                  | AC13    | **杀**（1 红）                                 |
| M11     | 检查失败吞掉、不改状态                   | AC4     | **杀**（5 红）                                 |
| M12     | 手动检查也走缓存                         | AC8     | **杀**（1 红）                                 |
| M13     | 忽略 `force`（二次确认永远无效）         | AC9     | **杀**（1 红）                                 |
| M15     | 「立即重启更新」绕过护栏直装             | AC9     | **杀**（4 红）                                 |
| **M14** | **点「稍后」也调 `restartAndInstall()`** | **AC2** | **存活（40/40 全绿）⇒ 判据缺维度 ⇒ 置红**      |

## 三、独立探针（不借 RD 用例，直接驱动真实实现）

- 内核/缓存/判定表：`esbuild` 打包 `core/store/version/install-mode` 后用**假五端口**驱动真实代码 ⇒ **139 条断言全 PASS**（版本表 20 组、24h 边界 4 档、installer 计数、AC5 三种失败、AC7 九行表、失败原因五码、八态迁移、历史落盘、损坏缓存不抛错）。
- adapter 层（RD **无仓库内用例**）：`vitest` + 假 `electron-updater` 实例驱动真实 adapter ⇒ **9 条断言全 PASS**（`autoDownload/autoInstallOnAppQuit` 强制 false、超时 10s 抛 `UpdateCheckTimeoutError` 并取消 token、sha512 ⇒ `stage:'verify'`、installer ⇒ `quitAndInstall(false,true)`）。
- AC12 对比度：自算 WCAG 比值（不引 `DESIGN.md` 现成数字），9 个 token 对 `#fff`：文本 4.95/6.67/8.97、图形 3.78/5.31/7.35 **全达标**；去色后语义色两两 **1.03/1.47/1.52**（<3）⇒ 印证「三重冗余必需」。

## 四、缺陷（均为测试资产/低风险面，产品行为正确；我不自行修复）

- **QA-01（P2 · AC2 · 测试资产）—— ✅ 已闭环（`0b8d4d7a`）**「点『稍后』⇒ 不安装/不重启」无断言。复现：把 `data-panel.vue` 的 `@click="laterDismissed = true"` 改成 `@click="((laterDismissed = true), restartAndInstall())"` ⇒ 40/40 仍全绿。现状代码正确（`@click` 只改本地态），但该不变量无回归保护。
- **QA-02（P3 · AC9）—— ✅ 已闭环（`026314d3`，仅改注释、行为零变更）** 生产装配 `setupDesktopUpdater` 的 `syncGuard: { hasPendingChanges: () => false }` 是**常量**（`updater/index.ts:58`），注释却称「纵深防御」⇒ 主进程闸在生产链路里从不生效，AC9 只靠渲染层单点判定。
- **QA-03（P3 · AC5）—— ✅ 已闭环（`026314d3`，补 `reason` + 真实网络栈超时码）** adapter 的下载失败只给 `stage`、不给 `reason`（`classifyDownloadOutcome` 仅返回 `{ok:false, stage}`）⇒ 真实网络中断/超时一律落 `unknown`，界面恒显示「更新没能完成，可以再试一次」，与设计稿 §5「离线/超时/服务不可用」四分类不符（`core.classifyFailure` 有该能力，但只在 downloader **抛错**时才用得上）。
- **QA-04（P3 · 覆盖）—— ✅ 已闭环（`026314d3`，adapter 入库 28 例）** adapter（274 行，唯一接触 `electron-updater` 的文件）在仓库内**零用例**，其超时/校验失败/进度节流仅靠注释与静态守卫；我用 `/tmp` 探针 9 例补证通过（建议入库或登记接受）。
- **观察（不判缺陷）**：① 进度轨 `--nue-primary-color-100` 对白底 **1.25:1**——承载语义的是填充段（17.40:1）与文字百分比，轨道属装饰，口径同 `DESIGN.md` §2「边框仅装饰」；② 桌面 hook 4 处 `console.error` 含中文（仅开发日志，非 UI 文案）；③ 设计稿 §4 写 `warning-90` = 6.73，实测/`DESIGN.md` 为 **6.67**（以 `DESIGN.md` 为准）；④ AC1 文案「有新版本 1.21.0」无 `v` 前缀——`358-…-copy.md` 定稿即为无 `v`，AC 里的 `vX.Y.Z` 属示例写法；⑤ 开发态 `linux` 无 `APPIMAGE` 也会标 `deb` 原因（仅开发态可见，文案略偏）。

## 五、未覆盖与风险（**无自动化证据，只靠真机或用户走查**）

1. **AC3 原地生效**（Windows NSIS / Linux AppImage 替换后重启真生效）+ **AC2 后半「重启后显示新版本号」**：只有纯函数级 + 适配器调用级证据，`readyVersion===currentVersion ⇒ just-updated` 仅单测。⇒ 需真机/发布后首个真实升级。
2. **AC9 / AC12 的视觉呈现**（卡片版式、卡 A 观感、30px 密度、focus 环、弱提示 6px 环）：按项目分工由**用户走查**，本报告只给 token/尺寸/对比度级证据 ⇒ 另附用户验收清单。
3. **AC4 / AC5 真实网络与哈希链路**：单测全在端口后，真实 `electron-updater` 网络栈行为无自动化（依赖发布后观察 + 本地日志）。
4. **AC8 的「发布源一致性」**（`latest*.yml` 版本 = tag = `package.json`）：属 PM 发布检查项，非 QA 自动化面。
5. 全仓测试 292s（高于基线）为环境噪声，本次无对照不结论。

## 六、发布建议

- **先补 QA-01 一条断言**（约 3 行）再合并；QA-02/03/04 可由 PM 判「接受 + 登记到期日」，不阻塞本需求（均不影响 AC 当前表现）。
- 发布检查项追加：Release 三处版本一致（PRD §八 已列，请在本次发版执行一次）。
- 真机兜底照 PRD §八 执行：Windows 首装 + 原地升级各一次；macOS/deb 走用户验收清单。