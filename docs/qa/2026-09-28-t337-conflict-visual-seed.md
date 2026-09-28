# T337 · 冲突界面视觉走查：环境 + 可复现数据

> 交付对象：**用户本人**（真机视觉走查唯一负责人）· 舰队只负责可自动化逻辑面
> 版本基线：`main` @ `cd131666`（v1.12.2，含 T331 计数递减 + T332 冲突 diff 新 UI）
> 造数方式：**浏览器控制台片段（零改仓、不碰 `packages/presentation-react` / `apps/mobile`）**

## 1. 开发服务器（交付 1）

| 项       | 值                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| URL      | **http://localhost:5173/**                                                                                               |
| 启动命令 | `cd /home/nathan/Project/nao-todo && pnpm --filter @nao-todo/webapp dev`                                                 |
| 停止方式 | 前台 `Ctrl+C`；当前为后台进程，可 `kill 2722899`（或 `ss -ltnp                                                           | grep 5173` 查 pid） |
| API base | `http://localhost:3302/api`（`apps/web/.env`；本机 Docker `naotodoserver` 已在 3302 监听）                               |
| 前后端   | **均就绪**：后端本机 3302 实测 `POST /api/auth/signin` 返回 `10010 登录成功`；前端 dev server 实测 `HTTP 200`            |
| 登录方式 | 打开 URL → 未登录会跳 `#/auth/signin` → 用**本机 3302 服务端上的账号**邮箱 + 密码登录（无账号可在 `#/auth/signup` 注册） |

> 若你的账号只存在于线上（`todobe.nathanao.space`）：把 `apps/web/.env` 的 `VITE_BASE_URL` / `VITE_API_BASE_URL` 改指向线上后重启 dev server。

## 2. 冲突数据注入（交付 2）

**零改仓**：不新增/修改任何产品代码，纯 IndexedDB 注入（`plain:` 明文姿态下本地行可直接写入，无需密钥）。
片段读 `localStorage.USER_JWT` 解析当前登录 `userId`，**会给「你自己账号」**写入 9 条冲突 + 4 条配套本地行，并**先备份你原有的冲突记账**（重置时原样恢复）。

覆盖清单（逐项对应）：

| #   | 走查项                               | 片段如何覆盖                                                                                       |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 1   | 同一实体多条冲突（分组）             | `tasks:t337-task-a` 3 条 + `projects:t337-project-b` 2 条                                          |
| 2   | 三态齐备（`+` 绿 / `−` 红 / `~` 黄） | 富差异组：`archivedAt` 新增(+)、`starMarkAt` 删除(−)、`name`/`description` 修改(~)                 |
| 3   | 长值截断 + 展开/收起                 | `description` 当前值 86 字 > 80 ⇒ 单行截断 + 「展开/收起」                                         |
| 4   | 技术字段默认隐藏                     | 默认过滤 `updatedAt`/`revision`；开「显示技术字段」后 4 行 → 6 行                                  |
| 5   | 无标题降级链（不得空白/undefined）   | `tasks:`（无名+空 id）⇒ 落 kind 标签「服务端忽略」；`tasks:t337-task-f`（无名+有 id）⇒ 落 entityId |
| 6   | 计数面 N 与列表一致 + 处理后递减     | 徽标「冲突 9」= 9 条；处理一组（3 条）→「冲突 6」；全部处理 → 0 / 徽标消失                         |
| 7   | 中/英文案                            | T332 新增 5 键（`groupCount`/`showTechnical`/`expand`/`collapse`/`unknownObject`）中英均已实测渲染 |

### 片段（粘进 DevTools Console，回车）

