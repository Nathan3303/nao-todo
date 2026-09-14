# SHELL-05 验收报告：离线边界加固（T1–T6 生产构建回归）

- **日期**：2026-09-13
- **角色**：QA（测试工程师）
- **任务**：`SHELL-05 T7`（生产构建离线回归 + 用户原始场景 + 离线功能面走查），**只测不改**
- **被测基线**：`c1f86354`（HEAD，含 T1–T6 全部交付）
    - T1 `6273acc3`（H6 依赖去重 + `$router` 降级）· T2 `f7576426`（门/壳必达兜底）· T3 `0b031a4c`（全局可观测）· T4 `3f288ffa`（目标合法化）· T5 `3c6a8fc6`（内容视图终态）· T6 `e58cf46f`（四条件/凭证结构化）+ `c1f86354`（N-02）
- **运行方式**：`pnpm desktop:build` **生产产物**（`electron-vite build`，terser 生产丑化），`file://` 加载 `apps/desktop/out/renderer/index.html`；Electron `43.4.1` / Chromium `150.0.7871.224`；CDP 驱动真实鼠标/键盘。
- **证据目录**：`docs/reports/evidence/shell-05/t7/`
- **总结论**：**PASS**。**用户原始场景已闭环**（生产断网冷启动 → 解锁 → 离线进入 → 门关闭 → 进入任务、无 `TypeError … 'replace'`、内容非 loading）；AC1–AC10 全过；SHELL-03 抽验 20 PASS/0 FAIL；离线功能面走查 14 可用 / 0 真实不可用 / 8 未覆盖 / 3 降级。新发现 1 个离线未捕获异常（**N-04**，非阻断）。

---

## 1. 生产构建与产物 hash（BC-12）

| 构建                      | API Base                            | 入口 chunk                       | sha256                                                             | vue-router 实例数 |
| :------------------------ | :---------------------------------- | :------------------------------- | :----------------------------------------------------------------- | :---------------- |
| B1 默认生产               | `https://todobe.nathanao.space/api` | `index-5cd2LKBq.js`（174.88 kB） | `52169b9dc4860ffd4267b70efec0be19da8984c3d2ad9651f78c498784da37be` | **1**             |
| B2 运行用（API 覆写本地） | `http://localhost:3302/api`         | `index-COw2sUKV.js`（174.87 kB） | `3643452cc243b50164febce5521f080a541c1b9c923229bcf4be8d3f8003bc92` | **1**             |

- `assets/vender/vue-router-Bo2RCaOp.js` = `427aa6f916649503de398b12a2d8ec302025e980c741af95b83e224555dfecb8`（B1/B2 一致）。
- `apps/desktop/stats.html`：`vue-router@5.2.0_…_@vue+compiler-sfc@3.5.41_esbu_996…` **仅 1 条**（修复前为 2 条）；`vue@3.5.41`、`pinia` 亦单实例。**H6 根治在构建层确认**。
- 运行产物的 `index.html` = `52ff4ea6d6e060e1037afdda7777f6ad8ace6d6fe7ff77b1b23a2ad01cc9814c`。
- **`$router` 降级层**存在：`index-COw2sUKV.js` 内含 `router-injection:*` 结构化告警分支；本次运行日志 **0 条降级告警** ⇒ `useRouter()` 走 composable 健康路径（AC1b）。

---

## 2. AC 结论表

