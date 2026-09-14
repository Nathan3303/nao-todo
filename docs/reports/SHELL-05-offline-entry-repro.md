# SHELL-05 复现报告：桌面端「离线进入」无响应

- **日期**：2026-09-13
- **角色**：QA（测试工程师）
- **任务**：`SHELL-05-DIAG-QA`（复现 + 证据抓取，**只测不改**）
- **被测基线**：`nao-todo@581a3c67`（`v1.6.0-15-g581a3c67`，工作区无功能性改动）
- **运行环境**：Electron `43.4.1` / Chromium `150.0.7871.224`，dev 渲染进程 `http://localhost:5173`，后端 `localhost:3302`（容器 `naotodo-server`）
- **证据目录**：`docs/reports/evidence/shell-05/`（4 组原始 JSON + 1 截图）
- **结论一句话**：在**dev 渲染进程可达**的忠实建模下，**用户所述「点击完全无反应（停在门）」未能复现**——离线进入会关闭门并挂载壳；但壳内**任务主区永久卡在「加载中…」**（功能级不可用，见 N-01）。`onOffline` 无兜底（H1）经**注入式验证**确证为**真实结构性缺陷**：一旦导航 reject（懒加载 chunk 失败 / 守卫抛错），门永久卡死、hash 不变、零用户反馈——**这与其「无反应」的字面症状完全一致**。

---

> **后续（QA2，生产构建）**：本单结论已由 `docs/reports/SHELL-05-prod-offline-entry.md` 补完——**生产构建下用户报错逐字复现**，根因为**双 `vue-router` 实例**（`AppRoot.vue` 的 `useRouter()` 返回 `undefined`），非 §3 所述的 dev chunk 失败。请以该文为准。

---

## 1. 定罪 / 判定结论

| 假设                                      | 判定                                      | 依据（可复核）                                                                                                                                                                                                                           |
| :---------------------------------------- | :---------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **H1 `onOffline` 无兜底**                 | ✅ **结构性确证（注入触发）**             | 注入「点击瞬间彻底断网」→ `router.replace` reject → `[VUE_ROUTER_R0010]` + `[Vue warn] Unhandled error during execution of component event handler at <InitialSyncGate onOffline>`，门 30s 后仍在、`location.hash` 与 `#app` 内容 0 变化 |
| H2 放行四条件不成立 → 踢回登录/检入       | ❌ 排除                                   | 正常离线路径下守卫放行，落 `LAST_VISITED=/tasks/all/table`，未出现 `auth/*` 回落                                                                                                                                                         |
| H3 目标路由无匹配                         | ⚠️ **确认存在（但需 LAST_VISITED 失效）** | 注入 `LAST_VISITED=/definitely-not-a-route-xyz` → 门**关闭**（gatePassed 生效），但 `#app` 空壳（`appHtmlLen=87`）、0 可交互 → **白屏**，非「停在门」                                                                                    |
| H4 门卡 `syncing`                         | ❌ 排除                                   | 失败态三键齐备（`重试 / 离线进入 / 登出用户`），按钮可见可点                                                                                                                                                                             |
| H5 凭证误判隐藏按钮                       | ❌ 排除                                   | 离线网络失败文案 `拉取失败：网络错误`（不含 401/403/登录已过期），「离线进入」可见                                                                                                                                                       |
| **N-01 离线壳主区永久加载（新发现）**     | ✅ **确认**                               | 门关闭、壳挂载（rail 出现），但主区 3s/10s/30s 恒为 `加载中...`；代码根因见 §5.1                                                                                                                                                         |
| **N-02 注销通知组件未满挂载态（新发现）** | ✅ **确认（未捕获异常）**                 | `deletion-notifier` `onMounted` 读 `userDeletion.value.isPending`，正常用户无该对象 → `TypeError`（unhandledrejection）                                                                                                                  |