```text
/* =====================================================================
 * NaoTodo · T337 冲突界面复现数据（控制台片段，零改仓）
 * 前提：已登录 webapp（本片段读 localStorage.USER_JWT 解析 userId）
 * 行为：备份现有冲突记账 → 写入 9 条冲突 + 配套本地行 → 刷新徽标计数
 * 重置：在同一页面控制台执行  __t337Reset()
 * ===================================================================== */
(async () => {
    const DB = 'nao-todo-desktop'
    const P = 't337-'
    const JOURNAL_SUFFIX = ':conflict-journal'
    const BACKUP_SUFFIX = ':t337-journal-backup'
    // 全部业务表 + 同步队列（重置/孤儿扫描同口径；覆盖无外键时的全部表）
    const TABLES = [
        'projects',
        'projectPreferences',
        'tags',
        'tagPreferences',
        'tasks',
        'taskCheckItems',
        'taskComments',
        'pomodoros',
        'pomodoroRecords',
        'users',
        'userConfigs',
        'syncQueue'
    ]

    // —— 1) 解析当前登录用户 userId（雪花 ID 不丢精度） ——
    const jwt = localStorage.getItem('USER_JWT')
    if (!jwt) throw new Error('未检测到登录会话（localStorage.USER_JWT 缺失）⇒ 请先登录再执行')
    let b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const m = atob(b64).match(/["'](?:Id|id)["']\s*:\s*"?(\d+)/)
    const userId = m && m[1]
    if (!userId) throw new Error('无法从 JWT 解析 userId')

    // —— 2) 打开既有本地库（不建库、不改 schema） ——
    const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        req.onupgradeneeded = () => reject(new Error('本地库尚未创建：请让应用完整加载后再执行'))
    })

    // —— 3) IDB 小工具 ——
    const txDone = (t) =>
        new Promise((res, rej) => {
            t.oncomplete = () => res()
            t.onerror = () => rej(t.error)
            t.onabort = () => rej(t.error)
        })
    const reqOf = (r) =>
        new Promise((res, rej) => {
            r.onsuccess = () => res(r.result)
            r.onerror = () => rej(r.error)
        })

    const JOURNAL_ID = userId + JOURNAL_SUFFIX
    const BACKUP_ID = userId + BACKUP_SUFFIX

    // —— 4) 造数载荷 ——
    const LONG =
        '在周五的评审里我们把登录流程拆成三步：先做设备指纹校验，再做二次验证，最后写回服务端会话；这段描述故意写得很长，用来验证冲突 diff 的单行截断与「展开 / 收起」按钮。'
    const ISO = (n) => new Date(Date.UTC(2026, 8, 20, 10, 0, n)).toISOString()

    const taskA = {
        id: P + 'task-a',
        userId,
        parentTaskId: '',
        name: 'plain:重构登录模块',
        description: 'plain:' + LONG,
        state: 'doing',
        priority: 'high',
        startAt: '2026-09-01T00:00:00.000Z',
        endAt: '2026-09-30T00:00:00.000Z',
        projectId: '',
        tags: [],
        archivedAt: '2026-09-10T08:00:00.000Z',
        starMarkAt: null,
        givenUpAt: null,
        remindAt: '',
        remindRepeat: '',
        remindTime: '',
        remindWeekdays: [],
        checkItemCount: 0,
        commentCount: 0,
        subtaskCount: 0,
        sortId: 1,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-09-20T10:00:00.000Z',
        deletedAt: null,
        syncedServerUpdatedAt: '2026-09-20T10:00:00.000Z'
    }
    // 富差异败方快照（该实体最后一条 ⇒ 对比面板取它）：三态齐备 + 长值 + 技术字段
    const loserA = {
        id: P + 'task-a',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-09-19T10:00:00.000Z',
        deletedAt: null,
        parentTaskId: '',
        name: '我的登录模块改动',
        description: '我本地改过的简短描述',
        state: 'doing',
        priority: 'high',
        startAt: '2026-09-01T00:00:00.000Z',
        endAt: '2026-09-30T00:00:00.000Z',
        projectId: '',
        tags: [],
        archivedAt: null,
        starMarkAt: '2026-09-18T09:00:00.000Z',
        givenUpAt: null,
        remindAt: '',
        remindRepeat: '',
        remindTime: '',
        remindWeekdays: [],
        checkItemCount: 0,
        commentCount: 0,
        subtaskCount: 0,
        sortId: 1,
        revision: 7
    }
    const loserAMin = {
        id: P + 'task-a',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-09-17T10:00:00.000Z',
        deletedAt: null,
        parentTaskId: '',
        name: '我的登录模块改动',
        description: '更早的一次本地改动',
        state: 'todo',
        priority: 'medium',
        startAt: '2026-09-01T00:00:00.000Z',
        endAt: '2026-09-30T00:00:00.000Z',
        projectId: '',
        tags: [],
        archivedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        remindAt: '',
        remindRepeat: '',
        remindTime: '',
        remindWeekdays: [],
        checkItemCount: 0,
        commentCount: 0,
        subtaskCount: 0,
        sortId: 1
    }

    const projB = {
        id: P + 'project-b',
        userId,
        name: 'plain:云端项目·旧名',
        icon: 'ntd-folder',
        description: 'plain:项目描述',
        createdAt: '2026-08-02T00:00:00.000Z',
        updatedAt: '2026-09-20T11:00:00.000Z',
        deletedAt: null,
        archivedAt: null,
        deactivedAt: null,
        sortId: 2,
        taskCount: 0,
        syncedServerUpdatedAt: '2026-09-20T11:00:00.000Z'
    }
    const loserB = {
        id: P + 'project-b',
        createdAt: '2026-08-02T00:00:00.000Z',
        updatedAt: '2026-09-19T11:00:00.000Z',
        deletedAt: null,
        name: '我的项目新名',
        icon: 'ntd-folder',
        description: '我改的项目描述',
        archivedAt: null,
        deactivedAt: null,
        sortId: 2,
        taskCount: 0
    }

    const tagC = {
        id: P + 'tag-c',
        userId,
        icon: 'ntd-tag',
        name: 'plain:工作',
        description: 'plain:工作标签',
        color: '#3b82f6',
        sortId: 1,
        createdAt: '2026-08-03T00:00:00.000Z',
        updatedAt: '2026-09-20T12:00:00.000Z',
        deletedAt: null,
        syncedServerUpdatedAt: '2026-09-20T12:00:00.000Z'
    }
    const loserC = {
        id: P + 'tag-c',
        createdAt: '2026-08-03T00:00:00.000Z',
        updatedAt: '2026-09-19T12:00:00.000Z',
        deletedAt: null,
        icon: 'ntd-tag',
        name: '我的工作标签',
        description: '工作标签',
        color: '#ef4444',
        sortId: 1
    }

    const taskE = {
        id: P + 'task-e',
        userId,
        parentTaskId: '',
        name: 'plain:评审 PR',
        description: 'plain:评审描述',
        state: 'todo',
        priority: 'medium',
        startAt: '2026-09-05T00:00:00.000Z',
        endAt: '2026-09-06T00:00:00.000Z',
        projectId: '',
        tags: [],
        archivedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        remindAt: '',
        remindRepeat: '',
        remindTime: '',
        remindWeekdays: [],
        checkItemCount: 0,
        commentCount: 0,
        subtaskCount: 0,
        sortId: 2,
        createdAt: '2026-08-05T00:00:00.000Z',
        updatedAt: '2026-09-20T13:00:00.000Z',
        deletedAt: null,
        syncedServerUpdatedAt: '2026-09-20T13:00:00.000Z'
    }
    const loserE = {
        id: P + 'task-e',
        createdAt: '2026-08-05T00:00:00.000Z',
        updatedAt: '2026-09-18T13:00:00.000Z',
        deletedAt: null,
        parentTaskId: '',
        name: '评审 PR（我的版本）',
        description: '评审描述',
        state: 'done',
        priority: 'medium',
        startAt: '2026-09-05T00:00:00.000Z',
        endAt: '2026-09-06T00:00:00.000Z',
        projectId: '',
        tags: [],
        archivedAt: null,
        starMarkAt: null,
        givenUpAt: null,
        remindAt: '',
        remindRepeat: '',
        remindTime: '',
        remindWeekdays: [],
        checkItemCount: 0,
        commentCount: 0,
        subtaskCount: 0,
        sortId: 2
    }

    const entry = (kind, table, entityId, loser, n) => ({
        kind,
        table,
        entityId,
        loser,
        winnerUpdatedAt: ISO(n),
        loserUpdatedAt: ISO(n - 1),
        at: ISO(n)
    })
    // 顺序即列表顺序；同实体「最后一条」= 对比面板所用快照
    const seeds = [
        entry('stale', 'tasks', P + 'task-a', loserAMin, 1),
        entry('push-noop', 'tasks', P + 'task-a', loserAMin, 2),
        entry('remote-wins', 'tasks', P + 'task-a', loserA, 3),
        entry('remote-wins', 'projects', P + 'project-b', loserB, 4),
        entry('stale', 'projects', P + 'project-b', loserB, 5),
        entry('remote-wins', 'tags', P + 'tag-c', loserC, 6),
        entry('skipped', 'tasks', '', {}, 7), // 降级：无名 + 空 entityId ⇒ 落到 kind 标签
        entry('remote-wins', 'tasks', P + 'task-f', {}, 8), // 降级：无名 + 有 entityId ⇒ 落到 entityId
        entry('remote-wins', 'tasks', P + 'task-e', loserE, 9)
    ]

    // —— 5) 写入：备份旧记账 + 覆盖 journal + 落本地行 ——
    {
        const t = db.transaction(['meta', 'tasks', 'projects', 'tags'], 'readwrite')
        const meta = t.objectStore('meta')
        const previous = await reqOf(meta.get(JOURNAL_ID))
        const backup = await reqOf(meta.get(BACKUP_ID))
        if (!backup) {
            await reqOf(
                meta.put({
                    id: BACKUP_ID,
                    conflictJournal: previous ? previous.conflictJournal || [] : [],
                    conflictJournalEvictedCount: previous
                        ? previous.conflictJournalEvictedCount || 0
                        : 0
                })
            )
        }
        await reqOf(
            meta.put({
                id: JOURNAL_ID,
                conflictJournal: seeds,
                conflictJournalEvictedCount: 0
            })
        )
        await reqOf(t.objectStore('tasks').put(taskA))
        await reqOf(t.objectStore('tasks').put(taskE))
        await reqOf(t.objectStore('projects').put(projB))
        await reqOf(t.objectStore('tags').put(tagC))
        await txDone(t)
    }

    // —— 6) 造「重置」片段 ——
    window.__t337Reset = async () => {
        const t = db.transaction(['meta', ...TABLES], 'readwrite')
        const meta = t.objectStore('meta')
        const backup = await reqOf(meta.get(BACKUP_ID))
        if (backup) {
            await reqOf(
                meta.put({
                    id: JOURNAL_ID,
                    conflictJournal: backup.conflictJournal || [],
                    conflictJournalEvictedCount: backup.conflictJournalEvictedCount || 0
                })
            )
            await reqOf(meta.delete(BACKUP_ID))
        } else {
            await reqOf(
                meta.put({ id: JOURNAL_ID, conflictJournal: [], conflictJournalEvictedCount: 0 })
            )
        }
        let removedRows = 0
        for (const name of TABLES) {
            const store = t.objectStore(name)
            const all = await reqOf(store.getAll())
            for (const row of all) {
                const key = name === 'syncQueue' ? row.entityId : row.id
                if (typeof key === 'string' && key.startsWith(P)) {
                    await reqOf(store.delete(row.id))
                    removedRows++
                }
            }
        }
        await txDone(t)
        const count = (backup ? backup.conflictJournal || [] : []).length
        await setLiveCount(count)
        console.info(`[T337] 已重置：恢复冲突 ${count} 条，清理伪造行 ${removedRows} 行`)
        return { restoredConflicts: count, removedRows }
    }

    // —— 7) 尽力刷新徽标计数（dev 下直连单例；失败则提示刷新页面） ——
    const setLiveCount = async (count) => {
        try {
            const mod = await import(
                '/@fs/home/nathan/Project/nao-todo/packages/infrastructure/src/persistence-sync/sync-status.ts'
            )
            if (mod && mod.syncStatus) {
                mod.syncStatus.setConflictCount(count)
                return true
            }
        } catch (e) {
            /* dev 直连失败 ⇒ 走整页刷新 */
        }
        return false
    }
    const live = await setLiveCount(seeds.length)

    window.__t337UserId = userId
    const result = {
        userId,
        注入冲突条数: seeds.length,
        分组数: 6,
        伪造本地行: 4,
        徽标已刷新: live,
        提示: live
            ? '打开左侧栏底部「同步」按钮 → 面板内「冲突 9」'
            : '请刷新页面（F5）后打开同步面板',
        重置方式: '控制台执行 __t337Reset()（列表随后需开关一次面板或刷新以清空）'
    }
    console.info('[T337] 冲突复现数据已注入', result)
    return result
})()
```