| AC                                                       | 结论                       | 证据（`evidence/shell-05/t7/`）                                                                                                                                                                                                                                        |
| :------------------------------------------------------- | :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC1** 生产离线进入可达、无 `TypeError 'replace'`       | ✅ PASS                    | 门 `true→false`；落 `#/tasks/all/table`（`tasks-built-in-project-main`）；`reading 'replace'` 命中=false                                                                                                                                                               |
| **AC1b** 注入自检 router 可用 / `$router` 降级           | ✅ PASS                    | `errorLog` 无 `router-injection:*`（composable 路径）；构建层单实例                                                                                                                                                                                                    |
| **AC2** 内容有限时间进入非 loading 终态                  | ✅ PASS                    | 3s/10s `loadingText=false`；body 显示「所有任务…还没有任务，开始创建一个吧」（显式空态）                                                                                                                                                                               |
| **AC3** 导航 reject 仍进终态 + 结构化记录                | ✅ PASS                    | AC3 专项：注入 `router.beforeEach` 抛错 → 门 300ms 关闭；日志 `["router:onError","app-root:offline-navigation"]` 含注入标记                                                                                                                                            |
| **AC4** `syncService.start()` reject 不永加载            | ✅ PASS（单测 + 实机归因） | `runSync` `try/catch/finally`；实机 `[sync]` 网络失败后门达 failed 三键；异常分支由单测覆盖                                                                                                                                                                            |
| **AC5** 失效 `LAST_VISITED`/`/auth/*` 回退、清理、不白屏 | ✅ PASS                    | 注入 `/definitely-not-a-route-xyz`+`/also-invalid-xyz` → 落 `#/tasks/all/table`，`matched` 4 项、非 auth；失效串不再残留                                                                                                                                               |
| **AC6** `/tasks` 无 viewType 自愈默认 table              | ✅ PASS                    | 注入 `LAST_VISITED='/tasks'` → `router.params.viewType='table'`，内容非 loading                                                                                                                                                                                        |
| **AC7** 未捕获异常结构化、无 PII                         | ✅ PASS                    | `__NAO_ERROR_LOG__` 可导出；缓冲正则命中 email/Bearer/JWT 全 false                                                                                                                                                                                                     |
| **AC8** 无 `deletion-notifier` TypeError                 | ✅ PASS                    | 进入壳全量 console/异常无 `isPending`                                                                                                                                                                                                                                  |
| **AC9** 四条件不满足显式出口 / 凭证失败不展示离线进入    | ✅ PASS                    | E：清 JWT 后点「离线进入」→ 仍在门、显式文案「无法离线进入，请重试或重新登录」、日志 `sync-gate:offline-prerequisites`；F1：mock 10041 → 离线进入 absent、主按钮「重新登录」；F2：mock HTTP 401（文案含「登录已过期」）→ `credentialFailure=false`，离线进入**仍可见** |
| **AC10** 回归（在线/双主题/SHELL-03/guard）              | ✅ PASS（详见 §4、§5）     | 在线壳可进、双主题 `--nue-dark-switch` 0/1 均渲染、SHELL-03 BC-1/2/5/7 20 PASS/0 FAIL                                                                                                                                                                                  |

**核心日志（AC1/AC2 侧，节选）**：`[sync] 拉取归一化错误（断网/超时） ERR_NETWORK`，**无** `TypeError … 'replace'`、**无** `[Vue warn] Unhandled error … onOffline`。

---

## 3. 自动化结果计数

| 套件           | 命令                                                | 结果                                                       |
| :------------- | :-------------------------------------------------- | :--------------------------------------------------------- |
| T7 主回归      | `shell-05-verify.mjs`                               | **PASS 24 / FAIL 1 / INFO 2**（唯一 FAIL 见下）            |
| AC3 专项       | `shell-05-ac3.mjs`                                  | **PASS 5 / FAIL 0**                                        |
| SHELL-03 抽验  | `run.mjs --feature shell-03 --only bc1,bc2,bc5,bc7` | **PASS 20 / FAIL 0 / SKIP 0 / INFO 13**                    |
| 离线功能面走查 | `shell-05-offline-sweep.mjs` + 定点探针             | 可用 14 / 不可用 1（**假阴性**，见 §5）/ 未覆盖 8 / 降级 3 |

> 主回归唯一 FAIL = **B 场景「注入导航 reject」未真正触发**：`Network.emulateNetwork{offline}` 未能阻断**已加载/本地 `file://`** 的路由 chunk，导航照常成功（门仍按时关闭），故无 reject、无错误记录——属**注入有效性**问题，非产品缺陷。已用 **AC3 专项**（真实 `router.beforeEach` 抛错）替代验证并通过。

---

## 4. SHELL-03 抽验（干净在线态起跑）

`bc1` 可解锁态 2ms、唯一终态；`bc2` 无白屏、无致命日志；`bc5` 离线进入落 `#/tasks/all/table`、轨道/齿轮/同步按钮齐备；`bc7` 缓存白名单 `userId/nickname/cachedAt`、首字母头像「Q」+ 离线标识、清缓存回落 `icon=user`、缓存路径静默。**PASS 20 / FAIL 0**（`report.txt`）。

> 首次抽验（未清理现场）出现 5 FAIL，根因是上一条用例把应用留在 `#/auth/checkin` 失败门、`bootstrap` 未能自愈——**环境态污染**，已用全新隔离 profile 复跑为 0 FAIL。

