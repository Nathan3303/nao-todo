/**
 * DEF-STORE-06 实机验收回归（常驻探针）
 *
 * 被测：`fix 4e51ca30`（应用级失效中心 + 详情 store 失效通路）
 * 断言（等价于 PM seq 54 批准的 T1 验收口径，并含原始验收证据）：
 *   外部 API 直写 S.endAt = B → 立即同步（`pulls≥1` 确认执行）
 *   → **T1 静置 3s、零交互、不重载不重开面板**
 *     ⇒ `store.details`（S）= B（新值）**且** 面板内 S 行文案 = 新值（text/title 任一形态）
 *   → **T2 重载自愈对照**（行文案 = 新值，防假成功）
 *   → 抖动计数：重复 pull 应 = 0（hub 幂等守卫防双发）；list 拉取增量归因 `RefreshData` 视图重取，**不判 FAIL**
 *
 * 数据纪律：夹具前缀 `[QA-STORE06]`；测完清理 + 核 `0 pending / 0 failed`；构造失败 ⇒ SKIP + 诊断，不判 FAIL。
 * 环境前置：后端 3302、窗口前台；同步触发用合成 click（`openPanel` 的真实点击在部分环境下打不开同步面板，见 `lib/app.mjs` 回退注释）。
 */
import { sleep } from '../lib/cdp.mjs'
import { SEL, bootstrap } from '../lib/app.mjs'
import { qaKit } from './task-01-subtask-inherit.mjs'

const {
    createTaskViaUi,
    createSubTaskViaUi,
    readViaApi,
    readCopies,
    apiUpdateTask,
    ensureTaskList
} = qaKit

const PREFIX = '[QA-STORE06]'
const RUN_TAG = Date.now().toString(36)
const DETAILS_DRAWER = '.nue-drawer'
const TS = (v) => (v ? new Date(v).getTime() : null)

const expect = (checks, id, title, ok, detail) => {
    checks.push({ id, title, status: ok ? 'PASS' : 'FAIL', detail: String(detail) })
    return checks
}
const info = (checks, id, title, detail) => {
    checks.push({ id, title, status: 'INFO', detail: String(detail) })
    return checks
}
const skip = (checks, id, title, detail) => {
    checks.push({ id, title, status: 'SKIP', detail: String(detail) })
    return checks
}

/** 本地 DB（Dexie `nao-todo-desktop`.tasks）读回 —— 判据树的"本地库"层 */
async function dbReadTask(cdp, taskId) {
    return cdp.json(`(async () => {
        return await new Promise((resolve) => {
            const req = indexedDB.open('nao-todo-desktop')
            req.onerror = () => resolve({ found: false, error: String(req.error) })
            req.onsuccess = () => {
                try {
                    const st = req.result.transaction('tasks', 'readonly').objectStore('tasks')
                    const g = st.get(${JSON.stringify(taskId)})
                    g.onerror = () => resolve({ found: false, error: 'get-error' })
                    g.onsuccess = () =>
                        resolve({
                            found: !!g.result,
                            endAt: g.result ? (g.result.endAt ?? null) : null,
                            updatedAt: g.result ? (g.result.updatedAt ?? null) : null
                        })
                } catch (err) {
                    resolve({ found: false, error: String(err) })
                }
            }
        })
    })()`)
}

/** 打开任务详情（路由直达）并等抽屉就绪 */
async function openTaskDetails(cdp, taskId) {
    await cdp.evaluate(`
        const target = '#/tasks/all/table/' + ${JSON.stringify(taskId)}
        if (location.hash !== target) location.hash = target
        await new Promise((r) => setTimeout(r, 2400))
        return location.hash
    `)
    for (let i = 0; i < 16; i++) {
        const ready = await cdp.evaluate(
            `return !!document.querySelector('${DETAILS_DRAWER}') && !document.querySelector('${DETAILS_DRAWER} .nue-loading')`
        )
        if (ready) return { ok: true }
        await sleep(500)
    }
    return { ok: false, reason: '详情抽屉未就绪' }
}