### 重置（同一页面 Console）

```text
__t337Reset()
```

重置会：恢复你原有冲突记账（备份在 `meta` 的 `<userId>:t337-journal-backup`，重置即消费并删除）· 删除全部 `t337-` 伪造行（覆盖 **12 张业务表 + syncQueue**，无孤儿）· 计数归零。
**重置后需开关一次面板或 F5**，已展开的列表才会清空（列表在挂载时读取）。

## 3. 自测结论（交付 3 · 真实 Chromium + CDP，本机 :5173）

命令：`node t337-walk.mjs` / `t337-final.mjs` / `t337-en.mjs` / `t337-scan.mjs`（CDP `Runtime.evaluate` + 真实 DOM 断言）

| 断言                   | 数字/结果                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 注入后 journal 条数    | **9**（`listConflicts().items.length`）                                                                                                                         |
| 分组数                 | **6**（3+2+1+1+1+1）                                                                                                                                            |
| 分组标题（默认全展开） | 任务 · 我的登录模块改动 / 项目 · 我的项目新名 / 标签 · 我的工作标签 / 任务 · 服务端忽略 / 任务 · t337-task-f / 任务 · 评审 PR（我的版本）——**无空白/undefined** |
| 折叠                   | 点组头 ⇒ `aria-expanded=false`、列表 `display:none`                                                                                                             |
| 默认 diff 行           | `name:~ / description:~(截断+展开) / archivedAt:+ / starMarkAt:−` ⇒ **三态齐备**                                                                                |
| 技术字段开关           | off=`[name,description,archivedAt,starMarkAt]` → on=`[updatedAt,name,description,archivedAt,starMarkAt,revision]`                                               |
| 长值展开               | `description` 由 `is-truncated` → 展开后类名移除、按钮变「收起」                                                                                                |
| 徽标 === 列表条数      | 面板「冲突 9」= journal 9                                                                                                                                       |
| 「保留服务端版本」后   | 「冲突 9」→「冲突 6」（移除该实体全部 3 条，T331 递减）；分组 6 → 5                                                                                             |
| 全量处理后             | `remaining=0`、`conflictCount=0`、徽标 DOM 消失                                                                                                                 |
| 英文渲染               | Groups/Tech/Expand/Keep server version/Retry with my version/Close 均为英文                                                                                     |
| 重置                   | `restoredConflicts=0, removedRows=4`                                                                                                                            |