---

## 5. 离线功能面走查（用户追加口径）

前置：**生产构建 B2 + 断网（封锁 `localhost:3302`）+ 已离线进入**（`#/tasks/all/table`）。逐项状态：

| 模块      | 项                           | 状态                                | 证据                                                                                                                  |
| :-------- | :--------------------------- | :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| 任务      | 浏览 表格/列表/看板          | ✅ 可用                             | 路由 `viewType` = `table`/`list`/`kanban`，console errs=0                                                             |
| 任务      | 新建                         | ✅ 可用                             | `n` → 对话框 → `创建` → 标题出现（`appeared=true`；另 probe 见「创建任务成功」）                                      |
| 任务      | 详情 / 子任务 / 检查事项入口 | ✅ 可用                             | 点击标题 → `#/tasks/all/table/<id>`，`.tasks-details-view` + `.tasks-details-view__subtasks` 存在                     |
| 任务      | 勾选完成                     | ⬜ 未覆盖                           | 自动化未定位完成控件（表格行为自定义控件，非 `input[type=checkbox]`）                                                 |
| 任务      | 编辑名称/描述、删除          | ⬜ 未覆盖                           | 抽屉可开，未执行字段编辑/删除（需人工或专项脚本）                                                                     |
| 任务      | 拖拽排序（子任务/检查项）    | ⬜ 未覆盖                           | CDP 无稳定拖拽手势封装                                                                                                |
| 日历      | 进入 + 月视图                | ✅ 可用                             | `#/calendar/monthly`，出现「2026 年 9 月」/「月/周」切换，errs=0                                                      |
| 日历      | 切换周视图                   | ✅ 可用（入口可点，未断言内容差异） | 「周」按钮 `title="切换周视图"` 可点，errs=0                                                                          |
| 日历      | 查看任务条                   | ⬜ 未覆盖                           | 离线本地无日程任务，未构造                                                                                            |
| 番茄      | 进入 + 启动计时              | ✅ 可用                             | 点击「开始专注」→ 显示 `25:00→24:55` 倒计时 + 「结束」，errs=0                                                        |
| 番茄      | 暂停/停止                    | ✅ 可用                             | 「暂停」按钮可点，errs=0                                                                                              |
| 番茄      | 记录页                       | ✅ 可用                             | `#/pomodoro/records` 渲染                                                                                             |
| 搜索      | 输入 + 结果                  | ✅ 可用                             | 输入「QA离线」→「找到 1 条 QA离线走查任务-A」                                                                         |
| 搜索      | 筛选面板                     | ✅ 可用                             | 「清单/标签/优先级/状态」可点开                                                                                       |
| 清单/标签 | 侧栏显示 / 切换              | ✅ 可用                             | 侧栏「清单/标签」可见、可切换                                                                                         |
| 清单/标签 | 创建 / 重命名                | ⬜ 未覆盖                           | 未见稳定「新建清单」按钮锚点，未执行                                                                                  |
| 设置      | 打开对话框                   | ⚠️ 降级                             | 可打开；但**切到「账户与个人信息」触发未捕获异常 → 见 N-04**                                                          |
| 设置      | 主题切换                     | ✅ 可用                             | 点击 light 主题卡：`--nue-dark-switch` `1 → 0`（dark/light 均可渲染）                                                 |
| 设置      | 语言切换                     | ✅ 可用                             | 语言下拉选「English」→ UI 文案切英文（`Projects/Use projects…`），errs=0                                              |
| 本地提醒  | 解锁后调度                   | ⚠️ 降级（静态）                     | `useLocalReminder.start()` 于 `unlock` 触发、无网络依赖；无 DOM 锚点故仅记录环境（`Notification.permission=granted`） |
| 同步      | 状态面板失败/待推送          | ✅ 可用                             | 面板显示「从未同步 / 拉取失败：网络错误 / 立即同步」                                                                  |
| 同步      | 不阻塞功能                   | ✅ 可用                             | 同步失败态下上述任务/日历/番茄/搜索均正常操作                                                                         |

**结论**：**离线进入后，除「同步」外的主要功能均可本地使用**；网络仅影响同步状态展示与数据往返；无功能因同步失败被阻塞（符合用户口径）。走查中唯一的真实异常见 N-04（设置页，非阻断）。

