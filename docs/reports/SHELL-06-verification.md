# SHELL-06 验收报告：离线写入与自动回传（T1 `8cb1effa` + T2 `9b24ce3b`）

- **日期**：2026-09-13
- **角色**：QA（测试工程师）
- **任务**：`SHELL-06 T3`（BC-13…BC-16 生产构建实机回归，**只测不改**）
- **被测基线**：HEAD `9b24ce3b`（T1 `8cb1effa` 回传触发与失败三分类；T2 `9b24ce3b` 队列上限可见性与触顶恢复）
- **运行方式**：生产构建 `pnpm desktop:build`（`VITE_API_BASE_URL=http://localhost:3302/api`，本机后端），`file://` 加载 `apps/desktop/out/renderer/index.html`；Electron `43.4.1` / Chromium `150`；CDP 真实鼠标/键盘 + `Network.setBlockedURLs` 模拟离线。
- **产物 hash**：入口 `assets/index-Bg5JbytE.js` sha256 `85ebb841437946778e3f3f77fb0d2691e9ba6997e849841b31111aa5e93bce48`；`stats.html` vue-router 单实例。
- **证据目录**：`docs/reports/evidence/shell-06/`
- **一句话结论**：**离线本地写「不丢、不阻塞、不消耗额度」已达成（BC-14/15/16 通过，BC-13 在线触发路径通过）**；但 **BC-13 的「条件退避定时」自愈路径存在 P0 缺陷**——网络类暂停到期后不再安排任何重试，仅 `online`/可见性/手动/重启能唤醒（详见 §3）。

---

## 1. 结论表

| BC / 项 | 结论 | 证据 |
| :--- | :--- | :--- |
| **BC-13 离线回传自动恢复（`online` 触发路径）** | ✅ **PASS** | 断网写 2 项 → 派发 `online` → **1.5s 内 `syncQueue` 2→0**；服务端出现对应任务；删除项已上报、未复活 |
| **BC-13（退避定时触发路径 / 真·不手动）** | ❌ **FAIL（P0 缺陷）** | 恢复网络但**不派发 `online`**、前台持续 40s 轮询 → 队列恒为 2、无补传；静态 `scheduleBackfillTick()` 在 `pausedUntil>now` 时 `return`，5s 暂停到期后无定时器（见 §3） |
| **BC-14 离线暂停不消耗额度** | ✅ **PASS** | 离线持续写 + 跨 12s（含退避）后队列项 `attempts` 仍为 `undefined/0`、`retryCount=0`；恢复后立即出队 |
| **BC-15 触顶/暂停可恢复（业务类）** | ✅ **PASS** | mock `/sync/push` 业务错误（code=10002）→ 队列项 `attempts=1`、`lastErrorClass=business`、`nextAttemptAt` 设置；清 mock + `online` → 出队并回传（服务端出现），**含删除项**同队列策略（BC-13 删除项路径已验证；业务类删除项未单独构造） |
| **BC-16 本地写不阻塞/不丢** | ✅ **PASS（核心）** | 注入 2001 条队列项（单表 >1000 / 总 >2000）→ 触发一轮同步后轨道 class=`is-pending`、出现「待同步/联网后自动同步」文案；**本地新建任务照常成功**；2001 条恢复回传未实机验证（部分） |
| **G11 无请求风暴** | ✅ **PASS** | 离线期 2 次本地写仅 **1 次** `/api/sync/push` 尝试（非每次写触发）；退避封顶 120s（静态） |
| **UI 暂停态文案** | ✅ **PASS（部分）** | 轨道 `is-pending` + 页面出现「待同步（离线，联网后自动同步）」类文案；「立即重试」按钮未直接命中（面板选择器未定位） |
| **G13 会话管理离线占位** | ⬜ **未覆盖** | 离线未观察到 toast 噪声（`toasts=[]`）；「需联网查看」占位文案未成功复现（设置面板未稳定打开） |
| **回归：在线正常路径** | ✅ **PASS** | 在线登录/进入任务/创建/同步正常 |
| **回归：凭证明文失效** | ✅ **PASS** | mock `/sync/pull`=10041 → 落 `#/auth/signin`「登录已过期，请重新登录 / 重新登录」，**不展示「离线进入」** |

---

## 2. BC-13 在线触发路径原始证据

```
断网(blockUrls localhost:3302) → UI 新建 T1/T2/T3 + 删除 T3
  syncQueue = 3（tasks:upsert ×2, tasks:delete ×1）   attempts 全 null   retryCount 全 0
派发 window Event('online')
  +1.5s  syncQueue = 0
服务端 /api/tasks/：T1、T2 存在；T3 **不存在**（删除未复活）
```