> 视觉观感（配色/字号/间距/手感）由用户判定，本报告只给可自动化断言数字。

## 4. 给用户的操作步骤（交付 4）

1. 打开 **http://localhost:5173/** → 用**本机 3302 服务端**上的账号登录（未登录会跳登录页）。
2. 在 DevTools Console 粘贴**片段**并回车 → 打开左侧栏底部「**同步**」按钮 → 面板出现「**冲突 9**」（如未显示，F5 一次）。
3. 展开「冲突 9」→ 点第一个组头/条目 → 勾选清单：
    - 分组：组头「任务 · 我的登录模块改动 · 3 条冲突」，可折叠、默认展开；
    - 三态：+ / − / ~ 三种符号与配色各至少一行；
    - 技术字段：默认隐藏 `updatedAt`/`revision`，点「显示技术字段」出现；
    - 长值：`description` 单行截断，点「展开/收起」；
    - 无标题：「任务 · 服务端忽略」（不空白）；
    - 计数：面板「冲突 9」，点「保留服务端版本」→ 立即变「冲突 6」，全部处理 → 徽标消失；
    - 中/英：切语言各看一次文案。
      **重置**：Console 执行 `__t337Reset()`，再开关面板或 F5。

> ⚠️ 「**以我的版本重试**」会把该伪造条目**写回本地并入队推送**（下轮同步会把伪造任务上送到你的账号）。若只想验计数，优先用「保留服务端版本」（无副作用）。

