# DEF-35 证伪探针报告 —— web origin 是否存在历史密文残留（T158）

- **关联**：`DEF-35`（`docs/reports/defect-pool.md`）· ADR `2026-09-23-web-offline-local-first-and-security-posture.md` **C-68 / §10.12-三** · `docs/tasks-state.md` `T158`
- **性质**：**探针单**（只读为主）· ⛔ 未改任何源码 / 测试 / 构建配置
- **日期**：2026-09-24
- **结论**：**证伪 ⇒ DEF-35 维持 P2（防御性条款，不阻塞发布）**；回 P0 的触发条件未出现

---

## 一、结论（P2 / P0）与依据

**证伪。** 三条独立证据链一致指向「web origin 不存在历史密文残留」：

1. **静态（写路径）**：web 端**不存在**任何写密文路径 —— 无 `decorateAuthUseCase`/`decorateUserUseCase`（⇒ 无 `setup`/`unlock`/`key-bundle` 写入）、对 `cryptoService` 仅调用 `lock()`、且 web **首个本地写入点已在 `plain:` 直通（T104）之后**（§三 A–F）。
2. **实测（存储态）**：三处可触达 web origin 的 IndexedDB 结构化枚举 ⇒ **非 `plain:` 的密文形态值 = 0**、**`${userId}:key-bundle` = 0**（§二 / §四）。
3. **迁移路径**：`runPlaintextMigration` 调用点仅在 `apps/desktop/**`，web 零调用（§三 E）。

⇒ DEF-35 对**纯 web origin** 与**浏览器中的 web origin** 均无实际触发面 ⇒ **维持 P2（防御性）**。
**回 P0 的判据（本探针未出现）**：任一可触达 web origin 的业务表出现非 `plain:` 的密文形态值。

---

## 二、探针环境与 origin 清单

### 2.1 环境

| 项                                 | 状态                                                                                                                                                                                                                             |
| :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 后端 `http://localhost:3302`       | 在跑（**只读，未写入**）                                                                                                                                                                                                         |
| MySQL `:3306` / Redis `:6379`      | 在跑（**未写入**）                                                                                                                                                                                                               |
| web dev server（`localhost:5173`） | **未拉起**（PM 说明已关）。为读取 **origin 作用域**的 IndexedDB，探针以**同 origin 的静态页**（node `http`，仅返回一行 HTML）承载读取脚本 —— IndexedDB 按 `scheme://host:port` 隔离，与页面内容无关（不改 dev server、不改源码） |
| 浏览器                             | snap Chromium `153.0.8010.36`，`--headless=new`，`--remote-debugging-port=9223`，**副本 profile**（原 profile 只读未动，见 §六）                                                                                                 |
| 生产 origin                        | `https://todo.nathanao.space` 直连**不可达**（DNS/443；`curl` 12s 超时）⇒ 以 `--host-resolver-rules="MAP todo.nathanao.space 127.0.0.1:8443"` + **本地自签 TLS** 在**同一 origin 字符串**下读取（**未访问真实线上站点**）        |
| 凭据                               | **未使用任何账号**（只读 IndexedDB 无需登录）⇒ 未涉及 `NAO_QA_*`                                                                                                                                                                 |

### 2.2 逐 origin 结果

| #   | origin                        | 形态                                                      | 业务库 `nao-todo-desktop`  | 业务表非 `plain:` 密文形态值 | `${userId}:key-bundle` | `${userId}:plaintext-migrated` | 证据类型             |
| :-- | :---------------------------- | :-------------------------------------------------------- | :------------------------- | :--------------------------: | :--------------------: | :----------------------------: | :------------------- |
| 1   | `http://localhost:5173`       | dev（web；且与 electron-vite 渲染层**同 origin 字符串**） | 存在（Dexie v4 / IDB v40） |            **0**             |         **无**         |             **无**             | **实测**             |
| 2   | `http://localhost:5174`       | 其他 dev 端口                                             | **不存在**                 |             N/A              |           无           |               无               | **实测**             |
| 3   | `https://todo.nathanao.space` | 生产 web                                                  | **不存在**                 |             N/A              |           无           |               无               | **实测**（remap 后） |

**`localhost:5173` 明细**（现场唯一含业务库的 origin）：