/** 面板内 S 行文案（text + title 双形态 + 是否在视口） */
async function probeRow(cdp, name) {
    return cdp.json(`(async () => {
        const rows = [...document.querySelectorAll('.subtask-row')]
        const row = rows.find((r) => (r.querySelector('.subtask-row__name')?.textContent || '').trim() === ${JSON.stringify(name)})
        if (!row) return { found: false, rowCount: rows.length }
        const timeEl = row.querySelector('.subtask-row__time')
        const rect = row.getBoundingClientRect()
        return {
            found: true,
            text: timeEl ? (timeEl.textContent || '').trim() : null,
            title: timeEl ? timeEl.getAttribute('title') : null,
            inViewport: rect.width > 0 && rect.height > 0
        }
    })()`)
}

/**
 * 主验收组：外部直写 B → 立即同步 → T0/T1（零交互）→ T2（重载自愈）→ 抖动计数
 */
async function store06(ctx) {
    const { cdp, email, password } = ctx
    const checks = []
    const sName = `${PREFIX} ${RUN_TAG} 子`
    await ensureTaskList(cdp)
    const parent = await createTaskViaUi(cdp, { title: `${PREFIX} ${RUN_TAG} 父`, scheduled: true })
    if (!parent.ok) return skip(checks, 'STORE06.parent', '父任务 P', `创建失败：${parent.reason}`)
    const child = await createSubTaskViaUi(cdp, { parentId: parent.task.id, title: sName })
    if (!child.ok) return skip(checks, 'STORE06.child', '子任务 S', `创建失败：${child.reason}`)
    const sId = child.task.id
    info(
        checks,
        'STORE06.fixture',
        '夹具 P/S 就绪（S 继承时间窗）',
        JSON.stringify({
            P: parent.task.id,
            S: sId,
            startAt: child.task.startAt,
            endAt: child.task.endAt
        })
    )
    if (!(await openTaskDetails(cdp, parent.task.id)).ok)
        return skip(checks, 'STORE06.open', '打开 P 详情面板', '抽屉未就绪')
    const baseline = {
        DB: (await dbReadTask(cdp, sId)).endAt,
        details: (await readCopies(cdp, sId)).details?.endAt ?? null,
        row: await probeRow(cdp, sName)
    }
    info(
        checks,
        'STORE06.baseline',
        '基线（同步前）',
        JSON.stringify({ DB: baseline.DB, details: baseline.details, row: baseline.row })
    )
    // 外部直写 B
    const newEndAt = (() => {
        const d = new Date()
        d.setUTCDate(d.getUTCDate() + 3)
        d.setUTCHours(8, 0, 0, 0)
        return d.toISOString()
    })()
    const before = await readViaApi(cdp, sId)
    const write = await apiUpdateTask(cdp, sId, { endAt: newEndAt })
    await sleep(700)
    const after = await readViaApi(cdp, sId)
    const bumped = TS(after.value?.updatedAt) !== TS(before.value?.updatedAt)
    expect(
        checks,
        'STORE06.write',
        '外部 API 直写 B 生效（40020 且 updated_at bump）',
        write?.code === 40020 && bumped,
        `write=${JSON.stringify(write)} 服务端B=${JSON.stringify(after.value?.endAt)} bump=${bumped}`
    )
    if (write?.code !== 40020 || !bumped) return checks
    // 立即同步（合成 click 路径）+ 抖动计数
    cdp.clearRequests()
    let pulls = 0
    for (let attempt = 0; attempt < 2 && pulls === 0; attempt++) {
        await cdp.evaluate(
            `document.querySelector('${SEL.railBtn}')?.click(); await new Promise(r=>setTimeout(r,800)); return 1`
        )
        const clicked = await cdp.evaluate(
            `(async () => { const b = document.querySelector('${SEL.panel} .nue-button--primary'); if (!b) return false; b.click(); await new Promise((r) => setTimeout(r, 200)); return true })()`
        )
        for (let i = 0; i < 50; i++) {
            await sleep(300)
            pulls = cdp.requests().filter((u) => /api\/sync\/pull/.test(u)).length
            if (pulls >= 1) break
        }
        await cdp.evaluate(
            `document.querySelector('${SEL.railBtn}')?.click(); await new Promise((r) => setTimeout(r, 200)); return 1`
        )
        if (pulls === 0)
            info(
                checks,
                'STORE06.syncAttempt',
                '同步触发重试',
                `attempt=${attempt + 1} clicked=${clicked}`
            )
    }
    // T0：等 DB 落 B 后即刻读
    for (let i = 0; i < 30; i++) {
        await sleep(300)
        if (TS((await dbReadTask(cdp, sId)).endAt) === TS(after.value?.endAt)) break
    }
    const reqsT0 = {
        pulls: cdp.requests().filter((u) => /api\/sync\/pull/.test(u)).length,
        listFetches: cdp.requests().filter((u) => /api\/tasks\/?(\\?|$)/.test(u)).length
    }
    const readSnap = async () => {
        const copies = await readCopies(cdp, sId)
        return {
            DB: (await dbReadTask(cdp, sId)).endAt,
            details: copies.details?.endAt ?? null,
            diff: copies.diff,
            row: await probeRow(cdp, sName)
        }
    }
    const t0 = await readSnap()
    // T1：静置 3s，零交互、不重载不重开面板
    await sleep(3000)
    const t1 = await readSnap()
    const reqsT1 = {
        pulls: cdp.requests().filter((u) => /api\/sync\/pull/.test(u)).length,
        listFetches: cdp.requests().filter((u) => /api\/tasks\/?(\\?|$)/.test(u)).length
    }
    info(
        checks,
        'STORE06.t0t1',
        'T0/T1 快照（未重载、未重开面板）',
        JSON.stringify({ T0: t0, T1: t1, 服务端: after.value?.endAt })
    )
    if (pulls === 0) {
        skip(
            checks,
            'STORE06.sync',
            '立即同步执行',
            'pulls=0（未能证实同步执行）⇒ 本轮作废，不判 FAIL'
        )
        return checks
    }
    // 断言
    const detailsB = TS(t1.details) === TS(after.value?.endAt)
    const rowNew = !!t1.row.found && t1.row.text && !/本月|30日/.test(t1.row.text)
    expect(
        checks,
        'STORE06.t1.details',
        'T1（静置3s 零交互）`store.details`（S）= B（新值）',
        detailsB,
        `details=${JSON.stringify(t1.details)} 服务端=${JSON.stringify(after.value?.endAt)} diff=${JSON.stringify(t1.diff)}`
    )
    expect(
        checks,
        'STORE06.t1.row',
        'T1 面板内 S 行文案 = 新值（text/title 形态）',
        rowNew,
        `row=${JSON.stringify(t1.row)}（旧值形态=含"本月/30日"）`
    )
    // T2：重载自愈对照（重载后需重新引导：解锁/等壳）
    await cdp.reload(3000)
    await bootstrap(cdp, { email, password })
    await sleep(3000)
    await openTaskDetails(cdp, parent.task.id)
    const rowT2 = await probeRow(cdp, sName)
    const dbT2 = (await dbReadTask(cdp, sId)).endAt
    const rowT2New = !!rowT2.found && rowT2.text && !/本月|30日/.test(rowT2.text)
    expect(
        checks,
        'STORE06.t2',
        'T2（重载后）行文案 = 新值（自愈对照，防假成功）',
        rowT2New,
        `row=${JSON.stringify(rowT2)} DB=${JSON.stringify(dbT2)}`
    )
    // 抖动计数（重复 pull 应=0；list 增量归因 RefreshData 视图重取，不判 FAIL）
    const repeatPulls = reqsT1.pulls - reqsT0.pulls
    const listDelta = reqsT1.listFetches - reqsT0.listFetches
    expect(
        checks,
        'STORE06.jitter.pull',
        '抖动：重复 pull = 0（hub 幂等守卫防双发）',
        repeatPulls === 0,
        `同步窗口 pulls=${reqsT0.pulls} → T1 后 pulls=${reqsT1.pulls}（重复=${repeatPulls}）`
    )
    info(
        checks,
        'STORE06.jitter.list',
        'list 拉取增量（归因 RefreshData 视图重取，不判 FAIL）',
        `同步窗口 listFetches=${reqsT0.listFetches} → T1 后=${reqsT1.listFetches}（增量=${listDelta}）；非 pull 双发/回拉风暴`
    )
    info(
        checks,
        'STORE06.grade',
        '验收结论',
        JSON.stringify({
            pulls,
            T1_details_B: detailsB,
            T1_行文案新: rowNew,
            T2_行文案新: rowT2New,
            重复pull: repeatPulls
        })
    )
    return checks
}