（`shell-06-verify.json` / `s06-final-probes.json`；服务端以 `GET /api/tasks/` + MySQL `tasks` 表双向核对。注：主脚本初版对服务端响应体解析有误（该接口为 `{code,data:[...]}`），故主脚本内的 `serverNames=[]` 为**测试脚本误报**，已用直连核对纠正。）

## 3. BC-13 退避定时路径缺陷（P0）

**现象**（`backfill-timer-observation.txt`）：断网写 2 项 → 恢复网络（**不派发 `online`**）→ 前台每 2s 轮询 40s → `syncQueue` 恒为 2、无补传；整段仅 1 次 `/sync/push`。派发 `online` 后 1.5s 内清空。

**静态根因**（`packages/infrastructure/src/persistence-sync/sync-service.ts`）：

```ts
private scheduleBackfillTick(): void {
    this.clearBackfillTick()
    const userId = this.currentUserId()
    if (!userId || this.pausedUntil > Date.now()) return   // ← 暂停期内直接 return，未安排任何定时器
    void syncTracker.countDue(userId).then((due) => { /* 只有 due>0 才 setTimeout */ })
}
private pauseForNetworkFailure(): void {
    this.pausedUntil = Date.now() + backoffDelayMs(1)      // 5s
    syncStatus.setPaused('offline')
}
```

⇒ 网络类失败设置 5s 暂停后，`pushAll` 的 `finally → scheduleBackfillTick()` 因 `pausedUntil > now` 直接返回，**没有安排「暂停到期后重试」的定时器**；5s 到期后无任何唤醒源。

**影响**：
- 用户「断网 → 联网」主场景因浏览器 `online` 事件仍可自愈（PASS）。
- 但「网卡在线、后端 5xx/超时/不可达」这类**不触发 `online`** 的网络类失败，队列将一直停留，直到用户手动同步/切前台/重启 —— **与 R1/C-40「条件指数退避定时（5s→…→120s，成功即停）」不符**，且违反「自愈」目标。

**建议**：`scheduleBackfillTick()` 在暂停期内应改为 `setTimeout(..., pausedUntil - now)`（到期再 tick），或在 `pauseForNetworkFailure()` 内直接安排一次到期唤醒；并加单测断言「无 `online` 事件、仅超时后也能补传」。

---

## 4. BC-14 / BC-15 / BC-16 原始证据（节选）

- **BC-14**：离线写 2 项后等待 12s（跨退避窗口）：`items = [{action:'upsert'},{action:'upsert'}]`，无 `attempts` 字段（=0）、`retryCount=0`；恢复触发后 `count=0`。
- **BC-15**：mock push 业务失败 → `{action:'upsert', attempts:1, next:'2026-09-13T14:45:01Z', cls:'business'}`；清 mock + `online` → `count=0`，服务端出现 `S06-BIZDEL-*`。
- **BC-16**：注入 2001 条 `syncQueue`（`userId` 对齐，`nextAttemptAt` 置 1h 后）→ 触发一轮同步后 `sync-rail-btn` class = `... is-pending`，页面出现待同步文案；同一时刻新建任务成功（`taskAppeared=true` / `crudWorks=true`）；探针数据已清理（deleted=2001）。

## 5. 未覆盖 / 残留风险

1. **BC-13 定时自愈缺陷（P0，见 §3）** —— 是本轮唯一功能性缺口，建议修复后再终签。
2. **业务类「删除项」**：BC-15 仅实测 upsert；删除项业务退避→恢复未单独构造（BC-13 已证删除项可正常回传，`resetFailed` 对 upsert/delete 同策略）。
3. **BC-16 超大队列恢复回传**：仅验证「不阻塞 + 可见性」，2001 项实际补传未实机压测（依赖单测 + BC-13 机制）。
4. **「立即重试」按钮 / G13 占位**：面板与设置页自动化选择器未稳定命中（未覆盖，非缺陷证据）。
5. **测试脚本初版误报**：服务端响应解析错误已纠正；建议后续脚手架统一封装 `GET /api/tasks/` 解析。
6. 无 `vp test` / `guard:ddd` 复跑（属开发门禁，本单只做实机回归）。
7. 测试数据：复用 `qa.shell06.1789310105@qa.local`（本地 dev 库），写入若干 `S06-*` 任务；隔离 profile（`XDG_CONFIG_HOME`），未污染用户数据。

## 6. 脚手架改动披露（测试专用）