> **给 PM 的直答**：**H1 可以定罪为「结构性缺陷且是唯一能产生『完全无反应』的机制」，但不能单凭本次证据断言它就是用户那台机器上的触发点**——因为在其字面环境（后端断、dev server 在）下导航**并未 reject**。要闭环用户个案，仍需其**控制台报错**或**点击后最终画面**（停在门 → H1；空白 → H3/N-01）。

---

## 2. 场景与结果总览

|  #  | 场景（注入能力均来自 CDP，未改功能代码）                              | `LAST_VISITED`                | 点击前            | +300ms                | +3s                  | +10s       | +30s | 结论                                 |
| :-: | :-------------------------------------------------------------------- | :---------------------------- | :---------------- | :-------------------- | :------------------- | :--------- | :--- | :----------------------------------- |
| S1  | **忠实建模**：封锁 `localhost:3302`，dev server（5173）可达           | `/tasks/all/table`            | 门失败态+离线进入 | 门关、hash→任务路由   | 壳挂载、主区`加载中` | 同左       | 同左 | **门反应正常**；主区**卡死**（N-01） |
| S2  | **注入断网**：点击前 `Network.emulateNetworkConditions{offline:true}` | `/tasks/all/table`            | 同上              | **门仍在、hash 不变** | **门仍在**           | **门仍在** | —    | **H1 命中：卡门无反应**              |
| S3  | 注入失效深链                                                          | `/definitely-not-a-route-xyz` | 同上              | 门关、空白            | 空白                 | 空白       | —    | H3/B-04：**白屏**（非卡门）          |
| S4  | 注入缺 `viewType`（B-08）                                             | `/tasks/all`                  | 同上              | `正在加载用户信息...` | 壳挂载、`加载中`     | `加载中`   | —    | B-08：与 N-01 同族，主区不产出       |

原始证据：`evidence/shell-05/case-standard-offline.json`、`case-standard-offline-30s.json`、`case-full-offline-chunkfail.json`、`case-invalid-lastvisited.json`、`case-b08-no-viewtype.json`。

---

## 3. H1 原始证据链（S2）

点击「离线进入」后，`window` 级 `unhandledrejection` + `console` 原文（节选，完整见 `case-full-offline-chunkfail.json`）：

```text
[VUE_ROUTER_R0010] Uncaught error during route navigation
  ╰─ fix: Register an error handler with `router.onError()` to handle navigation errors.
TypeError: Failed to fetch dynamically imported module:
  http://localhost:5173/@fs/.../apps/web/src/views/index/index.vue
  http://localhost:5173/@fs/.../apps/web/src/views/index/tasks/entry.vue
  http://localhost:5173/@fs/.../apps/web/src/components/tasks/built-in-project/index.vue
  ...（共 5 条 chunk）
[Vue warn]: Unhandled error during execution of component event handler
  at <InitialSyncGate onSynced=fn<onSynced> onOffline=fn<onOffline>  ... >
  at <AppRoot>
```

DOM / 路由对照（S2）：

| 时间窗 | `location.hash`  | `router.currentRoute.name` | `.initial-sync-gate` | `.sync-rail-btn` | 可交互元素                  |
| :----- | :--------------- | :------------------------- | :------------------- | :--------------- | :-------------------------- |
| 点击前 | `#/auth/checkin` | `auth-checkin`             | 在                   | 无               | 3（重试/离线进入/登出用户） |
| +300ms | `#/auth/checkin` | `auth-checkin`             | **在**               | 无               | **3**                       |
| +3s    | `#/auth/checkin` | `auth-checkin`             | **在**               | 无               | **3**                       |
| +10s   | `#/auth/checkin` | `auth-checkin`             | **在**               | 无               | **3**                       |

→ **零变化 = 用户口中的「点击无反应」**。代码级根因（`apps/desktop/src/renderer/src/AppRoot.vue`）：