| store                                                                                     | count |                                          `plain:` 敏感字段数 | 密文形态值 |
| :---------------------------------------------------------------------------------------- | ----: | -----------------------------------------------------------: | ---------: |
| tasks                                                                                     |    82 |                                                          164 |          0 |
| taskCheckItems                                                                            |   306 |                                                          306 |          0 |
| taskComments                                                                              |    30 |                                                           90 |          0 |
| tags                                                                                      |    13 |                                                           26 |          0 |
| projects                                                                                  |     6 |                                                           12 |          0 |
| pomodoros                                                                                 |     1 |                                                            2 |          0 |
| pomodoroRecords                                                                           |    40 |                                                          120 |          0 |
| meta                                                                                      |     1 | —（`422644611870101504:mirror-status`，含 `mirrorPulledAt`） |          0 |
| deletionSchedules / syncQueue / users / userConfigs / projectPreferences / tagPreferences |     0 |                                                            0 |          0 |

- 其余非 `plain:` 字符串**均为结构性字段**（`id`/`userId`/时间戳/`state`/`projectId`/`tags` 等），**非密文形态**（`cipherSuspects = 0`）。
- **`meta` 无 `key-bundle`、无 `plaintext-migrated`**；仅一条 `${userId}:mirror-status`（web 镜像元数据）。
- **origin 2 / 3**：仅有 `nao-todo-operation-log@10`（`operationLogs` **count=0**）—— 该库是 `packages/shared/requester/operation-log.ts` 的**幂等请求日志**，**非业务库、不含敏感字段**。

---

## 三、静态证据（读码 + git 史；与实测分列）

| 代号  | 事实                                                                                                                                                                                      | 证据                                                                                                                                                                                                                                                                        |
| :---- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** | web binding **不提供** `decorateAuthUseCase` / `decorateUserUseCase`（唯一能触发 `setup`/`unlock`/`key-bundle` 写入的钩子）                                                               | `apps/web/src/hooks/usecases/binding.ts` 的 `useCaseBinding` 对象字面量仅含 `create*` + `decorateUseCase`；`use-auth-usecase.ts:18` / `use-user-usecase.ts:39` 经 `?.` 可选链调用 ⇒ web 侧恒 `undefined`                                                                    |
| **B** | web 对 `cryptoService` 的调用**仅 `lock()`**（回收内存中的 DEK）                                                                                                                          | `apps/web/src/components/settings/profile-updater/index.vue:63`、`apps/web/src/views/auth/sign-out-broadcast.ts:94`；`.setup(` / `.unlock(` 的非测试调用点全仓仅 desktop `unlock-gate.vue:132` 与 `crypto-service.ts` 内部                                                  |
| **C** | `cryptoService.encrypt` 自 **`9ee0c08b`（T104，2026-09-23 14:37）** 起为 `plain:` 直通                                                                                                    | `crypto-service.ts`：`encrypt(plain) → \`${PLAIN_PREFIX}${plain}\``                                                                                                                                                                                                         |
| **D** | **git 时序（决定性）**：web 首次接入本地仓储 = T107 `33901b90`；其更早的 web binding（`dbf96535` / T110，web 首现）仓储**全部为远端 `TaskRepoImpl(getRequesterImpl())`**，不碰本地库/加密 | `git merge-base --is-ancestor 9ee0c08b 33901b90` ⇒ **YES（T104 先于 T107）**；`git show dbf96535:apps/web/src/hooks/usecases/binding.ts`                                                                                                                                    |
| **E** | `runPlaintextMigration` 调用点**仅在 desktop**                                                                                                                                            | `apps/desktop/src/renderer/src/hooks/usecases/binding.ts:73`、`unlock-gate.vue:154`；web 零调用（全仓 grep）                                                                                                                                                                |
| **F** | 机制对照（**证实分支**的行为；供验收口径）                                                                                                                                                | `crypto-service.test.ts:47,79` 断言「未解锁时历史密文抛 `本地密钥未解锁`」；读路径 `taskRecordToEntity` → `cryptoService.decrypt`；仓储 `get`/`list` `catch` 后 `return [null, String(err)]`（GoError）⇒ 表现为**行不可见**而非抛到 UI（`task-repo-impl.ts:83-90,340-352`） |
| **G** | **存储分区**：同 origin 字符串 ≠ 同存储                                                                                                                                                   | Electron desktop 的 IndexedDB 在 `~/.config/@nao-todo/desktopapp/IndexedDB/`，浏览器 web 的在 snap chromium profile；**两者是不同 storage partition，互不可见**。实测两侧 `localhost:5173` 业务表**均为 `plain:`、均无 `key-bundle`**                                       |