- 新增 `scripts/electron-smoke/shell-06-verify.mjs`（BC-13…BC-16 主流程；含已知的服务端解析初版缺陷，已由直连核对纠正）。
- 其余为临时只读探针（`/tmp`，未入库）。**未改 `run.mjs` / `lib/*` / 任何功能代码。**

## 7. 放行建议

- **主路径可用**：离线本地写不丢、不阻塞、不消耗额度；`online` 恢复自动补传（含删除不复活）✅。
- **建议阻塞终签**：`scheduleBackfillTick()` 暂停期不自愈（C-40/R1）为 P0；修复并复验「无 `online` 事件亦能退避自愈」后再放行。

---

# SHELL-06 T3 复跑（DEF-01 修复后，2026-09-13）

- **被测 HEAD**：`95a9744b`（含 T1 `8cb1effa` + T2 `9b24ce3b` + DEF 修复 `95a9744b`）
- **产物**：入口 `assets/index-uL53YWY_.js` sha256 `b874b1f8d571b80544b7befa0da82a49765d47fd67d9609a57eef21a2c57b7a7`；vue-router 单实例
- **证据**：`docs/reports/evidence/shell-06/shell-06-rerun.json`、`s06r-panel-retry.json`、`shell05-spot-repro.json`
- **复跑脚本**：`scripts/electron-smoke/shell-06-rerun.mjs`

## 8.1 修复确认（静态）

`computeBackfillDelayMs({nowMs, pausedUntilMs, dueCount, earliestNextAttemptAtMs, level})`：
暂停期 ⇒ `clamp(pausedUntil - now)`（不再 `return`）；有到期项 ⇒ 指数间隔；仅有未到期项 ⇒ 按最早 `nextAttemptAt` 唤醒；无项 ⇒ `null`（不建定时器）。`scheduleBackfillTick()` 改为先 `countDirty`，`pausedUntil<=now && due>0` 才递增 `backfillLevel`，单定时器「调用即清旧」。**§3 缺陷已消除**。

## 8.2 复跑结论表

| 项 | 结论 | 实测证据 |
| :--- | :--- | :--- |
| **BC-13 退避定时路径（原 FAIL）** | ✅ **PASS** | 断网写 2 项 → 解除封锁**不派发 `online`** → **1511ms 内 `syncQueue` 2→0**（≤ 暂停窗口 5s + 一个退避周期，远优于上界） |
| BC-13 反向：成功清空后定时器停止 | ✅ PASS | 清空后观察 15s，`Δ/sync/push = 0`（无残留 tick） |
| G11 不回退（无请求风暴） | ✅ PASS | 一次写 → 全程仅 2 次 push（首失败 + 暂停到期自动重试），非每次写触发 |
| 提前唤醒（`online`/前台/手动） | ✅ PASS | 派发 `online` → **505ms** 清空；`Δpush=1`（无重复风暴） |
| **BC-15 业务类「删除项」恢复** | ✅ PASS | mock 业务失败 → 删除项 `attempts=1 / lastErrorClass=business / nextAttemptAt` → 清 mock+`online` → **503ms 出队**；服务端**无该任务**（不复活） |
| **「立即重试」按钮** | ✅ PASS | 面板真实渲染「有 1 项修改待同步（离线，联网后自动同步）／推送失败：网络错误／立即重试」；点击后 **511ms 清空** |
| **G13 会话管理离线** | ✅ PASS（分支） | 离线打开「账户与个人信息」→ 显示本地**缓存会话列表**（命中缓存分支，非错误分支）；**`toasts=[]`**（无 toast 噪声），无未捕获异常 |
| 回归：BC-14/15/16 抽验 | ✅ PASS | 复跑段落覆盖：BC-14（暂停不消费额度）、BC-15（业务类/删除项）、G11/上限可见性（前轮 BC-16 证据，代码未回退） |
| 回归：SHELL-05 AC1/AC2 抽验 | ✅ PASS | 生产离线冷启动 → 解锁 → 离线进入 → 门关闭、rail 挂载；**无 `'replace'` 异常**、无 rejection |

## 8.3 解除阻塞结论

- 上轮 §3 的 P0 缺陷（退避定时不自愈）**已修复并经实机复验**：无 `online` 事件时也能在暂停到期后自动补传；成功即停、提前唤醒正常。
- **解除对终签的阻塞**。残留仅为上轮已登记的未覆盖项（BC-16 超大队列实际回传压测、G13「需联网查看」空缓存分支），均非功能阻断。

> 更正：复跑初版脚本第 2 段将「暂停到期自动重试」计为额外 push 而误判 G11；按 C-40 该次为重试而非风暴，已修正判定口径。