### N-04（新发现，独立于 SHELL-05 范围）

- **现象**：离线（`profile=null`）打开「设置 → 账户与个人信息」→ 未捕获异常
  `TypeError: Cannot read properties of undefined (reading 'deactivedAt')`
  （`vue:errorHandler` 已结构化落盘，非白屏、非阻断）。
- **位置**：`packages/presentation-identity/src/components/deactive-manager/index.vue:35`
  `v-if="!profile.deactivedAt"`——`profile` 为 `undefined` 时直接取属性（与已修 N-02 同族：网络装饰数据未判空）。
- **证据**：`evidence/shell-05/t7/theme-n04.json`（`accountTabErr` 全文栈）。
- **建议**：`profile?.deactivedAt` / 判空后再渲染；并核对 `password-updater` 等同族「仅在线可用」区块的离线降级（本单非范围）。

---

## 6. 未覆盖 / 残留风险

1. **未覆盖项**（§5 标 ⬜）：任务勾选完成/编辑/删除/拖拽排序、日历任务条、清单创建与重命名、设置保存动作。建议另派人工冒烟或补专项脚本。
2. **N-04**：离线设置页未捕获异常（已结构化、不阻断）；建议随下一批修复。
3. **B2 运行产物 API 覆写为 localhost**：仅影响网络目标，不影响构建/依赖解析结论；用户侧应以 **B1 默认产物**为准。
4. **electron-builder 打包（`dist`）未做**：`file://` 加载方式与打包态一致，判定风险低。
5. 测试账号 `qa.shell05.1789301180@qa.local` 写入若干离线测试任务（本地加密库，dev 库无 DELETE 端点）；用户本地 `~/.config/@nao-todo/desktopapp` **未被污染**（全程 `XDG_CONFIG_HOME` 隔离）。

---

## 7. 脚手架改动披露（测试专用）

- **新增**：`scripts/electron-smoke/shell-05-verify.mjs`、`shell-05-ac3.mjs`、`shell-05-offline-sweep.mjs`。
- **未改**：`run.mjs`、`lib/*`、既有 `checks/*`、任何功能代码。
- 三类脚本均只读注入（console/异常探针）与 CDP 网络/响应改写（模拟离线、10041、401），并在用例末清理（`unblockUrls` / `clearMocks` / 移除注入守卫）。

---

## 8. 冻结文件 hash 清单（本轮被测源码未改动，`sha256`）

```text
f113f653fb48485a9de7a28c00064d6da7fc49ff75fd8824bba3d582aad84896  apps/desktop/src/renderer/src/AppRoot.vue
1afc3b2f980c7a521759ee865e12a5cd44259f265261168007c6d30e08e1ae54  apps/desktop/src/renderer/src/components/initial-sync-gate.vue
186e52f327118b1a69050e250ec7b125ea34c25e8e3f15f1934c76e1648e1b2c  apps/web/src/router.ts
7b33c7cb5c3b162f0e34b060bc921d51d1a06bb0df39be04e5c865cc70cca9ea  apps/web/src/router-access.ts
d3f98d81c9cef60e7f9d51a56e526450db5ea643dd7b09f48eee806b0460c603  apps/web/src/safe-navigation.ts
5d191c3d3a05bbd6947161d705cccd83610001a6bac17d2edd7220364f869002  apps/web/src/error-observability.ts
46ae40a8be93018ac5562d6959f37b02df58536eea2c3cb3bd3ba43ad35a447f  apps/web/src/views/auth/offline-prerequisites.ts
d22b0307fe66cab5e3e8fa384d39680e336848761210eada7b75e0199fb85171  packages/presentation-identity/src/components/deletion-notifier/index.vue
f9f956912ed8ccad2a516aa6bd275b58cab1a378402b8321d83c0395ef64ee91  packages/presentation-identity/src/components/deactive-manager/index.vue（N-04 现场，未改动）
```

> **权威冻结基线 = `git rev-parse HEAD` → `c1f86354b4a26fa00e62ec0813ceeca467c607d3`**；工作区无功能代码改动（`git status` 仅显示本报告 `docs/reports/**` 与新增测试脚本）。

## 9. 结论与放行建议