> **D 的意义**：web 的**第一个**本地写入点（T107）已在明文直通（T104）之后 ⇒ **web 历史上不存在「写密文」窗口**。这是「web origin 不可能残留密文」的**充分静态依据**，独立于任何单机采样。

---

## 四、实测证据（结构化，**非 UI**）

**判据声明（满足硬要求）**：本探针的「密文残留」判定 = **直接读取 IndexedDB 记录的底层真源值**（`plain:` 前缀 vs 密文形态正则 `^[A-Za-z0-9+/]{16}=?:[A-Za-z0-9+/]{16,}=?$`），并枚举 `meta` 主键集合以查 `key-bundle`/`plaintext-migrated`。此判据落在 **repo 底层数据层**，**不依赖 UI 目视**。

- 方法：`indexedDB.databases()` 枚举库 → 逐 `objectStore` `getAll()` → 逐字符串字段分类（`plain:` / 密文形态 / 结构性明文）。
- 结果：三 origin **密文形态值合计 = 0**，**`key-bundle` 命中 = 0**（见 §二表）。
- 交叉核验（只读 `strings`/`grep` 扫 leveldb）：DB 名分别为 —— `localhost:5173` = `nao-todo-desktop` + `nao-todo-operation-log`；`localhost:5174` / `todo.nathanao.space` = 仅 `nao-todo-operation-log`。

**未实机声明（如实）**：本单**未**使用真实 dev server（以同 origin 静态页代替）、**未**登录真实账号、**未**走 UI 渲染链路 ⇒ 「该行可渲染」**未**在真实应用内断言，改以**数据层断言**替代（更强、无 UI 干扰）。如需 UI 级复验，见 §五验收口径。

---

## 五、DEF-35 验收口径建议（供 `FIX-D` 实现单）

`C-68` 一次性自愈的验收**必须**满足下列各条（否则会重蹈「静默不可见」）：

1. **检测点**：`startWebDataPlane()`（`apps/web/src/data-plane.ts`）内、`syncService.start()` **之前**；检测当前 `userId` 的业务表是否存在非 `plain:` 值，或存在 `${userId}:key-bundle` 且无 `${userId}:plaintext-migrated`。
2. **判据（硬）**：**必须断言 repo 层返回的错误或该行可渲染**，不得只做 UI 目视。建议断言形式：
    - **修复前**：造旧数据态（fixture：`seedLegacyCipher`）后，`localTaskRepo.get(id)` 返回 `[null, /本地密钥未解锁/]`；或
    - **修复后**：自愈后 `get(id)` 返回 `[entity, null]` 且 `entity.name` 为明文。
3. **护栏**：`syncTracker.countDirty(userId) > 0` ⇒ 阻塞确认 / 先同步（**C-54 同口径**），**禁静默丢未回传写入**。
4. **禁项**：**不得删** `${userId}:key-bundle`（**C-51**）；**不得**把不可读密文当空值/默认值渲染。
5. **回归矩阵**：按 ADR §10.12-三 表 1–5 覆盖 —— ① 纯 web（**零行为变化**）· ② 有密文 + `countDirty = 0`（丢弃本地副本 → 全量重拉 → 可见告知）· ③ 有密文 + `countDirty > 0`（阻塞确认/先同步）· ④ 存在 `key-bundle`（**不删**）· ⑤ `plain:` 记录（前缀判据**不误判**）。
6. **造数/回滚（若实现单引入 fixture 造数）**：回滚清单须覆盖 `BUSINESS_TABLES` **11 张**（`projects`/`projectPreferences`/`tags`/`tagPreferences`/`tasks`/`taskCheckItems`/`taskComments`/`pomodoros`/`pomodoroRecords`/`users`/`userConfigs`）+ `meta`/`deletionSchedules`/`syncQueue`/`syncCursor`；收尾跑**孤儿扫描** `SELECT COUNT(*) FROM <t> WHERE user_id NOT IN (SELECT id FROM users)` **逐表报数**；**不得触碰既有账号**。

---