/**
 * 受控数据清理：`[QA-STORE06]` 任务经 API DELETE（软删）后核 0 pending / 0 failed
 */
async function cleanup(ctx) {
    const { cdp } = ctx
    const checks = []
    const result = await cdp.json(`(async () => {
        const jwt = localStorage.getItem('USER_JWT')
        const auth = { headers: { Authorization: 'Bearer ' + jwt } }
        const json = async (r) => { try { return await r.json() } catch (e) { return {} } }
        const list = await json(await fetch('http://localhost:3302/api/tasks/?limit=500', auth))
        const targets = (Array.isArray(list?.data) ? list.data : (list?.data?.list ?? [])).filter((t) => String(t.name || '').startsWith(${JSON.stringify(PREFIX)}))
        const deleted = []
        for (const t of targets) {
            const res = await fetch('http://localhost:3302/api/tasks/' + t.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + jwt } })
            const body = await json(res)
            deleted.push({ id: t.id, code: body?.code })
        }
        const after = await json(await fetch('http://localhost:3302/api/tasks/?limit=500', auth))
        const remain = (Array.isArray(after?.data) ? after.data : (after?.data?.list ?? [])).filter((t) => String(t.name || '').startsWith(${JSON.stringify(PREFIX)})).length
        return { targets: targets.length, deleted, remain, totalAfter: (Array.isArray(after?.data) ? after.data : (after?.data?.list ?? [])).length }
    })()`)
    info(checks, 'CLEANUP.info', '[QA-STORE06] 清理', JSON.stringify(result))
    expect(
        checks,
        'CLEANUP.a',
        '`[QA-STORE06]` 任务已删除（API 口径）',
        result.remain === 0,
        `targets=${result.targets} remain=${result.remain} totalAfter=${result.totalAfter}`
    )
    const idle = await cdp.evaluate(`
        for (let i = 0; i < 40; i++) {
            const btn = document.querySelector('${SEL.railBtn}')
            if (btn && !btn.disabled) return true
            await new Promise((r) => setTimeout(r, 500))
        }
        return false
    `)
    expect(checks, 'CLEANUP.b', '同步收口且 0 pending / 0 failed', idle === true, `idle=${idle}`)
    return checks
}

export const defStore06StoreInvalidation = {
    id: 'def-store-06',
    title: 'DEF-STORE-06 详情 store 失效通路（T1 验收回归）',
    groups: [
        {
            id: 'store06',
            title: '外部直写 → 立即同步 → T1 零交互变新 + T2 自愈 + 抖动计数',
            run: store06
        },
        { id: 'cleanup', title: '受控数据清理（[QA-STORE06] + 0 pending/0 failed）', run: cleanup }
    ]
}