- **用户原始场景闭环**：生产断网冷启动 → 解锁 → 离线进入 → 门关闭、落任务页、无 `'replace'` 异常、内容进非 loading 终态。**建议放行**。
- **AC1–AC10 全过**；SHELL-03 抽验无回归；H6 双实例在生产构建层确认根治。
- **唯一新增问题 N-04**（离线设置页未捕获异常）非阻断，建议下批修复并复测。
- 未覆盖项（CRUD 细节/拖拽/日历任务条）建议补人工冒烟或专项，不影响本次放行结论。

---

## 10. T8 追加：离线 Ctrl+R（重载）白屏归因（用户实测新发现）

- **被测 hash**：HEAD `385e1d75`（含 T7 后的 `9e6f41c7` N-04 修复、`385e1d75` G12/G14）；生产入口 `assets/index-csY7brKv.js` sha256 `0cfa6d930981620ecbfafa51606515b1f7e673e0d3e977ad3fc88f07b2c5aeba`；`stats.html` vue-router **单实例**。
- **方法**：CDP `Network.emulateNetwork({offline:true})` + `Page.reload({ignoreCache:true})`（等价 DevTools 置「离线」+ Ctrl+R），三态分别抓 `#app` 长度/可交互元素数/`location.href`/hash/`window.__NAO_ERROR_LOG__`/Console。

| 情形                                                 | 在线 Ctrl+R                     | **离线 Ctrl+R**                                                                                                                                                       | 判定                                     |
| :--------------------------------------------------- | :------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------- |
| **① 生产构建 file://**（默认在线 API，真实注册账号） | ✅ 正常（appLen 12712，进入壳） | ✅ **不白屏**：`file://…/index.html#/auth/checkin`，`#app` len **1852**、可交互 **3**、`.nue-container--unlock-gate` 在；错误缓冲 **0 条**                            | ✅ SHELL-05 **闭环**，非回归             |
| **② dev（Vite 5173）**                               | ✅ 正常（appLen 2401）          | ❌ 白屏：`location.href = chrome-error://chromewebdata/`，`hasApp=false`、可交互 0；主进程日志 `Failed to load URL http://localhost:5173/… ERR_INTERNET_DISCONNECTED` | dev 特性：整页需从 Vite 重拉，断网必失败 |
| **③ Web（Vite 5174，无 SW）**                        | ✅ 正常（appLen 1875）          | ❌ 白屏：`chrome-error://chromewebdata/`                                                                                                                              | web 统一架构前提（无 SW ⇒ 离线刷新白屏） |

### 10.1 生产端到端整链（①情形，默认在线 API 产物的真实路径）

1. 在线注册并登录（真实后端 `https://todobe.nathanao.space`，账号见 §10.3）→ 壳 `#/tasks/all/table`（appLen 12712）。
2. **DevTools 离线 + Ctrl+R** → 回落到**解锁门** `#/auth/checkin`（`#app` len 1852、可交互 3、未白屏、错误缓冲空）。
3. 输入本地密码解锁 → 初始同步门失败态（`离线进入` 可见，appLen 5658）→ 点「离线进入」→ `#/tasks/all/table`（rail=true，router `tasks-built-in-project-main`，appLen 12635）。

> `离线进入` flag 为**内存态**，重载后需重新解锁属**预期**（已实测符合）。

### 10.2 关键判定

- **生产 file:// 离线重载不白屏 ⇒ 不是 SHELL-05（T1–T6）回归，不阻塞终签。**
- 白屏仅出现在 **dev / web**：整页 HTML/JS 需从服务器重新拉取，`Network offline` 下必然失败；与桌面本地加密数据、门/壳逻辑无关。
- 判别口诀：`location.href` 变为 `chrome-error://chromewebdata/` ⇒ **整页未加载**（资源不可达）；若 `#app` 存在但极小/空白 ⇒ 才是应用渲染问题（需按缺陷查）。

### 10.3 现场与证据

- 证据：`docs/reports/evidence/shell-05/t8/`（`t8-online-file.json` / `t8-reload-file.json` / `t8-reload-dev.json` / `t8-reload-web.json` / `dev-offline-reload.log.txt`）。
- 线上测试账号（**用户授权注册的测试数据，待清理**）：`qa.t8.reload.1789308707@example.com` / 昵称 `QA-T8`。
- 新增脚手架：`scripts/electron-smoke/shell-05-t8-reload.mjs`、`shell-05-t8-online.mjs`（只读探针 + CDP 离线模拟，未改功能代码）。