```ts
const onOffline = async (): Promise<void> => {
    grantOfflineEntry()
    await router.replace(localStorage.getItem(LAST_VISITED_ROUTE_KEY) || '/tasks') // ← 无 try/catch
    gatePassed.value = true // ← reject 时永不执行
}
```

**触发面（任一即命中）**：懒加载 route chunk 加载失败（离线/构建产物缺失/缓存损坏/dev server 中断）、`beforeEnter` 守卫抛错、`router.onError` 未注册。

---

## 4. H3/B-04 原始证据（S3，注入失效深链）

```text
beforeClick  hash=#/auth/checkin  initialSyncGate=true   interactive=3
+300ms       hash=#/definitely-not-a-route-xyz  gate=false  rail=false  interactive=0  appHtmlLen=87  body=''
+10s         hash=#/definitely-not-a-route-xyz  gate=false  rail=false  interactive=0  appHtmlLen=87  body=''
console: [VUE_ROUTER_R0004] No match found for location with path "/definitely-not-a-route-xyz"
```

→ 与 H1 的差别：**门已关闭（`gatePassed=true`）**，但落到未匹配路由 → **整页空白**，无异常 reject。可观测差异可用于二选一归因。

---

## 5. 新增发现（超出 H1–H5，建议登记）

### 5.1 N-01：离线进入后任务主区永久「加载中…」（**高**，疑似用户真实体感）

S1 实测 DOM（门已关闭、rail 已挂载，主区始终不产出）：

| 时间窗 | railBtn | 可交互元素 | `#app` 内文           |
| :----- | :------ | :--------- | :-------------------- |
| +300ms | 无      | 0          | `正在加载用户信息...` |
| +3s    | 有      | 2          | `Q 加载中...`         |
| +10s   | 有      | 2          | `Q 加载中...`         |
| +30s   | 有      | 2          | `Q 加载中...`         |

代码根因（`apps/web/src/components/tasks/built-in-project/built-in-project.ts`）：

```ts
const initialize = async () => {
    if (!props.projectId || !profile.value) return   // ← 离线 profile 为 undefined，提前 return
    loading.value = true
    ...
    loading.value = false   // ← 永远走不到
}
```

离线时 `IndexViewInitialize` 的 `loadUserProfile()` 失败 ⇒ `userStore.profile` 为空 ⇒ `initialize()` 提前返回且**不清 `loading`** ⇒ 主区永久 loading。
**评测缺口**：SHELL-03 BC-5 只断言 `railSlot/gear/railBtn`，未覆盖「任务主区实际产出」，故 PASS 未拦住本项。对应边界 B-08/B-12。

### 5.2 N-02：`deletion-notifier` 未捕获 `TypeError`（中）

进入壳（在线或离线）挂载 `views/index/index.vue` 时：

```text
TypeError: Cannot read properties of undefined (reading 'isPending')
  at packages/presentation-identity/src/components/deletion-notifier/index.vue:20:39
console: [Vue warn]: Unhandled error during execution of mounted hook
```

根因：`const { userDeletion } = storeToRefs(useUserStore()); ... userDeletion.value.isPending`——普通用户（无待注销记录）该对象为 `undefined`。属独立缺陷，但会污染「进入壳」阶段的控制台，干扰 SHELL-05 归因。

---

## 6. 边界清单实测（可行项）