## 六、只读 / 副作用与回滚

- ⛔ **未改**源码 / 测试 / 构建配置（本单落盘仅新增本报告）。
- **未写** MySQL / Redis / 后端 / 业务表；**未造数** ⇒ 无需孤儿扫描。
- **未使用**真实 dev server：以**同 origin 静态页**读取。
- 浏览器读取全部在**副本 profile** 上进行；真实 `~/snap/chromium/common/chromium/Default/IndexedDB/` 与 `~/.config/@nao-todo/desktopapp/IndexedDB/` 的 mtime **未变**（仍为探针前：Sep 24 14:08 / Sep 23 20:47 等）。
- **回滚已完成**：副本 profile（`nao-t158-profile`、`nao-t158-electron`）已删除；Chromium / 静态服务 / 自签 TLS 服务均已关闭；探针端口 `5173`/`5174`/`8443`/`9223` 已释放；核心 `3302`/`3306`/`6379` 未动。
- 探针脚本留存 `/tmp/t158-*.mjs`（**不在仓库、不提交**）。

---

## 七、门禁与产物

| 项                                                                                                       | 结果                                                                                                                          |
| :------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec vp check docs/qa/2026-09-24-def35-falsification-probe.md`                                     | **rc=0**（0 error）                                                                                                           |
| `pnpm exec vp test --run packages/infrastructure/src/persistence-local/__tests__/crypto-service.test.ts` | **1 文件 / 12 例 / 0 红**，exit 0（探针单不要求全仓门禁）                                                                     |
| 产物                                                                                                     | 本文件 `docs/qa/2026-09-24-def35-falsification-probe.md`                                                                      |
| 分支 / commit                                                                                            | `nao/t158-def35-probe`（从 `main` `cf89070e` 起）；commit hash 见回执（**PM 已告知 `gh` 不可用 ⇒ 不创建 PR**，push 尽力而为） |

---

## 八、未过项 / 风险 / 阻塞

| #   | 项                 | 说明                                                                                                                                                                                                                                                                                         |
| :-- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 生产 origin 非直连 | `https://todo.nathanao.space` DNS/443 不可达；以 **host-remap + 自签 TLS** 在**同一 origin 字符串**下读取（**未访问真实线上站点**）。若线上 origin 的实际客户端存储与本地 profile 不同（其他浏览器/设备），本探针**不覆盖**该样本 —— 但 §三 A–E 已使「web 写密文」**不可能**，故不影响证伪。 |
| 2   | 单一浏览器 profile | 仅有本机 snap chromium（+Electron）profile 可查；结论的**通用性依赖静态证据（§三 A–F）**。                                                                                                                                                                                                   |
| 3   | 未做 UI 级复验     | 未登录真实账号、未走渲染链路；判据落在数据层（更强），UI 级复验列入 §五 验收口径交 `FIX-D`。                                                                                                                                                                                                 |
| 4   | 阻塞               | 无。`gh` 不可用 ⇒ **Draft PR 未创建**（PM 后补）；本地提交已完成。                                                                                                                                                                                                                           |

---

### 附：探针核心逻辑（可复现，只读）

```js
// 在目标 origin 的页面上下文执行（同 origin 静态页承载；IndexedDB 按 origin 隔离）
const CIPHER = /^[A-Za-z0-9+/]{16}=?:[A-Za-z0-9+/]{16,}=?$/
const dbNames = (await indexedDB.databases()).map((d) => d.name + '@' + d.version)
const db = await new Promise((res, rej) => {
    const r = indexedDB.open('nao-todo-desktop')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
})
for (const st of [...db.objectStoreNames]) {
    const recs = await new Promise((res, rej) => {
        const t = db.transaction(st, 'readonly')
        const q = t.objectStore(st).getAll()
        q.onsuccess = () => res(q.result)
        q.onerror = () => rej(q.error)
    })
    // 分类：v.startsWith('plain:') → 明文；CIPHER.test(v) → 密文形态；否则结构性明文
    // meta store 另收 id 集合，查 `<userId>:key-bundle` / `<userId>:plaintext-migrated`
}
```

- `localhost:5173` 由 node 静态服务承载（`createServer` 返回一行 HTML）；生产 origin 由 `--host-resolver-rules="MAP todo.nathanao.space 127.0.0.1:8443"` + 自签 TLS 承载。