## 5. 残留与风险（回滚不完整项自查）

重置后逐表孤儿扫描（真实 Chromium，`t337-` 前缀残留数）：

| 表                 | 残留 | 表              | 残留                           |
| ------------------ | ---- | --------------- | ------------------------------ |
| projects           | 0    | pomodoros       | 0                              |
| projectPreferences | 0    | pomodoroRecords | 0                              |
| tags               | 0    | users           | 0                              |
| tagPreferences     | 0    | userConfigs     | 0                              |
| tasks              | 0    | syncQueue       | 0                              |
| taskCheckItems     | 0    | meta            | 0（journal=0；备份记录已删除） |
| taskComments       | 0    |                 |                                |

| 项                    | 状态                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 伪造本地行 / 冲突记账 | ✅ 可一键重置，12 表 + syncQueue 扫描残留全 0、无孤儿                                                                           |
| QA 测试账号           | 本机 3302 **新增** `qa-t337@example.com`（自测用）。后端无 DELETE 用户端点 ⇒ **无法删除**，登记为已知残留（同历史 QA 账号惯例） |
| 代码改动              | ✅ **无**（零改仓）                                                                                                             |
| 移动端红线            | ✅ 未触碰                                                                                                                       |

## 6. 真实缺陷

未发现。片段注入与 UI 表现均符合 T331/T332 预期；无单列上报项。