| ID        | 边界                                       | 本次结果                                                                     | 证据/备注                                                                                  |
| :-------- | :----------------------------------------- | :--------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| B-01      | `onOffline`/`onSignOut` 无 try/catch       | ✅ **确证**（S2）                                                            | 导航 reject ⇒ 永久卡门；`onSignOut` 同构未测（同代码形状）                                 |
| B-02      | `runSync()` 顶层无 try/catch               | ⚪ **不可判定**（需注入 `syncService.start()` reject；不改功能代码无法直达） | 静态：`initial-sync-gate.vue` `runSync()` 无 try/catch，`start()` reject ⇒ `syncing` 永真  |
| B-03      | 四条件不满足时静默回落                     | ⚪ **未构造**（无法在不改代码前提下破坏 `localSession`/`isUnlocked`）        | 静态：`auth/routes.ts` 回落三分支；表现为可见检入失败态，非静默                            |
| B-04      | `LAST_VISITED_ROUTE` 失效深链              | ✅ **确证**（S3）                                                            | 白屏（`appHtmlLen=87`），非卡门                                                            |
| B-05      | section 重定向 `LAST_TASKS_ROUTE` 失效     | ⚪ 未单测                                                                    | 与 B-04 同族，建议并入                                                                     |
| B-06      | 懒加载 chunk 离线不可用                    | ✅ **确证**（S2）                                                            | dev 下 5 条 chunk import 失败；**需注记：Electron 打包/生产走本地资源，此项对 dev 更敏感** |
| B-07      | 无全局 `unhandledrejection`/`onerror` 兜底 | ✅ **确证**                                                                  | 全量异常仅进控制台，无上报（N-02 亦因此不可见）                                            |
| B-08      | 离线落 `tasks` 缺 `viewType`               | ✅ **确证**（S4）                                                            | 壳挂载但主区不产出（N-01 同族）                                                            |
| B-09…B-13 | 见勘察报告                                 | ⚪ 未在本单覆盖                                                              | —                                                                                          |

---

## 7. 未复现 / 判定限制（必须在立项前对齐）

1. **用户字面场景未复现**：在后端不可达、dev server 可达（=「断网」在开发机的真实含义）下，离线进入**有反应**。若用户设备的最终画面确实是**停在门**，则需其控制台报错来确认是否为 chunk/守卫 reject（H1）。
2. **S2 的触发条件强于「断网」**：`Network.emulateNetworkConditions{offline:true}` 会同时切断 `localhost:5173`。生产/打包 Electron 的渲染资源为本地文件，理论上不触发该 chunk 失败——**故 H1 对「打包态」的直接适用性未证**（未构建打包产物回归）。
3. **N-01 更可能对应「进不去任务」的体感**：门关掉后主区永久 loading，用户可能描述为「点了没动静/进不去」。建议向用户确认点击后是「门还在」还是「壳在但一直转圈」。
4. B-02/B-03 未取得实机判定，当前只能以静态代码事实登记。

---

## 8. 冻结文件 hash 清单（未改动，`sha256`）

被测源码（只读）：

```text
2c21620432c58afb377c2042ce954ae0ce4e987f22b3f2ba15b42807a322cb83  apps/desktop/src/renderer/src/AppRoot.vue
f6f3061870e6a870dbfc07dfb0faaa2737444d76cae1adf6cfd3fddbd474b20b  apps/desktop/src/renderer/src/components/initial-sync-gate.vue
4496d6c42ef69ad8c050f6a6c3ea93e7ad1c333a684186784107f8fef77f407f  apps/desktop/src/renderer/src/components/unlock-gate.vue
7400ebe0d984d2d5382849b100f549bc0ec9427c20415c7ad99e263e1fe1d3ca  apps/web/src/views/auth/routes.ts
b165a7b751bbcc57757499a7045d158dfd3cb05e21b93228304acfe28fd23ded  apps/web/src/views/auth/offline-entry.ts
1d462d5d4cae51165995f02fc2e7c47e9d764359940c9665c9ce72b44a7696de  apps/web/src/router.ts
73bd84c25a4765ea0a28812d378a31e42a0e7a106802643d274b06603f68e8db  apps/web/src/views/index/routes.ts
f199bcd6681eed0d9193e4a7517088dea5db0b083fd67ec64de89389d5382a4d  apps/web/src/views/index/tasks/routes.ts
ac62b5914753e91c8ce0abc16faaf26c53cccf3a59d1e72229ead7301629d85d  apps/web/src/views/index/index.vue
0461ed7430ec0d1afa362d8ca8c0c3c79ebb8437e859721f397bef4227b2f0a1  packages/presentation-identity/src/components/deletion-notifier/index.vue
```

脚手架（**新增 1 个，未改既有**）：

```text
b22aa3bf68735f0093d341eecf9dbd2b04f992a2447923d694163b868e5fded2  scripts/electron-smoke/shell-05-offline-repro.mjs   ← 新增
bd05be2c87150cdfbb752e2fa9980ebcb9229a1b82576335bc63d59755b72768  scripts/electron-smoke/run.mjs                      ← 未改
ef728c6a1a8a032bcf3733dd79a4fe91d8825e05c30aaba285d5594b963f2269  scripts/electron-smoke/lib/cdp.mjs                  ← 未改
9f6dfcdcbc4e9d99595f6000c05a88f97052d385d585c9b97a9cb81e344d3e21  scripts/electron-smoke/lib/app.mjs                  ← 未改
```

`git status` 确认：仅新增 `docs/reports/**` 与 `scripts/electron-smoke/shell-05-offline-repro.mjs`，**无任何被测功能代码改动**。

---

## 9. 脚手架改动披露（测试专用）

- **新增** `scripts/electron-smoke/shell-05-offline-repro.mjs`（单文件，零第三方依赖，复用 `lib/cdp.mjs`）：
    - 仅在渲染进程注入**只读**探针：包装 `console.*`、监听 `unhandledrejection` / `window.onerror`（不访问、不修改业务状态）。
    - 流程：在线引导建本地密钥包 → 封锁 `localhost:3302` → reload 冷启动 → 解锁 → 等失败门 → 真实鼠标点击「离线进入」→ 抓取 +300ms/+3s/+10s/+30s 快照、`location.hash`、`router.currentRoute`（经 `#app.__vue_app__`）、网络请求、chunk 失败与异常。
    - 可选注入项：`--last-visited`、`--last-tasks`、`--emulate-offline-at-click`（仅供边界/机理复现）。
- **未改动** `run.mjs` / `lib/*` / 任何 `checks/*`（hash 见 §8）。**影响面**：新增文件不参与既有 `--feature` 注册，`run.mjs` 行为不变。

---

## 10. 遗留风险 / 数据现场

- **测试账号（测试数据，需登记清理）**：`qa.shell05.1789301180@qa.local` / 昵称 `QA-Shell05`（`2026-09-13` 注册，本地 dev 库）。后端无 DELETE 用户端点，与既有 `probe@x.local` 同处理方式。
- **隔离运行**：本次以 `XDG_CONFIG_HOME=/tmp/nao-shell05-config` 隔离 Electron `userData`，**未写入用户 `~/.config/@nao-todo/desktopapp` 的业务数据**（实测用户 profile 未签入 QA 账号；仅 Chromium 自身 `Preferences` 时间戳变化）。
- **未覆盖**：打包/生产构建（`file://` 懒加载）回归、`mobile`（Lynx）、离线写入口径——均按 SHELL-05 勘察报告「不在本单」。

---

## 11. 建议（供 PM 立项参考）

1. **P0**：门/壳所有导航与同步调用加**必达兜底**（`try/finally` + 失败可见 + 永不卡死），统一 `router.replace` 失败处理，注册 `router.onError`；补全局 `unhandledrejection`/`onerror` 日志。
2. **P0**：`LAST_VISITED` 失效兜底到 `/tasks`（默认 `viewType=table`）。
3. **P0（N-01）**：`built-in-project.initialize()` 的提前 `return` 必须清 `loading`（或提供离线空态/引导），否则「离线进入」即便门通过也**进不去任务**。
4. **P1（N-02）**：`deletion-notifier` 判空（`userDeletion.value?.isPending`）。
5. **测试口径**：`initial-sync-gate` 契约应显式要求「导航 reject 时仍须离开门/给出可见失败」，并新增「点击后主区实际产出」断言，堵住 SHELL-03 BC-5 的覆盖缺口。