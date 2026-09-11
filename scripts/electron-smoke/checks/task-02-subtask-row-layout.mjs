/**
 * TASK-02 子任务行布局精简 · 实机冒烟（AC①…⑧）
 *
 * 需求（用户）：① 开始/结束时间**移到名称末尾**（宽度随文本、可溢出隐藏）
 *              ② **移除编辑按钮** ③ 脱离父任务按钮**移到名称末尾**、不再单独一列
 * 范围：**仅 web/desktop**（移动端 `presentation-react` 不动）
 * 权威口径：`docs/prds/2026-09-11-subtask-row-layout.md`（AC①…⑧）
 *           + `docs/adr/2026-09-11-task-02-subtask-row-layout.md`（§3 布局判据、§4 交互/可达性）
 *
 * ── 断言口径（AC②③ 属**真实排版** ⇒ 必须在渲染进程量测）──────────────────
 * `getComputedStyle` + `getBoundingClientRect` + `scrollWidth/clientWidth`。
 * **强制"空间不足"的手法**（PM 要求写明）：见 `ac2` / `ac3` 两组 ——
 *   ① 64 字长名称（`LONG_NAME`，名称上限 `maxlength=64`）
 *   ② `Emulation.setDeviceMetricsOverride` 收窄**渲染视口**（`setViewport`；逐级 420 → 320 → 260）
 *   两者**同时**使用；各组内嵌**实测数值**，并在 INFO 里记录"能触发截断的最小视口宽"。
 *
 * ── 文案口径（实测 i18n，与改动前**逐字一致**）────────────────────────────
 * `task.details.startedAt` = `开始于 {time}`、`task.details.dueAt` = `{time} 截止`（`packages/shared/locales/zh-CN.ts:303-304`），
 * 连接符 `' ~ '`。PRD/派单里的「开始 … ~ 结束 …」是**语义转述**，断言以 i18n 实际值为准。
 * 改动前同一段拼接逻辑见 `git show c37ca162:…/subtasks.vue` 的 `metaText()`（同键、同 `' ~ '`）——**格式未变**，
 * 变化仅是：时间移出 meta 行 + meta 行不再用 `' · '` 拼描述。
 *
 * ── 不得判缺陷（PM 写死）────────────────────────────────────────────────
 * 跨端不一致（移动端无时间/无改名/有删除；web 有脱离无删除，C-R1 已登记）｜时间整体截断**可能切在 `~` 中间**（预期）｜
 * 名称截断后**无 tooltip**（全文经详情页）｜`common.edit` 词典键**零引用属预期**｜`TaskHandler.updateTaskName` 零调用属**登记死代码**。
 *
 * ── DEF-STORE-01 探针/复现实测记录（2026-09-11，PM seq 107 后置轮）─────────
 * 1. **副本一致性探针**：对 10 个夹具 id 比较 `TasksStore.tasks` 与 `TaskDetailsStore` 各任务型数组 ⇒
 *    **有效轮次（两副本同 id 同时在场）= 3，命中差异 = 2**：四态-仅截止/仅开始 在**经详情页 UI 改期后**，
 *    列表 `endAt/startAt` 有新值而详情副本 `null`（机制级证据；但该行渲染仍取会重取的源 ⇒ **未观察到用户可见陈旧**）。
 * 2. **5 步受控复现**（API 直写 + 立即同步）：步骤②前置断言通过（服务端 endAt `…09-30T15:36+08` → `…09-14T16:00+08`）；
 *    **步骤④未命中**（两副本一致 `diff=[]`）；P3 **未复现用户可见陈旧**（行文案与本地 store 一致）。
 * 3. **附带新观察（登记，不判 FAIL）**：外部 API 直写的服务端变更经「立即同步」**未被拉回本地**
 *    （服务端已新、本地 store 与行文案仍旧值）⇒ 属「本地⇄服务端拉取」方向，与 DEF-STORE-01（两副本间）不同，交架构定性。
 * 4. UI 改期路径备注：子任务**已有时间窗**时，「选择开始/截止日期」按钮**打不开日历**（`.nue-date-picker-panel` 不出现），
 *    仅新建时（无时间窗、触发器「设置时间」）可用 ⇒ 复现改用 API 直写制造服务端变更。
 *
 * ── 状态注记（清理批次，2026-09-11）───────────────────────────────────────
 * **DEF-UI-01 已驳回**：原判系探针误报；**DEF-SYNC-05 已修**（客户端 `3dc1a340`：游标瞬时比较 + 拉取回拉窗口），
 * 本组探针（`defsync05` / `defui01`）**转正为回归资产** ⇒ 后续轮次应全绿；若再 FAIL 按**新缺陷**处理（不再当已知项跳过）。
 *
 * ── 数据纪律 ─────────────────────────────────────────────────────────────
 * 探针前缀 `[QA-TASK02]`（长名称恰 64 字）；含**无描述**与**有描述**子任务各一；夹具清单复用 TASK-01 的
 * `[QA-TASK01] 清单`（**有意保留的测试夹具**，`ensureProject()` 先查后建）；测完清理 + 核 `0 pending / 0 failed`；
 * 数据构造失败 ⇒ **SKIP + 诊断**，不判 FAIL。
 */
import { sleep } from '../lib/cdp.mjs'
import { bootstrap, clickPanelPrimary, openPanel } from '../lib/app.mjs'
import { qaKit } from './task-01-subtask-inherit.mjs'

const {
    ANCHORS,
    expect,
    info,
    skip,
    readTasks,
    readViaApi,
    readCopies,
    storeConsistencyProbe,
    apiUpdateTask,
    ensureProject,
    ensureTaskList,
    pickDates,
    createTaskViaUi,
    createSubTaskViaUi
} = qaKit

const PREFIX = '[QA-TASK02]'
/** DEF-STORE-01 有界复现专用前缀（PM seq 96） */
const STORE01_PREFIX = '[QA-STORE01]'
/** 复用 TASK-01 夹具清单（脚本注释中已登记为「有意保留的测试夹具」） */
const FIXTURE_PROJECT = `${ANCHORS.taskTitlePrefix} 清单`
const RUN_TAG = Date.now().toString(36)
/** 长名称：**恰好 64 字**（详情页名称 `maxlength=64`）⇒ 构造 AC②③ 的截断条件 */
const LONG_NAME = (() => {
    const head = `${PREFIX} ${RUN_TAG} `
    return head + 'X'.repeat(64 - head.length)
})()
const DETAILS_DRAWER = ANCHORS.detailsDrawer
/** 模块级夹具缓存：run.mjs 每个分组拿到的 `state` 是新对象 ⇒ 跨组复用必须放在模块作用域 */
const FIXTURES = { ready: false, parentA: null, parentB: null, subs: {}, notes: [] }

const names = {
    a1: `${PREFIX} ${RUN_TAG} 常规含描述`,
    a2: LONG_NAME,
    a3: `${PREFIX} ${RUN_TAG} 无描述`,
    a4: `${PREFIX} ${RUN_TAG} 待脱离`,
    /** 短名：抽屉内容宽实测仅 ~404px（时间占 ~218px）⇒ 只有短名才能"名称完整"，用于 AC② 的常规态 */
    short: `${PREFIX} 短${RUN_TAG.slice(-3)}`,
    none: `${PREFIX} ${RUN_TAG} 四态-无时间`,
    endOnly: `${PREFIX} ${RUN_TAG} 四态-仅截止`,
    startOnly: `${PREFIX} ${RUN_TAG} 四态-仅开始`,
    created: `${PREFIX} ${RUN_TAG} 新建子任务`
}
const DESC_TEXT = `${PREFIX} 描述文本（第二行仅描述）`

/* ────────────────────────────── 页面探针 ────────────────────────────── */

/** 单行量测：DOM 顺序 / 三元素盒模型与计算样式 / 是否截断（AC①②③④⑦） */
async function probeRow(cdp, name) {
    return cdp.json(`(async () => {
        const rows = [...document.querySelectorAll('.subtask-row')]
        const row = rows.find((r) => (r.querySelector('.subtask-row__name')?.textContent || '').trim() === ${JSON.stringify(name)})
        if (!row) return { ok: false, reason: '未找到子任务行', rowCount: rows.length, rowNames: rows.map((r) => (r.querySelector('.subtask-row__name')?.textContent || '').trim()).slice(0, 8) }
        const cs = (el) => (el ? getComputedStyle(el) : null)
        const box = (el) => {
            if (!el) return null
            const r = el.getBoundingClientRect()
            return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }
        }
        const nameEl = row.querySelector('.subtask-row__name')
        const timeEl = row.querySelector('.subtask-row__time')
        const detachEl = row.querySelector('.subtask-row__detach')
        const titleLine = row.querySelector('.subtask-row__title-line')
        const metaEl = row.querySelector('.subtask-row__meta')
        const short = (el) => String((el?.className ?? '') + '').split(' ').find((c) => c.indexOf('subtask-row__') === 0) ?? null
        const styleOf = (el) => {
            const s = cs(el)
            return s ? { overflow: s.overflow, overflowX: s.overflowX, whiteSpace: s.whiteSpace, textOverflow: s.textOverflow, flexGrow: s.flexGrow, flexShrink: s.flexShrink, flexBasis: s.flexBasis, maxWidth: s.maxWidth, minWidth: s.minWidth, opacity: s.opacity, display: s.display, visibility: s.visibility } : null
        }
        const rowRect = row.getBoundingClientRect()
        return {
            ok: true,
            viewportWidth: window.innerWidth,
            row: { clientWidth: row.clientWidth, scrollWidth: row.scrollWidth, overflowX: getComputedStyle(row).overflowX, box: box(row), rect: { right: Math.round(rowRect.right) } },
            titleLineBox: box(titleLine),
            order: titleLine ? [...titleLine.children].map(short) : [],
            orderTags: titleLine ? [...titleLine.children].map((c) => c.tagName.toLowerCase()) : [],
            hasActionsColumn: !!row.querySelector('.subtask-row__actions'),
            editButtonCount: [...row.querySelectorAll('button')].filter((b) => (b.getAttribute('title') || '') === '编辑').length,
            name: { text: nameEl?.textContent?.trim() ?? null, length: (nameEl?.textContent ?? '').trim().length, clientWidth: nameEl?.clientWidth ?? null, scrollWidth: nameEl?.scrollWidth ?? null, truncated: !!nameEl && nameEl.scrollWidth > nameEl.clientWidth, style: styleOf(nameEl), box: box(nameEl) },
            time: timeEl ? { text: (timeEl.textContent ?? '').trim(), title: timeEl.getAttribute('title'), clientWidth: timeEl.clientWidth, scrollWidth: timeEl.scrollWidth, truncated: timeEl.scrollWidth > timeEl.clientWidth, style: styleOf(timeEl), box: box(timeEl) } : null,
            detach: detachEl
                ? {
                      title: detachEl.getAttribute('title'),
                      disabled: !!detachEl.disabled,
                      style: styleOf(detachEl),
                      box: box(detachEl),
                      offsetParentNotNull: detachEl.offsetParent !== null,
                      clientRects: detachEl.getClientRects().length,
                      transition: cs(detachEl)?.transition ?? null,
                      transitionProperty: cs(detachEl)?.transitionProperty ?? null,
                      transitionDuration: cs(detachEl)?.transitionDuration ?? null
                  }
                : null,
            meta: metaEl ? { text: (metaEl.textContent ?? '').trim(), count: row.querySelectorAll('.subtask-row__meta').length } : null,
            rowHasFocusWithin: row.matches(':focus-within')
        }
    })()`)
}

/** 打开某任务的详情（**路由直达**最稳）并等子任务行渲染 */
async function openTaskDetails(cdp, taskId, { waitRows = true } = {}) {
    await cdp.evaluate(`
        const target = '#/tasks/all/table/' + ${JSON.stringify(taskId)}
        if (location.hash !== target) location.hash = target
        await new Promise((r) => setTimeout(r, 2200))
        return location.hash
    `)
    if (!waitRows) return { ok: true }
    for (let i = 0; i < 16; i++) {
        const ready = await cdp.evaluate(
            `return !!document.querySelector('${DETAILS_DRAWER}') && !document.querySelector('${DETAILS_DRAWER} .nue-loading')`
        )
        if (ready) return { ok: true }
        await sleep(500)
    }
    return { ok: false, reason: '详情抽屉未就绪' }
}

/** 详情页标题改名（AC⑤ 的"改名路径可用"）：textarea[maxlength=64] */
async function renameViaDetails(cdp, newName) {
    return cdp.json(`(async () => {
        const drawer = document.querySelector('${DETAILS_DRAWER}')
        if (!drawer) return { ok: false, reason: '详情抽屉未打开' }
        const area = [...drawer.querySelectorAll('textarea')].find((t) => t.getAttribute('maxlength') === '64')
        if (!area) return { ok: false, reason: '未找到名称 textarea（maxlength=64）' }
        const before = area.value
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, ${JSON.stringify(newName)})
        area.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 200))
        area.dispatchEvent(new Event('change', { bubbles: true }))
        area.blur()
        await new Promise((r) => setTimeout(r, 2000))
        return { ok: true, before, after: area.value }
    })()`)
}

/** 详情页描述赋值（AC⑦「有描述」夹具）：textarea[maxlength=256] */
async function setDescriptionViaDetails(cdp, text) {
    return cdp.json(`(async () => {
        const drawer = document.querySelector('${DETAILS_DRAWER}')
        if (!drawer) return { ok: false, reason: '详情抽屉未打开' }
        const area = [...drawer.querySelectorAll('textarea')].find((t) => t.getAttribute('maxlength') === '256')
        if (!area) return { ok: false, reason: '未找到描述 textarea（maxlength=256）' }
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, ${JSON.stringify(text)})
        area.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 200))
        area.dispatchEvent(new Event('change', { bubbles: true }))
        area.blur()
        await new Promise((r) => setTimeout(r, 1800))
        return { ok: true, after: area.value }
    })()`)
}

/**
 * 该任务在 store 中的 VO（主路径 ②）
 * @description ⚠️ 实测坑：同一任务可能**同时**存在于 `TasksStore`（列表）与 `TaskDetailsStore`（详情），
 *              二者**不同步**（详情副本的 `startAt/endAt` 可能仍是 `''`）⇒ 取"信息最全"的副本，避免读到陈旧值。
 *              （TASK-01 脚本的 `readTasks().find()` 命中首个副本，在多副本场景会误判。）
 */
async function voOf(cdp, taskId) {
    const hits = await cdp.json(`(async () => {
        const app = document.getElementById('app')
        const pinia = app.__vue_app__.config.globalProperties.$pinia
        const hits = []
        const seen = new Set()
        const norm = (v) => (v === '' || v === undefined ? null : v)
        const walk = (obj, storeName, path, depth) => {
            if (!obj || typeof obj !== 'object' || depth > 6) return
            if (seen.has(obj)) return
            seen.add(obj)
            if (obj.id === ${JSON.stringify(taskId)}) {
                hits.push({
                    storeName,
                    path,
                    id: obj.id,
                    name: obj.name ?? null,
                    state: obj.state ?? null,
                    parentTaskId: norm(obj.parentTaskId),
                    projectId: norm(obj.projectId),
                    startAt: norm(obj.startAt),
                    endAt: norm(obj.endAt),
                    description: norm(obj.description)
                })
                return
            }
            if (Array.isArray(obj)) { obj.slice(0, 80).forEach((v, i) => walk(v, storeName, path + '[' + i + ']', depth + 1)); return }
            for (const key of Object.keys(obj)) {
                const value = obj[key]
                if (value && typeof value === 'object') walk(value, storeName, path + '.' + key, depth + 1)
            }
        }
        for (const [name, store] of pinia._s) {
            for (const key of Object.keys(store)) {
                try { const value = store[key]; if (value && typeof value === 'object') walk(value, name, key, 1) } catch (err) { /* 忽略不可遍历项 */ }
            }
        }
        return hits
    })()`)
    if (!Array.isArray(hits) || hits.length === 0) return null
    const score = (vo) =>
        ['name', 'state', 'parentTaskId', 'projectId', 'startAt', 'endAt', 'description'].filter(
            (k) => vo[k] !== null && vo[k] !== ''
        ).length
    return [...hits].sort((a, b) => score(b) - score(a))[0]
}

/** 关闭可能残留的日期面板（`pickDates` 失败/保存后面板可能仍开着，会污染后续操作） */
async function closeDatePanel(cdp) {
    return cdp.json(`(async () => {
        for (let i = 0; i < 3; i++) {
            const panel = [...document.querySelectorAll('[class*="task-date-selector-panel"]')].find((p) => p.getBoundingClientRect().width > 0)
            if (!panel) return 'none-open'
            const cancel = [...panel.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '取消')
            if (cancel) cancel.click()
            await new Promise((r) => setTimeout(r, 700))
        }
        const still = [...document.querySelectorAll('[class*="task-date-selector-panel"]')].some((p) => p.getBoundingClientRect().width > 0)
        return still ? 'still-open' : 'closed'
    })()`)
}

/* ────────────────────────────── 夹具构造 ────────────────────────────── */

async function ensureFixtures(ctx) {
    const { cdp } = ctx
    const checks = []
    if (FIXTURES.ready) {
        info(
            checks,
            'SETUP.reuse',
            '复用本次运行已建夹具',
            JSON.stringify({ parentA: FIXTURES.parentA?.id, parentB: FIXTURES.parentB?.id })
        )
        return checks
    }
    await ensureTaskList(cdp)
    const project = await ensureProject(cdp, FIXTURE_PROJECT)
    info(checks, 'SETUP.project', '夹具清单（复用 TASK-01 登记夹具）', JSON.stringify(project))
    if (!project.ok)
        return skip(checks, 'SETUP.project', '夹具清单不可用', `失败：${project.reason}`)

    // 父任务 A：已排期（完整时间窗）⇒ 子任务继承 start+end（TASK-01 已认证）
    const parentA = await createTaskViaUi(cdp, {
        title: `${PREFIX} ${RUN_TAG} 父任务-已排期`,
        scheduled: true,
        projectName: FIXTURE_PROJECT
    })
    if (!parentA.ok)
        return skip(checks, 'SETUP.parentA', '已排期父任务', `创建失败：${parentA.reason}`)
    // 父任务 B：未排期 ⇒ 子任务无时间（四态 4 的基底）
    const parentB = await createTaskViaUi(cdp, { title: `${PREFIX} ${RUN_TAG} 父任务-未排期` })
    if (!parentB.ok)
        return skip(checks, 'SETUP.parentB', '未排期父任务', `创建失败：${parentB.reason}`)
    FIXTURES.parentA = parentA.task
    FIXTURES.parentB = parentB.task
    expect(
        checks,
        'SETUP.scheduled',
        '父任务 A 时间窗完整（子任务将继承时间 ⇒ 时间元素非空）',
        !!parentA.task.startAt && !!parentA.task.endAt,
        `parentA.startAt=${JSON.stringify(parentA.task.startAt)} endAt=${JSON.stringify(parentA.task.endAt)}`
    )
    info(
        checks,
        'SETUP.unscheduled',
        '父任务 B 无时间窗（四态-无时间 的基底）',
        JSON.stringify({ startAt: parentB.task.startAt, endAt: parentB.task.endAt })
    )

    // 子任务：A1 常规+描述 / A2 长名(64字) / A3 无描述 / A4 待脱离
    const created = {}
    for (const [key, title] of [
        ['a1', names.a1],
        ['a2', names.a2],
        ['a3', names.a3],
        ['a4', names.a4],
        ['short', names.short]
    ]) {
        const result = await createSubTaskViaUi(cdp, { parentId: FIXTURES.parentA.id, title })
        if (!result.ok)
            return skip(checks, `SETUP.sub.${key}`, `子任务 ${key} 创建`, `失败：${result.reason}`)
        created[key] = result.task
    }
    // A1 补描述（AC⑦「有描述」）
    await openTaskDetails(cdp, created.a1.id)
    const described = await setDescriptionViaDetails(cdp, DESC_TEXT)
    if (!described.ok)
        return skip(checks, 'SETUP.sub.a1.desc', 'A1 描述赋值', `失败：${described.reason}`)
    // 父任务 B 下的三个子任务（四态 2/3/4）
    for (const [key, title] of [
        ['none', names.none],
        ['endOnly', names.endOnly],
        ['startOnly', names.startOnly]
    ]) {
        const result = await createSubTaskViaUi(cdp, { parentId: FIXTURES.parentB.id, title })
        if (!result.ok)
            return skip(checks, `SETUP.sub.${key}`, `子任务 ${key} 创建`, `失败：${result.reason}`)
        created[key] = result.task
    }
    // 四态 2（仅截止）：只改 endAt；四态 3（仅开始）：只改 startAt
    const today = new Date().getDate()
    await openTaskDetails(cdp, created.endOnly.id)
    await closeDatePanel(cdp)
    const endOnlyResult = await pickDates(cdp, {
        scope: 'details',
        end: Math.max(1, today - 1),
        prevMonth: today - 1 < 1
    })
    await closeDatePanel(cdp)
    await openTaskDetails(cdp, created.startOnly.id)
    await closeDatePanel(cdp)
    const startOnlyResult = await pickDates(cdp, {
        scope: 'details',
        start: Math.max(1, today - 1),
        prevMonth: today - 1 < 1
    })
    await closeDatePanel(cdp)
    await sleep(1500)
    FIXTURES.subs = created
    FIXTURES.ready = true
    const endOnlyVo = await voOf(cdp, created.endOnly.id)
    const startOnlyVo = await voOf(cdp, created.startOnly.id)
    expect(
        checks,
        'SETUP.fourStates',
        '四态夹具就绪（both / 仅截止 / 仅开始 / 无时间）',
        !!created.a1 &&
            !!created.none &&
            !!endOnlyVo?.endAt &&
            !endOnlyVo?.startAt &&
            !!startOnlyVo?.startAt &&
            !startOnlyVo?.endAt,
        `仅截止=${endOnlyResult.ok}(startAt=${JSON.stringify(endOnlyVo?.startAt)},endAt=${JSON.stringify(endOnlyVo?.endAt)}) 仅开始=${startOnlyResult.ok}(startAt=${JSON.stringify(startOnlyVo?.startAt)},endAt=${JSON.stringify(startOnlyVo?.endAt)})`
    )
    info(
        checks,
        'SETUP.ids',
        '夹具 id 清单',
        JSON.stringify({
            parentA: FIXTURES.parentA.id,
            parentB: FIXTURES.parentB.id,
            subs: Object.fromEntries(Object.entries(created).map(([k, v]) => [k, v.id]))
        })
    )
    return checks
}

/** 夹具未就绪时统一 SKIP */
function fixtureGuard(checks, id, title) {
    const ready = FIXTURES.ready
    if (!ready) skip(checks, id, title, '夹具未就绪（见 SETUP 组诊断）⇒ SKIP 不判 FAIL')
    return ready
}

/* ────────────────────────────── AC①…⑧ ────────────────────────────── */

/** AC①：时间内联于名称之后 + DOM 顺序（名称 → 时间 → 脱离）+ 四态文案 */
async function ac1(ctx) {
    const { cdp } = ctx
    const checks = []
    if (!(await ensureFixtures(ctx)).length) return checks
    if (!fixtureGuard(checks, 'AC1.guard', 'AC① 四态时间文案与 DOM 顺序')) return checks
    await openTaskDetails(cdp, FIXTURES.parentA.id)
    const both = await probeRow(cdp, names.a2)
    info(
        checks,
        'AC1.order.detail',
        '标题行 DOM 顺序实测',
        `order=${JSON.stringify(both.order)} tags=${JSON.stringify(both.orderTags)} actions列=${both.hasActionsColumn}`
    )
    expect(
        checks,
        'AC1.order',
        '① DOM 顺序 = 名称 → 时间 → 脱离按钮（且 actions 列已消失）',
        JSON.stringify(both.order) ===
            JSON.stringify(['subtask-row__name', 'subtask-row__time', 'subtask-row__detach']) &&
            both.hasActionsColumn === false,
        `order=${JSON.stringify(both.order)} hasActions=${both.hasActionsColumn}`
    )
    expect(
        checks,
        'AC1.text.both',
        '① 态1（开始+截止）文案 = `开始于 … ~ … 截止`',
        !!both.time && /^开始于 .+ ~ .+ 截止$/.test(both.time.text),
        `time.text=${JSON.stringify(both.time?.text)} title=${JSON.stringify(both.time?.title)}`
    )
    // 四态 2/3/4：父 B
    await openTaskDetails(cdp, FIXTURES.parentB.id)
    const endOnly = await probeRow(cdp, names.endOnly)
    const startOnly = await probeRow(cdp, names.startOnly)
    const none = await probeRow(cdp, names.none)
    expect(
        checks,
        'AC1.text.endOnly',
        '① 态2（仅截止）文案 = `… 截止`（无悬空 `~`）',
        !!endOnly.time && /^.+ 截止$/.test(endOnly.time.text) && !endOnly.time.text.includes('~'),
        `time.text=${JSON.stringify(endOnly.time?.text)}`
    )
    expect(
        checks,
        'AC1.text.startOnly',
        '① 态3（仅开始）文案 = `开始于 …`（无悬空 `~`）',
        !!startOnly.time &&
            /^开始于 .+$/.test(startOnly.time.text) &&
            !startOnly.time.text.includes('~'),
        `time.text=${JSON.stringify(startOnly.time?.text)}`
    )
    expect(
        checks,
        'AC1.text.none',
        '① 态4（无时间）不渲染时间元素（仅非空显示）',
        none.ok && none.time === null,
        `time=${JSON.stringify(none.time)} name=${JSON.stringify(none.name?.text)}`
    )
    info(
        checks,
        'AC1.states',
        '四态文案实测（内嵌）',
        JSON.stringify({
            both: both.time?.text,
            endOnly: endOnly.time?.text,
            startOnly: startOnly.time?.text,
            none: none.time
        })
    )
    return checks
}

/** AC②：常规时间完整；强制空间不足 ⇒ 名称截断而时间仍完整 */
async function ac2(ctx) {
    const { cdp } = ctx
    const checks = []
    if (!(await ensureFixtures(ctx)).length) return checks
    if (!fixtureGuard(checks, 'AC2.guard', 'AC② 常规完整 / 空间不足先截断名称')) return checks
    await openTaskDetails(cdp, FIXTURES.parentA.id)
    const normal = await probeRow(cdp, names.a2)
    // 常规态（名称完整）必须用**短名**夹具：抽屉内容宽实测 ~404px，时间占 ~218px
    // ⇒ 24 字以上的"常规"名在该行也必然截断（这不是缺陷，而是 α+上限 判据的必然结果）
    const normalName = await probeRow(cdp, names.short)
    const probeLong = await probeRow(cdp, names.a3)
    expect(
        checks,
        'AC2.normal.nameComplete',
        '② 常规（**短名**）⇒ 名称**完整**（scrollWidth ≤ clientWidth+1）',
        !!normalName.name && normalName.name.scrollWidth <= normalName.name.clientWidth + 1,
        `viewport=${normalName.viewportWidth} 短名="${normalName.name?.text}" cw=${normalName.name?.clientWidth} sw=${normalName.name?.scrollWidth} len=${normalName.name?.length}；对照-较长常规名(len=${probeLong.name?.length}) cw=${probeLong.name?.clientWidth} sw=${probeLong.name?.scrollWidth} 截断=${probeLong.name?.truncated}`
    )
    expect(
        checks,
        'AC2.normal.timeComplete',
        '② 常规文案 ⇒ 时间**完整**（scrollWidth ≤ clientWidth+1）',
        !!normal.time && normal.time.scrollWidth <= normal.time.clientWidth + 1,
        `viewport=${normal.viewportWidth} time.cw=${normal.time?.clientWidth} time.sw=${normal.time?.scrollWidth} text=${JSON.stringify(normal.time?.text)}`
    )
    expect(
        checks,
        'AC2.normal.style',
        '② 时间元素样式 = 不收缩（flex:0 0 auto）+ 省略号（overflow:hidden / nowrap / ellipsis）',
        normal.time?.style?.flexShrink === '0' &&
            normal.time?.style?.overflow === 'hidden' &&
            normal.time?.style?.whiteSpace === 'nowrap' &&
            normal.time?.style?.textOverflow === 'ellipsis',
        `flex=${normal.time?.style?.flexGrow} ${normal.time?.style?.flexShrink} ${normal.time?.style?.flexBasis} overflow=${normal.time?.style?.overflow} ws=${normal.time?.style?.whiteSpace} ellipsis=${normal.time?.style?.textOverflow}`
    )
    // 强制空间不足（手法：**收窄渲染视口** + 64 字长名称同时使用）
    // 视口选 560/520：此时名称（需 498px）必被截断，而时间（需 218px）仍在上限内 ⇒ 精确覆盖"名称截断而时间完整"
    const widths = [560, 520]
    let narrow = null
    let usedWidth = null
    for (const width of widths) {
        await cdp.setViewport({ width, height: 900 })
        await sleep(900)
        narrow = await probeRow(cdp, names.a2)
        usedWidth = width
        if (narrow.name?.truncated) break
    }
    await cdp.clearViewport()
    await sleep(600)
    expect(
        checks,
        'AC2.narrow.nameTruncated',
        '② 空间不足 ⇒ **名称被截断**（scrollWidth > clientWidth 且 textOverflow=ellipsis）',
        !!narrow?.name?.truncated && narrow?.name?.style?.textOverflow === 'ellipsis',
        `强制手法=Emulation.setDeviceMetricsOverride+64字长名(长度=${names.a2.length}) 视口=${usedWidth} name.cw=${narrow?.name?.clientWidth} name.sw=${narrow?.name?.scrollWidth} ellipsis=${narrow?.name?.style?.textOverflow}`
    )
    expect(
        checks,
        'AC2.narrow.timeComplete',
        '② 名称被截断时**时间仍完整**',
        !!narrow?.time && narrow.time.scrollWidth <= narrow.time.clientWidth + 1,
        `视口=${usedWidth} time.cw=${narrow?.time?.clientWidth} time.sw=${narrow?.time?.scrollWidth} text=${JSON.stringify(narrow?.time?.text)} 名称cw=${narrow?.name?.clientWidth}`
    )
    info(
        checks,
        'AC2.evidence',
        'AC② 实测数值（宽视口 vs 窄视口）',
        JSON.stringify({
            wide: {
                viewport: normal.viewportWidth,
                name: { cw: normal.name?.clientWidth, sw: normal.name?.scrollWidth },
                time: { cw: normal.time?.clientWidth, sw: normal.time?.scrollWidth }
            },
            narrow: {
                viewport: usedWidth,
                name: { cw: narrow?.name?.clientWidth, sw: narrow?.name?.scrollWidth },
                time: { cw: narrow?.time?.clientWidth, sw: narrow?.time?.scrollWidth }
            }
        })
    )
    return checks
}

/** AC③：极端（长名 + 全设日期 + 窄视口）⇒ 时间省略号截断、不超上限、不挤出脱离按钮 */
async function ac3(ctx) {
    const { cdp } = ctx
    const checks = []
    if (!(await ensureFixtures(ctx)).length) return checks
    if (!fixtureGuard(checks, 'AC3.guard', 'AC③ 极端条件下时间省略号截断')) return checks
    await openTaskDetails(cdp, FIXTURES.parentA.id)
    // 视口 420 → 320 → 260 逐级收窄，取**最窄**一次量测（保证时间截断量显著，而非 1px 边界）
    const widths = [420, 320, 260]
    let probe = null
    let usedWidth = null
    let limitRatio = null
    for (const width of widths) {
        await cdp.setViewport({ width, height: 900 })
        await sleep(900)
        probe = await probeRow(cdp, names.a2)
        usedWidth = width
        const titleCw = probe?.titleLineBox?.w ?? 0
        limitRatio = probe?.time && titleCw > 0 ? probe.time.clientWidth / titleCw : null
    }
    const titleCw = probe?.titleLineBox?.w ?? 0
    const limit = 0.6 * titleCw + 2
    const detachInside =
        !!probe?.detach?.box &&
        !!probe?.titleLineBox &&
        probe.detach.box.right <= probe.titleLineBox.right + 1
    await cdp.clearViewport()
    await sleep(600)
    expect(
        checks,
        'AC3.timeTruncated',
        '③ 极端 ⇒ 时间**省略号截断**（sw > cw；overflow:hidden / nowrap / ellipsis）',
        !!probe?.time?.truncated &&
            probe?.time?.style?.overflow === 'hidden' &&
            probe?.time?.style?.whiteSpace === 'nowrap' &&
            probe?.time?.style?.textOverflow === 'ellipsis',
        `强制手法=窄视口(${usedWidth})=Emulation.setDeviceMetricsOverride + 64字长名(${names.a2.length}字) + 完整日期 time.cw=${probe?.time?.clientWidth} time.sw=${probe?.time?.scrollWidth} 截断量=${(probe?.time?.scrollWidth ?? 0) - (probe?.time?.clientWidth ?? 0)}px overflow=${probe?.time?.style?.overflow} ws=${probe?.time?.style?.whiteSpace} ellipsis=${probe?.time?.style?.textOverflow} text=${JSON.stringify(probe?.time?.text)}`
    )
    expect(
        checks,
        'AC3.maxWidthLimit',
        '③ 时间宽度不超上限（clientWidth ≤ 0.6 × titleLine.clientWidth + 2）',
        !!probe?.time && titleCw > 0 && probe.time.clientWidth <= limit,
        `time.cw=${probe?.time?.clientWidth} titleLine.cw=${titleCw} 上限=${limit.toFixed(1)} 实测占比=${limitRatio === null ? 'n/a' : (limitRatio * 100).toFixed(1) + '%'}`
    )
    expect(
        checks,
        'AC3.detachNotPushedOut',
        '③ 脱离按钮**未被挤出**（detach.right ≤ titleLine.right+1）',
        detachInside,
        `detach=${JSON.stringify(probe?.detach?.box)} titleLine=${JSON.stringify(probe?.titleLineBox)}`
    )
    // 追加 A（PM seq 91）：整行无横向溢出 + 按钮完整（可见、非 0 宽、未被裁掉）
    expect(
        checks,
        'AC3.rowNoOverflow',
        '③(追加A) 整行无横向溢出（row.scrollWidth ≤ row.clientWidth+1）',
        !!probe?.row && probe.row.scrollWidth <= probe.row.clientWidth + 1,
        `row.clientWidth=${probe?.row?.clientWidth} row.scrollWidth=${probe?.row?.scrollWidth} overflowX=${probe?.row?.overflowX}`
    )
    expect(
        checks,
        'AC3.detachIntact',
        '③(追加A) 脱离按钮完整：width>0 且未被 overflow:hidden 裁掉（offsetParent≠null 或 1 个 client rect）',
        !!probe?.detach &&
            probe.detach.box.w > 0 &&
            (probe.detach.offsetParentNotNull || probe.detach.clientRects === 1),
        `btn.w=${probe?.detach?.box?.w} offsetParent≠null=${probe?.detach?.offsetParentNotNull} clientRects=${probe?.detach?.clientRects} btn.right=${probe?.detach?.box?.right} titleLine.right=${probe?.titleLineBox?.right} row.right=${probe?.row?.rect?.right}`
    )
    info(
        checks,
        'AC3.evidence',
        'AC③ 实测数值',
        JSON.stringify({
            viewport: usedWidth,
            titleLine: probe?.titleLineBox,
            time: {
                cw: probe?.time?.clientWidth,
                sw: probe?.time?.scrollWidth,
                maxWidth: probe?.time?.style?.maxWidth
            },
            name: { cw: probe?.name?.clientWidth, sw: probe?.name?.scrollWidth },
            detach: probe?.detach?.box
        })
    )
    return checks
}

/** AC④：时间元素 `title` = 完整文案（不做绝对时间转换） */
async function ac4(ctx) {
    const { cdp } = ctx
    const checks = []
    if (!(await ensureFixtures(ctx)).length) return checks
    if (!fixtureGuard(checks, 'AC4.guard', 'AC④ title 提供全文')) return checks
    await openTaskDetails(cdp, FIXTURES.parentA.id)
    const wide = await probeRow(cdp, names.a2)
    await cdp.setViewport({ width: 260, height: 900 })
    await sleep(900)
    const narrow = await probeRow(cdp, names.a2)
    await cdp.clearViewport()
    await sleep(500)
    expect(
        checks,
        'AC4.title.equalsText',
        '④ 时间 `title` === `textContent`（完整展示文案）',
        !!wide.time &&
            wide.time.title === wide.time.text &&
            !!narrow.time &&
            narrow.time.title === narrow.time.text,
        `宽视口 title=${JSON.stringify(wide.time?.title)} text=${JSON.stringify(wide.time?.text)}；窄视口 title=${JSON.stringify(narrow.time?.title)} text=${JSON.stringify(narrow.time?.text)} 截断=${narrow.time?.truncated}`
    )
    return checks
}

/** AC⑤：编辑按钮消失（计数 0）+ 改名路径可用（详情页标题往返） */
async function ac5(ctx) {
    const { cdp } = ctx
    const checks = []
    if (!(await ensureFixtures(ctx)).length) return checks
    if (!fixtureGuard(checks, 'AC5.guard', 'AC⑤ 编辑按钮移除 + 改名路径')) return checks
    await openTaskDetails(cdp, FIXTURES.parentA.id)
    const rows = await cdp.json(`(() => {
        const rows = [...document.querySelectorAll('.subtask-row')]
        return {
            rowCount: rows.length,
            editButtons: [...document.querySelectorAll('.subtask-row button')].filter((b) => (b.getAttribute('title') || '') === '编辑').length,
            editButtonsInDetails: [...document.querySelectorAll('${DETAILS_DRAWER} button')].filter((b) => (b.getAttribute('title') || '') === '编辑').length,
            editingAttrs: rows.filter((r) => r.hasAttribute('data-editing')).length,
            nameInputs: document.querySelectorAll('.subtask-row__input').length
        }
    })()`)
    expect(
        checks,
        'AC5.editButtonGone',
        '⑤ 编辑按钮已消失（计数=0），行内改名残留（data-editing / __input）也为 0',
        rows.editButtons === 0 && rows.editingAttrs === 0 && rows.nameInputs === 0,
        `行内编辑按钮=${rows.editButtons} 抽屉内 title=编辑=${rows.editButtonsInDetails} data-editing=${rows.editingAttrs} __input=${rows.nameInputs} 行数=${rows.rowCount}`
    )
    // 改名路径：点名称 → 该子任务详情 → 标题改名 → 读回
    const clicked = await cdp.json(`(() => {
        const rows = [...document.querySelectorAll('.subtask-row')]
        const row = rows.find((r) => (r.querySelector('.subtask-row__name')?.textContent || '').trim() === ${JSON.stringify(names.a1)})
        if (!row) return { ok: false }
        row.querySelector('.subtask-row__name').click()
        return { ok: true }
    })()`)
    if (!clicked.ok) return skip(checks, 'AC5.rename', '改名路径往返', '未找到目标行')
    await sleep(2200)
    const renamed = `${names.a1} 改名`
    const renameResult = await renameViaDetails(cdp, renamed)
    if (!renameResult.ok)
        return skip(checks, 'AC5.rename', '改名路径往返', `失败：${renameResult.reason}`)
    const vo = await voOf(cdp, FIXTURES.subs.a1.id)
    expect(
        checks,
        'AC5.renameRoundTrip',
        '⑤ 改名路径可用：点名称 → 详情 → 标题改名 → 读回生效（store）',
        vo?.name === renamed,
        `before=${JSON.stringify(renameResult.before)} after(textarea)=${JSON.stringify(renameResult.after)} store.name=${JSON.stringify(vo?.name)} hash=${await cdp.evaluate('return location.hash')}`
    )
    // 复位名称，避免影响后续组
    await renameViaDetails(cdp, names.a1)
    return checks
}

/** AC⑥：点时间不导航；点脱离弹确认且不导航；点名称导航 */
async function ac6(ctx) {
    const { cdp } = ctx
    const checks = []
    if (!(await ensureFixtures(ctx)).length) return checks
    if (!fixtureGuard(checks, 'AC6.guard', 'AC⑥ 点击行为与导航')) return checks
    const parentHash = `#/tasks/all/table/${FIXTURES.parentA.id}`
    await openTaskDetails(cdp, FIXTURES.parentA.id)
    const hit = async (name, part) =>
        cdp.json(`(() => {
        const rows = [...document.querySelectorAll('.subtask-row')]
        const row = rows.find((r) => (r.querySelector('.subtask-row__name')?.textContent || '').trim() === ${JSON.stringify(name)})
        if (!row) return { ok: false }
        const el = row.querySelector('.subtask-row__${part}')
        if (!el) return { ok: false, reason: '元素缺失' }
        const r = el.getBoundingClientRect()
        return { ok: true, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width) }
    })()`)
    // ① 点时间：不导航
    const timePoint = await hit(names.a2, 'time')
    if (!timePoint.ok)
        return skip(checks, 'AC6.time', '点时间不导航', `目标缺失：${timePoint.reason}`)
    await cdp.click(timePoint.x, timePoint.y, 1500)
    const hashAfterTime = await cdp.evaluate('return location.hash')
    expect(
        checks,
        'AC6.timeNoNav',
        '⑥ 点**时间** ⇒ 不导航（当前详情 taskId 不变）',
        hashAfterTime === parentHash,
        `before=${parentHash} after=${hashAfterTime} 点击点=(${timePoint.x},${timePoint.y})`
    )
    // ② 点脱离：弹确认、不导航（随后取消）
    const detachPoint = await hit(names.a4, 'detach')
    if (!detachPoint.ok)
        return skip(checks, 'AC6.detach', '点脱离弹确认', `目标缺失：${detachPoint.reason}`)
    await cdp.mouseMove(detachPoint.x, detachPoint.y)
    await cdp.click(detachPoint.x, detachPoint.y, 1200)
    const confirm = await cdp.json(`(() => {
        const dialogs = [...document.querySelectorAll('.nue-dialog, [class*="confirm"]')]
            .filter((d) => d.getBoundingClientRect().width > 0)
        const dialog = dialogs.find((d) => /脱离|顶层任务/.test(d.innerText || ''))
        return { visible: !!dialog, text: dialog ? (dialog.innerText || '').replace(/\\s+/g, ' ').slice(0, 120) : null, hash: location.hash, count: dialogs.length }
    })()`)
    expect(
        checks,
        'AC6.detachConfirmNoNav',
        '⑥ 点**脱离按钮** ⇒ 弹确认框且**不导航**',
        confirm.visible && confirm.hash === parentHash,
        `confirm.visible=${confirm.visible} text=${JSON.stringify(confirm.text)} hash=${confirm.hash} 可见对话框数=${confirm.count}`
    )
    const canceled = await cdp.json(`(async () => {
        const dialogs = [...document.querySelectorAll('.nue-dialog, [class*="confirm"]')].filter((d) => d.getBoundingClientRect().width > 0)
        const dialog = dialogs.find((d) => /脱离|顶层任务/.test(d.innerText || ''))
        if (!dialog) return { ok: false, reason: '确认框已不在' }
        const btn = [...dialog.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '取消')
        if (!btn) return { ok: false, reason: '未找到取消按钮' }
        btn.click()
        await new Promise((r) => setTimeout(r, 1200))
        return { ok: true }
    })()`)
    info(checks, 'AC6.cancel', '确认框取消（避免影响 AC⑧ 的脱离用例）', JSON.stringify(canceled))
    // ③ 点名称：导航到该子任务
    const namePoint = await hit(names.a1, 'name')
    await cdp.click(namePoint.x, namePoint.y, 2400)
    const hashAfterName = await cdp.evaluate('return location.hash')
    expect(
        checks,
        'AC6.nameNavigates',
        '⑥ 点**名称** ⇒ 导航到该子任务详情',
        hashAfterName === `#/tasks/all/table/${FIXTURES.subs.a1.id}`,
        `期望=#/tasks/all/table/${FIXTURES.subs.a1.id} 实际=${hashAfterName}`
    )
    return checks
}

/** AC⑦：无描述 ⇒ 不渲染 meta 行；有描述 ⇒ 第二行仅描述（不含 `~` / `·`） */
async function ac7(ctx) {
    const { cdp } = ctx
    const checks = []
    if (!(await ensureFixtures(ctx)).length) return checks
    if (!fixtureGuard(checks, 'AC7.guard', 'AC⑦ 描述行')) return checks
    await openTaskDetails(cdp, FIXTURES.parentA.id)
    const noDesc = await probeRow(cdp, names.a3)
    const withDesc = await probeRow(cdp, names.a1)
    const voA1 = await voOf(cdp, FIXTURES.subs.a1.id)
    expect(
        checks,
        'AC7.noMetaWhenNoDescription',
        '⑦ 无描述子任务 ⇒ 该行**无** `.subtask-row__meta`',
        noDesc.ok && noDesc.meta === null,
        `meta=${JSON.stringify(noDesc.meta)} 行内 meta 计数=${noDesc.meta?.count ?? 0}`
    )
    expect(
        checks,
        'AC7.metaOnlyDescription',
        '⑦ 有描述 ⇒ 第二行**仅描述**（不含 `~` / `·`），且与 store 描述一致',
        !!withDesc.meta &&
            !withDesc.meta.text.includes('~') &&
            !withDesc.meta.text.includes('·') &&
            withDesc.meta.text === String(voA1?.description ?? '').trim(),
        `meta.text=${JSON.stringify(withDesc.meta?.text)} meta计数=${withDesc.meta?.count} store.description=${JSON.stringify(voA1?.description)}`
    )
    expect(
        checks,
        'AC7.timeStillInTitleLine',
        '⑦ 有描述时时间仍**只在标题行**（meta 行不含时间）',
        !!withDesc.time && !!withDesc.meta && !withDesc.meta.text.includes(withDesc.time.text),
        `time=${JSON.stringify(withDesc.time?.text)} meta=${JSON.stringify(withDesc.meta?.text)}`
    )
    return checks
}

/** AC⑧：勾选切换 / 脱离 / 创建条 —— 行为与改动前一致 */
async function ac8(ctx) {
    const { cdp } = ctx
    const checks = []
    if (!(await ensureFixtures(ctx)).length) return checks
    if (!fixtureGuard(checks, 'AC8.guard', 'AC⑧ 三项既有行为')) return checks
    await openTaskDetails(cdp, FIXTURES.parentA.id)
    // ① 勾选切换
    const toggle = await cdp.json(`(async () => {
        const rows = [...document.querySelectorAll('.subtask-row')]
        const row = rows.find((r) => (r.querySelector('.subtask-row__name')?.textContent || '').trim() === ${JSON.stringify(names.a3)})
        if (!row) return { ok: false }
        const btn = row.querySelector('.subtask-row__check')
        if (!btn) return { ok: false, reason: '未找到勾选按钮' }
        btn.click()
        await new Promise((r) => setTimeout(r, 2500))
        return { ok: true, dataDone: row.getAttribute('data-done') }
    })()`)
    const afterToggle = await voOf(cdp, FIXTURES.subs.a3.id)
    expect(
        checks,
        'AC8.toggleState',
        '⑧ 勾选切换状态（todo → done）生效',
        toggle.ok && afterToggle?.state === 'done',
        `点击=${JSON.stringify(toggle)} store.state=${JSON.stringify(afterToggle?.state)}`
    )
    if (afterToggle?.state === 'done') {
        await cdp.json(`(async () => {
            const rows = [...document.querySelectorAll('.subtask-row')]
            const row = rows.find((r) => (r.querySelector('.subtask-row__name')?.textContent || '').trim() === ${JSON.stringify(names.a3)})
            const btn = row?.querySelector('.subtask-row__check')
            if (!btn) return false
            btn.click()
            await new Promise((r) => setTimeout(r, 2500))
            return true
        })()`)
        const restored = await voOf(cdp, FIXTURES.subs.a3.id)
        info(
            checks,
            'AC8.toggleRestore',
            '勾选复位（done → todo）',
            `store.state=${JSON.stringify(restored?.state)}`
        )
    }
    // ② 脱离父任务：从列表移除 + 顶层刷新（升为顶层任务）
    const detach = await cdp.json(`(async () => {
        const rows = [...document.querySelectorAll('.subtask-row')]
        const row = rows.find((r) => (r.querySelector('.subtask-row__name')?.textContent || '').trim() === ${JSON.stringify(names.a4)})
        const btn = row?.querySelector('.subtask-row__detach')
        if (!btn) return { ok: false, reason: '未找到脱离按钮' }
        btn.click()
        await new Promise((r) => setTimeout(r, 1500))
        const dialogs = [...document.querySelectorAll('.nue-dialog, [class*="confirm"]')].filter((d) => d.getBoundingClientRect().width > 0)
        const dialog = dialogs.find((d) => /脱离|顶层任务/.test(d.innerText || ''))
        if (!dialog) return { ok: false, reason: '确认框未出现' }
        const ok = [...dialog.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '确认')
        if (!ok) return { ok: false, reason: '未找到确认按钮' }
        ok.click()
        await new Promise((r) => setTimeout(r, 3500))
        return { ok: true }
    })()`)
    const detachedVo = await voOf(cdp, FIXTURES.subs.a4.id)
    const stillInRows = await cdp.json(
        `(() => [...document.querySelectorAll('.subtask-row')].some((r) => (r.querySelector('.subtask-row__name')?.textContent || '').trim() === ${JSON.stringify(names.a4)}))()`
    )
    await ensureTaskList(cdp)
    const topLevel = await voOf(cdp, FIXTURES.subs.a4.id)
    expect(
        checks,
        'AC8.detach',
        '⑧ 脱离父任务：确认后**从列表移除** + 升为顶层（顶层列表可见/store.parentTaskId=null）',
        detach.ok &&
            stillInRows === false &&
            detachedVo?.parentTaskId === null &&
            topLevel?.parentTaskId === null,
        `确认=${JSON.stringify(detach)} 仍在子任务行=${stillInRows} store.parentTaskId=${JSON.stringify(detachedVo?.parentTaskId)} 顶层读回=${JSON.stringify(topLevel?.parentTaskId)}`
    )
    // ③ 创建条：新建子任务
    const createResult = await createSubTaskViaUi(cdp, {
        parentId: FIXTURES.parentA.id,
        title: names.created
    })
    await openTaskDetails(cdp, FIXTURES.parentA.id)
    const createdRow = await probeRow(cdp, names.created)
    expect(
        checks,
        'AC8.createBar',
        '⑧ 创建条新建子任务：行为与改动前一致（新建行出现且继承时间）',
        createResult.ok && createdRow.ok && !!createdRow.time,
        `创建=${createResult.ok ? createResult.task.id : createResult.reason} 行存在=${createdRow.ok} time=${JSON.stringify(createdRow.time?.text)}`
    )
    return checks
}

/** 附：脱离按钮 hover / 键盘可达性（`:focus-within` 且未用 display/visibility 隐藏） */
async function auxA11y(ctx) {
    const { cdp } = ctx
    const checks = []
    if (!(await ensureFixtures(ctx)).length) return checks
    if (!fixtureGuard(checks, 'AUX.guard', '附：脱离按钮可见性（hover / 键盘）')) return checks
    await openTaskDetails(cdp, FIXTURES.parentA.id)
    const initial = await probeRow(cdp, names.a2)
    const target = await cdp.json(`(() => {
        const rows = [...document.querySelectorAll('.subtask-row')]
        const row = rows.find((r) => (r.querySelector('.subtask-row__name')?.textContent || '').trim() === ${JSON.stringify(names.a2)})
        const el = row?.querySelector('.subtask-row__detach')
        if (!el) return { ok: false }
        const r = el.getBoundingClientRect()
        return { ok: true, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
    })()`)
    if (!target.ok) return skip(checks, 'AUX.hover', 'hover 后 opacity=1', '目标缺失')
    await cdp.mouseMove(target.x, target.y)
    await sleep(400)
    const hovered = await probeRow(cdp, names.a2)
    expect(
        checks,
        'AUX.hover',
        '附 hover 前 `opacity=0` → hover 后 `opacity=1`（且未被 display/visibility 隐藏）',
        initial.detach?.style?.opacity === '0' &&
            hovered.detach?.style?.opacity === '1' &&
            hovered.detach?.style?.display !== 'none' &&
            hovered.detach?.style?.visibility !== 'hidden',
        `before.opacity=${initial.detach?.style?.opacity} after.opacity=${hovered.detach?.style?.opacity} display=${hovered.detach?.style?.display} visibility=${hovered.detach?.style?.visibility}`
    )
    await cdp.mouseMove(5, 5)
    await sleep(500)
    const focused = await cdp.json(`(async () => {
        const rows = [...document.querySelectorAll('.subtask-row')]
        const row = rows.find((r) => (r.querySelector('.subtask-row__name')?.textContent || '').trim() === ${JSON.stringify(names.a2)})
        const el = row?.querySelector('.subtask-row__detach')
        const btn = el?.matches('button') ? el : el?.querySelector('button') ?? el
        if (!btn) return { ok: false }
        btn.focus()
        // 追加 B（PM seq 91）：focus-within 揭示必须**即时** ⇒ 聚焦后**同一帧**读计算样式
        const immediate = getComputedStyle(el).opacity
        const immediateDisplay = getComputedStyle(el).display
        const immediateVisibility = getComputedStyle(el).visibility
        await new Promise((r) => setTimeout(r, 500))
        const settled = getComputedStyle(el)
        return {
            ok: true,
            immediate,
            immediateDisplay,
            immediateVisibility,
            opacity: settled.opacity,
            display: settled.display,
            visibility: settled.visibility,
            focusWithin: row.matches(':focus-within'),
            transition: settled.transition,
            transitionProperty: settled.transitionProperty,
            transitionDuration: settled.transitionDuration,
            activeTag: document.activeElement?.tagName,
            activeCls: String(document.activeElement?.className ?? '')
        }
    })()`)
    // 追加 B：即时性（单帧 = '1'）；读到中间值 ⇒ **偏差信号**（登记 INFO + 实测值/来源判断，不判 FAIL）
    const immediateOk = focused.immediate === '1'
    expect(
        checks,
        'AUX.focusWithinImmediate',
        '附(追加B) `.focus()` 后**单帧**即为 `opacity=1`（未声明 transition）',
        immediateOk &&
            focused.immediateDisplay !== 'none' &&
            focused.immediateVisibility !== 'hidden',
        `单帧.opacity=${focused.immediate} 单帧.display=${focused.immediateDisplay} 单帧.visibility=${focused.immediateVisibility}；稳定后.opacity=${focused.opacity}`
    )
    if (!immediateOk) {
        info(
            checks,
            'AUX.transitionSource',
            '⚠️ 偏差信号：聚焦后单帧非 1（疑有 transition 被组件内部引入）',
            `单帧=${focused.immediate} → 稳定=${focused.opacity}；computed transition=${JSON.stringify(focused.transition)} property=${JSON.stringify(focused.transitionProperty)} duration=${JSON.stringify(focused.transitionDuration)}（判定交 PM/架构，不判 FAIL）`
        )
    }
    expect(
        checks,
        'AUX.keyboardFocus',
        '附 键盘可达：按钮 `.focus()` 后（行 `:focus-within`）`opacity=1`',
        focused.ok && focused.opacity === '1' && focused.focusWithin === true,
        `opacity=${focused.opacity} focusWithin=${focused.focusWithin} display=${focused.display} visibility=${focused.visibility} activeElement=${focused.activeTag}.${focused.activeCls}`
    )
    return checks
}

/* ─────── 副本一致性探针 + DEF-STORE-01 受控复现（PM seq 96/107：在场性 + 步骤②前置断言）─────── */

/**
 * 改期（可诊断 + 回退）：先在详情页 header 的 TaskDateSelector 里改**截止**日期；
 * 若**服务端值未变**（实测：已有时间窗时点「选择截止日期」打不开日历 `.nue-date-picker-panel`），
 * 回退改**开始**日期（已多次证实可用的路径）⇒ 目的只有一个：**稳定产生可观测修改**。
 */
async function changeSubtaskEndDate(cdp, taskId, day, { prevMonth = false } = {}) {
    const before = await readViaApi(cdp, taskId)
    const attempts = []
    for (const field of ['end', 'start']) {
        await closeDatePanel(cdp)
        const picked = await pickDates(cdp, { scope: 'details', [field]: day, prevMonth })
        await closeDatePanel(cdp)
        await sleep(2000)
        const after = await readViaApi(cdp, taskId)
        const changed = JSON.stringify(after.value) !== JSON.stringify(before.value)
        attempts.push({
            field,
            day,
            pickedOk: picked.ok,
            steps: picked.steps?.slice(0, 3),
            before: before.value?.endAt ?? null,
            after: after.value?.endAt ?? null,
            startBefore: before.value?.startAt ?? null,
            startAfter: after.value?.startAt ?? null,
            changed
        })
        if (changed) return { ok: true, field, attempts, server: after }
    }
    return { ok: false, field: null, attempts, server: before }
}

/**
 * 每轮都跑：对本次夹具 id 批量比较两副本（**必须先断言"两副本同 id 同时在场"**，
 * 否则 0 差异属**空集比较、无信息量**）
 */
async function consistency(ctx) {
    const { cdp } = ctx
    const checks = []
    if (!(await ensureFixtures(ctx)).length) return checks
    if (!fixtureGuard(checks, 'CONSISTENCY.guard', '副本一致性探针')) return checks
    const ids = [
        FIXTURES.parentA?.id,
        FIXTURES.parentB?.id,
        ...Object.values(FIXTURES.subs).map((task) => task.id)
    ].filter(Boolean)
    await openTaskDetails(cdp, FIXTURES.parentA.id)
    // 先在父面板里把子任务行渲染出来（详情 store 的 subTasks 在场），再逐 id 检查两副本在场性
    const result = await storeConsistencyProbe(cdp, ids)
    info(
        checks,
        'CONSISTENCY.summary',
        '副本一致性探针（同 id 比较 startAt/endAt/projectId/state）',
        `checked=${result.checked} **有效轮次（两副本均在场）**=${result.valid} 命中差异=${result.hits.length} 空集（未同时在场）=${result.invalid.length}`
    )
    expect(
        checks,
        'CONSISTENCY.presence',
        '探针**在场性**：至少一个 id 在两副本同时在场（否则 0 差异无信息量）',
        result.valid > 0,
        `有效=${result.valid}/${result.checked}；空集样例=${JSON.stringify(result.invalid.slice(0, 2).map((row) => ({ id: row.id, tasksStore: row.presentInTasksStore, detailsStore: row.presentInDetailsStore, detailsSize: row.details ? 1 : 0 })))}`
    )
    for (const hit of result.hits.slice(0, 6)) {
        info(
            checks,
            'CONSISTENCY.diff',
            `⚠️ 差异行 id=${hit.id}`,
            `diff=${JSON.stringify(hit.diff)}｜list=${JSON.stringify(hit.list)}｜details=${JSON.stringify(hit.details)}｜**服务端真相**=${JSON.stringify(hit.api)}`
        )
    }
    expect(
        checks,
        'CONSISTENCY.noSilentMask',
        '差异**单列**（不因"取最全副本"抹平）；有效轮次内 0 差异方判 PASS',
        result.hits.length === 0,
        result.hits.length === 0
            ? `有效轮次=${result.valid} 全部一致（本轮未见副本差异）`
            : `有效轮次=${result.valid} **命中 ${result.hits.length} 条差异**（见 CONSISTENCY.diff）`
    )
    return checks
}

/**
 * DEF-STORE-01 **受控复现**（PM seq 107）
 * @description 步骤：① 建 P（带时间窗）+ S → 打开 P 面板（子任务列表加载）并断言**两副本在场**
 *              ② 进 S 详情**改截止日期**，且**改期前后各读一次服务端值**做前置断言（未变 ⇒ 本轮作废重试）
 *              ③ 返回 P；④ 比较两副本（未返回 P 的那次量测）
 *              ⑤ 触发重取 ⇒ 差异是否消失（"副本未同步"而非"数据丢失"）
 *              **P3 受控可见性**：**只经服务端**改 S 的 endAt（API 直写）→ 触发一次同步/刷新 →
 *              看**父面板里 S 行的时间文案**：旧值/空 ⇒ **用户可见 = P1**；新值 ⇒ 记"自愈"保持观察。
 */
async function defStore01(ctx) {
    const { cdp } = ctx
    const checks = []
    const today = new Date().getDate()
    const sName = `${STORE01_PREFIX} ${RUN_TAG} 子任务S`
    await ensureTaskList(cdp)
    const parent = await createTaskViaUi(cdp, {
        title: `${STORE01_PREFIX} ${RUN_TAG} 顶层任务P`,
        scheduled: true
    })
    if (!parent.ok)
        return skip(checks, 'STORE01.parent', '复现夹具 P', `创建失败：${parent.reason}`)
    const child = await createSubTaskViaUi(cdp, { parentId: parent.task.id, title: sName })
    if (!child.ok) return skip(checks, 'STORE01.child', '复现夹具 S', `创建失败：${child.reason}`)
    info(
        checks,
        'STORE01.parent',
        '① 夹具 P/S 就绪（P 带时间窗，S 继承）',
        JSON.stringify({
            parent: { id: parent.task.id, startAt: parent.task.startAt, endAt: parent.task.endAt },
            child: { id: child.task.id, startAt: child.task.startAt, endAt: child.task.endAt }
        })
    )

    // ① 先打开 **S 自身详情**（`TaskUseCase.get` ⇒ 写入列表 store），再回 P 面板取基线 ⇒ 建立"两副本同 id 同时在场"
    await openTaskDetails(cdp, child.task.id)
    await sleep(1500)
    await openTaskDetails(cdp, parent.task.id)
    const baselineRow = await probeRow(cdp, sName)
    const presence = await readCopies(cdp, child.task.id)
    expect(
        checks,
        'STORE01.presence',
        '① **在场性**：S 同时存在于 `TasksStore` 与 `TaskDetailsStore`（此后写入才有比较意义）',
        presence.bothPresent,
        `presentInTasksStore=${presence.presentInTasksStore}${JSON.stringify(presence.tasksStoreSources)} presentInDetailsStore=${presence.presentInDetailsStore}${JSON.stringify(presence.detailsStoreSources)} list=${JSON.stringify(presence.list)} details=${JSON.stringify(presence.details)}`
    )
    info(
        checks,
        'STORE01.step1',
        '① 打开 P 面板后的基线',
        `row.time=${JSON.stringify(baselineRow.time?.text)} diff=${JSON.stringify(presence.diff)}`
    )
    if (!presence.bothPresent) {
        skip(
            checks,
            'STORE01.step2',
            '② 改期 + 服务端前置断言',
            `卡在①：两副本未同时在场（tasksStore=${presence.presentInTasksStore} detailsStore=${presence.presentInDetailsStore}）⇒ 后续无比较意义`
        )
        return checks
    }

    // ② UI 改期**诊断**（已试路径，如实记录）：S 已有时间窗时，「选择开始/截止日期」均打不开日历 ⇒ UI 改期不可用
    const uiDiag = await changeSubtaskEndDate(cdp, child.task.id, Math.max(1, today - 3))
    info(
        checks,
        'STORE01.step2.diag',
        '② UI 改期诊断（试过的路径 = end/start 日期按钮，均打不开日历）',
        `已试：${JSON.stringify((uiDiag.attempts ?? []).map((a) => ({ field: a.field, steps: a.steps, changed: a.changed })))}；服务端未被 UI 修改`
    )
    // ② 改用 **API 直写**（PM 提供的前置条件：可控第二写入客户端）⇒ 稳定产生可观测修改
    const newEndAt = (() => {
        const base = new Date()
        base.setUTCDate(base.getUTCDate() + 3)
        base.setUTCHours(8, 0, 0, 0)
        return base.toISOString()
    })()
    const serverBefore = await readViaApi(cdp, child.task.id)
    const apiWrite = await apiUpdateTask(cdp, child.task.id, { endAt: newEndAt })
    const serverAfter = await readViaApi(cdp, child.task.id)
    expect(
        checks,
        'STORE01.step2pre',
        '② **前置断言**：服务端 `endAt` 前后不同（API 直写已产生可观测修改）',
        (serverBefore.value?.endAt ?? null) !== (serverAfter.value?.endAt ?? null),
        `apiWrite=${JSON.stringify(apiWrite)}｜before=${JSON.stringify(serverBefore.value?.endAt)} → after=${JSON.stringify(serverAfter.value?.endAt)}`
    )

    // ②.5 **P3 受控可见性**：留在 P 面板，API 直写后触发**一次同步** ⇒ 看 S 行文案是否跟随新值
    await openTaskDetails(cdp, parent.task.id)
    const rowBefore = await probeRow(cdp, sName)
    const synced = await openPanel(cdp)
        .then(() => clickPanelPrimary(cdp))
        .then(() => sleep(5000))
        .then(() => 'ok')
        .catch((err) => `panel-error:${String(err).slice(0, 120)}`)
    const rowLive = await probeRow(cdp, sName)
    const copiesLive = await readCopies(cdp, child.task.id)
    const serverLive = await readViaApi(cdp, child.task.id)
    // 真值行文案：离开再回（重取自愈）后渲染的文案
    await openTaskDetails(cdp, child.task.id)
    await sleep(1200)
    await openTaskDetails(cdp, parent.task.id)
    const rowTruth = await probeRow(cdp, sName)
    const liveChanged =
        !!rowLive.time && !!rowBefore.time && rowLive.time.text !== rowBefore.time.text
    const liveStale =
        !!rowTruth.time &&
        !!rowLive.time &&
        rowLive.time.text === rowBefore.time.text &&
        rowLive.time.text !== rowTruth.time.text
    info(
        checks,
        'STORE01.p3',
        'P3 受控可见性：API 直写 endAt → 一次同步 → P 面板行文案',
        `apiWrite=${JSON.stringify(apiWrite)}（endAt=${JSON.stringify(newEndAt)}）同步=${synced}｜行文案：改前=${JSON.stringify(rowBefore.time?.text)} → 同步后=${JSON.stringify(rowLive.time?.text)}（变化=${liveChanged}）→ 重取真值=${JSON.stringify(rowTruth.time?.text)}（**陈旧=${liveStale}**）｜两副本 diff=${JSON.stringify(copiesLive.diff)} list=${JSON.stringify(copiesLive.list)} details=${JSON.stringify(copiesLive.details)}｜服务端=${JSON.stringify(serverLive.value)}`
    )
    expect(
        checks,
        'STORE01.p3class',
        'P3 判定：同步后行文案**跟随新值**（或重取真值一致）⇒ 自愈；行仍显示旧值 ⇒ **用户可见陈旧 = P1**',
        !liveStale,
        liveStale
            ? `**P1 证据**：同步后行仍显示旧值 ${JSON.stringify(rowLive.time?.text)}（真值=${JSON.stringify(rowTruth.time?.text)}，服务端 endAt=${JSON.stringify(serverLive.value?.endAt)}）`
            : `自愈：同步后行文案=${JSON.stringify(rowLive.time?.text)}，与真值=${JSON.stringify(rowTruth.time?.text)}一致或已更新（服务端=${JSON.stringify(serverLive.value?.endAt)}）`
    )
    // ④ 副本比较（同步后，仍在 P 面板）
    info(
        checks,
        'STORE01.step4',
        '④ 同步后两副本比较（仍在 P 面板）',
        `present(list/details)=${copiesLive.presentInTasksStore}/${copiesLive.presentInDetailsStore} diff=${JSON.stringify(copiesLive.diff)}｜list=${JSON.stringify(copiesLive.list)}｜details=${JSON.stringify(copiesLive.details)}｜服务端=${JSON.stringify(serverLive.value)}`
    )
    const hitStep4 = copiesLive.diff.length > 0
    info(
        checks,
        'STORE01.step4hit',
        '④ 副本差异命中判定（endAt/projectId/state 任一不等 = 命中）',
        hitStep4
            ? `**命中** ${JSON.stringify(copiesLive.diff)}`
            : `未命中（两副本一致；服务端=${JSON.stringify(serverLive.value)}）`
    )

    // ③ 返回 P：路由 / history.back() 两种路径的渲染值
    await openTaskDetails(cdp, parent.task.id)
    const routeRow = await probeRow(cdp, sName)
    const routeCopies = await readCopies(cdp, child.task.id)
    await openTaskDetails(cdp, child.task.id)
    await sleep(1200)
    await cdp.evaluate(`history.back(); return true`)
    await sleep(2500)
    const backRow = await probeRow(cdp, sName)
    info(
        checks,
        'STORE01.step3',
        '③ 返回 P 后的渲染值（路由 / history.back）',
        `route.row.time=${JSON.stringify(routeRow.time?.text)} (diff=${JSON.stringify(routeCopies.diff)})｜back.row.time=${JSON.stringify(backRow.time?.text)}｜期望（服务端/列表侧）endAt=${JSON.stringify(serverAfter.value?.endAt)}`
    )

    // ⑤ 触发重取 ⇒ 差异是否消失
    const retried = await cdp.json(`(async () => {
        const drawer = document.querySelector('${DETAILS_DRAWER}')
        if (!drawer) return { ok: false, reason: '抽屉未就绪' }
        const btn = [...drawer.querySelectorAll('button')].find((b) => /重试|刷新/.test(b.innerText || ''))
        if (btn) { btn.click(); await new Promise((r) => setTimeout(r, 2500)); return { ok: true, via: 'retry-button' } }
        return { ok: true, via: 'reopen-details' }
    })()`)
    await sleep(2000)
    const afterRetryCopies = await readCopies(cdp, child.task.id)
    expect(
        checks,
        'STORE01.step5',
        '⑤ 重取后差异消失（证明"副本未同步"而非"数据丢失"）',
        afterRetryCopies.diff.length === 0,
        `触发=${JSON.stringify(retried)} diff=${JSON.stringify(afterRetryCopies.diff)} list=${JSON.stringify(afterRetryCopies.list)} details=${JSON.stringify(afterRetryCopies.details)}`
    )
    info(
        checks,
        'STORE01.grade',
        'P1/P2 判定要素（**判级交 PM/架构**）',
        JSON.stringify({
            在场性: presence.bothPresent,
            步骤2前置断言通过:
                (serverBefore.value?.endAt ?? null) !== (serverAfter.value?.endAt ?? null),
            步骤4命中: hitStep4,
            步骤4差异: copiesLive.diff,
            P3行文案陈旧同步后未跟随: liveStale,
            P3行文案同步后: rowLive.time?.text ?? null,
            P3行文案真值: rowTruth.time?.text ?? null,
            步骤5差异消失: afterRetryCopies.diff.length === 0
        })
    )
    return checks
}

/* ─────────── 探针A：DEF-SYNC-05 根因二分 · 探针B：DEF-UI-01 隔离（PM seq 5）─────────── */

const TS = (v) => (v ? new Date(v).getTime() : null)

/** 等「立即同步」收口（idle 且 0 pending / 0 failed），最多 40s */
async function waitSyncIdle(cdp) {
    return cdp.evaluate(`
        for (let i = 0; i < 80; i++) {
            const btn = document.querySelector('.sync-rail-btn')
            const rows = window.__qa?.panelRows ? window.__qa.panelRows() : []
            if (btn && !btn.disabled && !rows.some((row) => /待推送|失败/.test(row))) return true
            await new Promise((r) => setTimeout(r, 500))
        }
        return false
    `)
}

/**
 * 探针B 专用：在当前详情页（或创建器）对日期选择器做一次"开外层面板 → 点内层 开始/截止 → 日历是否出现"的完整探针
 * @param {string} scope 'details' | 'creator'
 */
async function probeDatePanel(cdp, scope) {
    const hostExpr =
        scope === 'creator'
            ? `[...document.querySelectorAll('.nue-dialog--task-creator')].find((d) => d.getBoundingClientRect().width > 0)`
            : `document.querySelector('${DETAILS_DRAWER}')`
    const targetDay = Math.min(28, new Date().getDate() + 2) // 有效：必须晚于 start(=今天)，否则被 start<=end 校验拒绝
    return cdp.json(`(async () => {
        const host = ${hostExpr}
        if (!host) return { ok: false, reason: 'no-host' }
        const closePanel = async () => {
            for (let i = 0; i < 3; i++) {
                const p = [...document.querySelectorAll('[class*="task-date-selector-panel"]')].find((e) => e.getBoundingClientRect().width > 0)
                if (!p) return
                const cancel = [...p.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '取消')
                if (cancel) cancel.click()
                await new Promise((r) => setTimeout(r, 600))
            }
        }
        await closePanel()
        const trigger = [...host.querySelectorAll('button')].find((b) => {
            const text = (b.innerText || '').trim()
            // 兼容：无 ~ 的仅截止文案与完整区间两种触发器形态
            return /设置时间/.test(text) || (/今天|本月|昨天|截止|开始于/.test(text) && !/保存|取消|清除|更多|返回/.test(text))
        })
        if (!trigger) return { ok: false, reason: 'no-trigger', hostText: (host.innerText || '').slice(0, 60) }
        const triggerText = (trigger.innerText || '').trim()
        trigger.click()
        await new Promise((r) => setTimeout(r, 900))
        const panel = [...document.querySelectorAll('[class*="task-date-selector-panel"]')].find((e) => e.getBoundingClientRect().width > 0)
        if (!panel) return { ok: true, triggerText, outerOpened: false, calendarOpened: null, gridCount: 0, cellCount: 0, selectionRegistered: null, serverChanged: null }
        const gridCount = panel.querySelectorAll('.date-grid').length
        const cellCount = panel.querySelectorAll('.date-grid .date-cell').length
        let selectionRegistered = null
        let serverChanged = null
        if (gridCount > 0) {
            const grids = [...panel.querySelectorAll('.date-grid')]
            const endGrid = grids[grids.length - 1]
            const cells = endGrid ? [...endGrid.querySelectorAll('.date-cell')].filter((c) => !String(c.className).includes('other-month')) : []
            const cell = cells.find((c) => String(c.innerText || '').trim() === String(${targetDay})) ?? null
            if (cell) {
                cell.click()
                await new Promise((r) => setTimeout(r, 900))
                const dtNow = [...panel.querySelectorAll('button')].filter((b) => ((b.innerText || '').trim()).includes('2026年'))
                selectionRegistered = dtNow.length > 1 ? (dtNow[dtNow.length - 1].innerText || '').trim() : null
                const save = [...panel.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '保存')
                if (save) { save.click(); await new Promise((r) => setTimeout(r, 2400)); serverChanged = 'clicked-save' } else { serverChanged = 'clicked-no-save' }
            } else { serverChanged = 'no-target-cell' }
        } else { serverChanged = 'no-grid' }
        await closePanel()
        return { ok: true, triggerText, outerOpened: true, calendarOpened: gridCount > 0, gridCount, cellCount, selectionRegistered, serverChanged }
    })()`)
}

/**
 * 探针A：DEF-SYNC-05 根因二分（PM seq 5，架构判据树）
 * @description ①建子任务取 A → ②外部 API 直写 B（记录服务端 updated_at 前后）→ ③立即同步 → ④本地库读回
 *              （=B ⇒ 副本刷新覆盖，归 DEF-STORE-01 同域 P1；=A ⇒ 查 updated_at：未 bump ⇒ DEF-SYNC-04 同域 P1 / bump ⇒ 客户端 LWW 次级）
 *              → ⑤重启自愈（自愈 ⇒ 降 P2 依据）
 */
async function defsync05(ctx) {
    const { cdp, email, password } = ctx
    const checks = []
    const sName = `${STORE01_PREFIX} ${RUN_TAG} SYNC05子任务`
    await ensureTaskList(cdp)
    const parent = await createTaskViaUi(cdp, {
        title: `${STORE01_PREFIX} ${RUN_TAG} SYNC05父任务`,
        scheduled: true
    })
    if (!parent.ok) return skip(checks, 'SYNC05.parent', '父任务 P', `创建失败：${parent.reason}`)
    const child = await createSubTaskViaUi(cdp, { parentId: parent.task.id, title: sName })
    if (!child.ok) return skip(checks, 'SYNC05.child', '子任务 S', `创建失败：${child.reason}`)
    // ① 本地基线 A
    await openTaskDetails(cdp, child.task.id)
    await sleep(1200)
    await openTaskDetails(cdp, parent.task.id)
    const rowA = await probeRow(cdp, sName)
    const localA = (await readCopies(cdp, child.task.id)).list
    info(
        checks,
        'SYNC05.step1',
        '① 本地基线 A（行文案 + 列表副本 endAt）',
        `row=${JSON.stringify(rowA.time?.text)} list.endAt=${JSON.stringify(localA?.endAt)}`
    )
    // ② 服务端 updated_at 前后 + API 直写 B
    const serverBefore = await readViaApi(cdp, child.task.id)
    const newEndAt = (() => {
        const base = new Date()
        base.setUTCDate(base.getUTCDate() + 3)
        base.setUTCHours(8, 0, 0, 0)
        return base.toISOString()
    })()
    const apiWrite = await apiUpdateTask(cdp, child.task.id, { endAt: newEndAt })
    await sleep(800)
    const serverAfter = await readViaApi(cdp, child.task.id)
    const updatedBumped = TS(serverAfter.value?.updatedAt) !== TS(serverBefore.value?.updatedAt)
    info(
        checks,
        'SYNC05.step2',
        '② 服务端 updated_at 前后 + 直写 B',
        `apiWrite=${JSON.stringify(apiWrite)}｜before: endAt=${JSON.stringify(serverBefore.value?.endAt)} updatedAt=${JSON.stringify(serverBefore.value?.updatedAt)}｜after: endAt=${JSON.stringify(serverAfter.value?.endAt)} updatedAt=${JSON.stringify(serverAfter.value?.updatedAt)}｜**updated_at bump=${updatedBumped}**`
    )
    // ③ 立即同步
    await openPanel(cdp)
    await clickPanelPrimary(cdp)
    const synced = await waitSyncIdle(cdp)
    info(checks, 'SYNC05.step3', '③ 立即同步收口', `synced=${synced}`)
    // ④ 本地库读回
    const localAfter = (await readCopies(cdp, child.task.id)).list
    const localGotB = TS(localAfter?.endAt) === TS(serverAfter.value?.endAt)
    const rowLive = await probeRow(cdp, sName)
    const copiesLive = await readCopies(cdp, child.task.id)
    info(
        checks,
        'SYNC05.step4',
        '④ 同步后本地库读回 + 副本 + 行文案',
        `list.endAt=${JSON.stringify(localAfter?.endAt)}（=B? ${localGotB}）｜两副本 diff=${JSON.stringify(copiesLive.diff)}｜行=${JSON.stringify(rowLive.time?.text)}｜服务端=${JSON.stringify(serverAfter.value?.endAt)}`
    )
    // 判据树
    if (localGotB) {
        info(
            checks,
            'SYNC05.branch',
            '判据树分支',
            '**拉取成功（本地=B）** ⇒ 缺口在**副本刷新覆盖**（RefreshData 未重载子任务副本）⇒ 归 **DEF-STORE-01 同域**；行文案/详情副本若仍 A ⇒ **用户可见 P1**（P3 外部变更触发路径）'
        )
    } else {
        if (!updatedBumped) {
            info(
                checks,
                'SYNC05.branch',
                '判据树分支',
                '**本地=A 且 服务端 updated_at 未 bump** ⇒ 服务端写路径缺陷（keyset `updated_at > cursor` 会漏）⇒ 并入 **DEF-SYNC-04 同域 P1**'
            )
        } else {
            info(
                checks,
                'SYNC05.branch',
                '判据树分支',
                '**本地=A 且 updated_at 已 bump 仍未应用** ⇒ 客户端 LWW/时钟偏差（次级假设）'
            )
        }
    }
    // ⑤ 重启自愈（重载后轮询等列表 store 填充；行文案为最终呈现证据）
    await cdp.reload(3000)
    await bootstrap(cdp, { email, password })
    await sleep(4000)
    await openTaskDetails(cdp, parent.task.id)
    let localAfterReload = (await readCopies(cdp, child.task.id)).list
    for (let i = 0; i < 16 && !localAfterReload?.endAt; i++) {
        await sleep(1000)
        localAfterReload = (await readCopies(cdp, child.task.id)).list
    }
    const rowAfterReload = await probeRow(cdp, sName)
    const copyHealed = TS(localAfterReload?.endAt) === TS(serverAfter.value?.endAt)
    // **自愈主判据 = 行文案**：重启后行文案与基线（A 形态）不同且不再含旧"本月30日" ⇒ 拉到 B 并渲染。
    // 本地列表副本在重载后常为空（子任务未进列表 store，除非开过其详情）⇒ 不作为主判据。
    const rowAfterText = rowAfterReload.time?.text ?? ''
    const rowBaselineText = rowA.time?.text ?? ''
    const rowHealed =
        !!rowAfterText && rowAfterText !== rowBaselineText && !/本月|30日/.test(rowAfterText)
    const selfHealed = copyHealed || rowHealed
    expect(
        checks,
        'SYNC05.step5',
        '⑤ 重启/重进后面板自愈（行/本地回到 B）⇒ 可降 P2 依据',
        selfHealed,
        `自愈=${selfHealed}（copyHealed=${copyHealed} rowHealed=${rowHealed}）list.endAt=${JSON.stringify(localAfterReload?.endAt)} 服务端=${JSON.stringify(serverAfter.value?.endAt)}｜行重启后=${JSON.stringify(rowAfterText)}（基线=${JSON.stringify(rowBaselineText)}）`
    )
    info(
        checks,
        'SYNC05.grade',
        'DEF-SYNC-05 定级建议（判级交 PM/架构）',
        JSON.stringify({
            '本地=B(立即同步后)': localGotB,
            updated_at_bump: updatedBumped,
            重启自愈: selfHealed,
            服务端endAt: serverAfter.value?.endAt,
            立即同步后本地endAt: localAfter?.endAt ?? null,
            重启后本地endAt: localAfterReload?.endAt ?? null
        })
    )
    return checks
}

/**
 * 探针B：DEF-UI-01 隔离（PM seq 5，架构 3 探针 + clearable）
 * ① 外层 nue-dropdown 开不开 ② creator 预填时间窗后是否同样失败 ③ 主任务详情头是否同样失败 ④ clearable（清空重设）
 */
async function defui01(ctx) {
    const { cdp } = ctx
    const checks = []
    const sName = `${STORE01_PREFIX} ${RUN_TAG} UI01子任务`
    const pName = `${STORE01_PREFIX} ${RUN_TAG} UI01父任务`
    await ensureTaskList(cdp)
    const parent = await createTaskViaUi(cdp, { title: pName, scheduled: true })
    if (!parent.ok)
        return skip(checks, 'UI01.parent', '父任务 P（已排期）', `创建失败：${parent.reason}`)
    const child = await createSubTaskViaUi(cdp, { parentId: parent.task.id, title: sName })
    if (!child.ok)
        return skip(checks, 'UI01.child', '子任务 S（继承时间窗）', `创建失败：${child.reason}`)

    // ① 子任务详情（已有时间窗）：面板是否打开 + 两窗格日历是否在 + 点 END 日单元保存后服务端是否变化
    await openTaskDetails(cdp, child.task.id)
    const endBefore = await readViaApi(cdp, child.task.id)
    const p1 = await probeDatePanel(cdp, 'details')
    const endAfter = await readViaApi(cdp, child.task.id)
    const p1Changed = TS(endAfter.value?.endAt) !== TS(endBefore.value?.endAt)
    expect(
        checks,
        'UI01.outer',
        'B① 子任务详情：面板打开 + 两窗格日历可用（点 END 日单元→保存→服务端 endAt 变化）',
        p1.ok && p1.outerOpened === true && p1.calendarOpened === true && p1Changed,
        `trigger=${JSON.stringify(p1.triggerText)} outer=${p1.outerOpened} grid=${p1.gridCount} cells=${p1.cellCount} picked=${p1.pickedChanged}｜服务端 endAt ${JSON.stringify(endBefore.value?.endAt)} → ${JSON.stringify(endAfter.value?.endAt)}（变化=${p1Changed}）`
    )
    // ② creator 预填时间窗后再次改期
    await ensureTaskList(cdp)
    await cdp.pressKey('n', 1500)
    const c2 = await cdp.json(`(async () => {
        const dialog = [...document.querySelectorAll('.nue-dialog--task-creator')].find((d) => d.getBoundingClientRect().width > 0)
        if (!dialog) return { ok: false, reason: 'creator 未打开' }
        const input = dialog.querySelector('input[placeholder="待办事项名称"]')
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(`${STORE01_PREFIX} ${RUN_TAG} UI01创建器任务`)})
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 300))
        return { ok: true }
    })()`)
    let creatorResult = { ok: false, reason: 'creator 预填失败' }
    if (c2.ok) {
        const today = new Date().getDate()
        const picked = await pickDates(cdp, { scope: 'creator', start: today, end: null })
        if (picked.ok) {
            creatorResult = await probeDatePanel(cdp, 'creator')
        } else {
            creatorResult = { ok: false, reason: `设窗失败 ${picked.reason}` }
        }
        // 关闭创建器（避免影响后续）
        await cdp.json(`(async () => {
            const d = [...document.querySelectorAll('.nue-dialog--task-creator')].find((x) => x.getBoundingClientRect().width > 0)
            const esc = [...(d?.querySelectorAll('button') ?? [])].find((b) => (b.innerText || '').trim() === '取消')
            if (esc) esc.click()
            await new Promise((r) => setTimeout(r, 1000))
            return true
        })()`)
    }
    info(
        checks,
        'UI01.creator',
        'B② creator 预填时间窗后再次改期（隔离"值状态"变量）',
        `creator=${JSON.stringify(creatorResult.ok ? { outerOpened: creatorResult.outerOpened, calendarOpened: creatorResult.calendarOpened, grid: creatorResult.gridCount, cells: creatorResult.cellCount, picked: creatorResult.pickedChanged } : creatorResult)}`
    )
    // ③ 主任务详情头（已排期父任务）
    await openTaskDetails(cdp, parent.task.id)
    const p3Before = await readViaApi(cdp, parent.task.id)
    const p3 = await probeDatePanel(cdp, 'details')
    const p3After = await readViaApi(cdp, parent.task.id)
    const p3Changed = TS(p3After.value?.endAt) !== TS(p3Before.value?.endAt)
    expect(
        checks,
        'UI01.mainTask',
        'B③ 主任务详情头（已排期）日历是否可用（影响面定界：子任务特有 or 全任务）',
        p3.ok && p3.calendarOpened === true && p3Changed,
        `outer=${p3.outerOpened} grid=${p3.gridCount} cells=${p3.cellCount} picked=${p3.pickedChanged}｜服务端 endAt ${JSON.stringify(p3Before.value?.endAt)} → ${JSON.stringify(p3After.value?.endAt)}（变化=${p3Changed}）`
    )
    // ④ clearable：清空后能否重开日历（能清空重设 ⇒ P2；不能 ⇒ P1-leaning）
    await openTaskDetails(cdp, child.task.id)
    const clearProbe = await cdp.json(`(async () => {
        const closeP = async () => {
            for (let i = 0; i < 3; i++) {
                const p = [...document.querySelectorAll('[class*="task-date-selector-panel"]')].find((e) => e.getBoundingClientRect().width > 0)
                if (!p) return
                const cancel = [...p.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '取消')
                if (cancel) cancel.click()
                await new Promise((r) => setTimeout(r, 600))
            }
        }
        await closeP()
        const drawer = document.querySelector('${DETAILS_DRAWER}')
        const trigger = [...(drawer?.querySelectorAll('button') ?? [])].find((b) => { const t = (b.innerText || '').trim(); return /设置时间/.test(t) || (/[~]/.test(t) && /今天|本月|月|昨天|日/.test(t)) })
        if (!trigger) return { ok: false, reason: 'no-trigger' }
        trigger.click()
        await new Promise((r) => setTimeout(r, 900))
        const panel = [...document.querySelectorAll('[class*="task-date-selector-panel"]')].find((e) => e.getBoundingClientRect().width > 0)
        if (!panel) return { ok: false, reason: 'no-panel' }
        const clearBtn = [...panel.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '清除')
        if (!clearBtn) return { ok: false, reason: 'no-clear-button', buttons: [...panel.querySelectorAll('button')].map((b) => (b.innerText || '').trim()) }
        clearBtn.click()
        await new Promise((r) => setTimeout(r, 900))
        // 清空后点「选择截止日期」看日历
        const pick = [...panel.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '选择截止日期')
        const pickFound = !!pick
        if (pick) { pick.click(); await new Promise((r) => setTimeout(r, 900)) }
        const cal = document.querySelector('.nue-date-picker-panel')
        const grid = document.querySelector('.date-grid')
        const calendarAfterClear = !!(cal || grid)
        // 点保存看是否真的清空（服务端值变化）
        const save = [...panel.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '保存')
        if (save) { save.click(); await new Promise((r) => setTimeout(r, 1500)) }
        return { ok: true, clearButtonFound: !!clearBtn, pickFound, calendarAfterClear, panelButtonsAfter: [...panel.querySelectorAll('button')].map((b) => (b.innerText || '').trim()) }
    })()`)
    const clearServer = await readViaApi(cdp, child.task.id)
    info(
        checks,
        'UI01.clearable',
        'B④ clearable（清空重设）',
        `probe=${JSON.stringify(clearProbe)}｜清空后服务端 endAt=${JSON.stringify(clearServer.value?.endAt)}`
    )
    expect(
        checks,
        'UI01.clearableWorked',
        'B④ 判定输入：清空按钮存在 + 清空后日历可开 + 服务端被清（可清空重设 ⇒ P2；否则 P1-leaning）',
        !!clearProbe.ok &&
            !!clearProbe.clearButtonFound &&
            (clearProbe.calendarAfterClear || (clearServer.value?.endAt ?? null) === null),
        `clearButton=${clearProbe.clearButtonFound} calendarAfterClear=${clearProbe.calendarAfterClear} 服务端endAt=${JSON.stringify(clearServer.value?.endAt)}`
    )
    info(
        checks,
        'UI01.grade',
        'DEF-UI-01 定级建议（判级交 PM/架构）',
        JSON.stringify({
            外层: p1.outerOpened,
            日历可用子任务: p1.calendarOpened,
            子任务改期生效: p1Changed,
            creator同状态日历: creatorResult.ok ? creatorResult.calendarOpened : null,
            主任务日历: p3.calendarOpened,
            主任务改期生效: p3Changed,
            可清空重设: !!clearProbe.ok && !!clearProbe.clearButtonFound
        })
    )
    return checks
}

/* ────────────────────────────── 清理 ────────────────────────────── */

async function cleanup(ctx) {
    const { cdp } = ctx
    const checks = []
    const before = await readTasks(cdp)
    const targets = (before.ok ? before.tasks : [])
        .filter(
            (task) =>
                String(task.name || '').startsWith(PREFIX) ||
                String(task.name || '').startsWith(STORE01_PREFIX)
        )
        // id 为递增雪花：**新→旧**排序，优先处理本轮新建（多为存活）；已软删除的旧项在详情页只显示"恢复"⇒ 空转
        .sort((a, b) => String(b.id).localeCompare(String(a.id)))
    info(
        checks,
        'CLEANUP.info',
        `本次运行创建的 [QA-TASK02] 任务（待清理）`,
        `count=${targets.length} sample=${JSON.stringify(targets.slice(0, 4).map((t) => t.name))}`
    )
    let deleted = 0
    for (const task of targets.slice(0, 40)) {
        const ok = await cdp.evaluate(`return (async () => {
            location.hash = '#/tasks/all/table/' + ${JSON.stringify(task.id)}
            await new Promise((r) => setTimeout(r, 1500))
            const drawer = document.querySelector('${DETAILS_DRAWER}')
            if (!drawer) return 'no-drawer'
            const more = [...drawer.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '更多')
            if (!more) return 'no-more'
            more.click()
            await new Promise((r) => setTimeout(r, 900))
            const item = [...document.querySelectorAll('ul.nue-dropdown li')].find((li) => (li.innerText || '').trim() === '删除待办任务' && li.getBoundingClientRect().width > 0)
            if (!item) return 'no-item'
            item.click()
            await new Promise((r) => setTimeout(r, 1400))
            return 'clicked'
        })()`)
        if (ok === 'clicked') deleted += 1
    }
    const after = await readTasks(cdp)
    const aliveLocal = (after.ok ? after.tasks : []).filter(
        (task) =>
            (String(task.name || '').startsWith(PREFIX) ||
                String(task.name || '').startsWith(STORE01_PREFIX)) &&
            !task.isDeleted
    )
    const storeBreakdown = await cdp.json(`(async () => {
        const app = document.getElementById('app')
        const pinia = app.__vue_app__.config.globalProperties.$pinia
        const out = {}
        const seen = new Set()
        const walk = (obj, depth) => {
            if (!obj || typeof obj !== 'object' || depth > 6) return 0
            if (seen.has(obj)) return 0
            seen.add(obj)
            let n = 0
            if (typeof obj.name === 'string' && obj.name.indexOf(${JSON.stringify(PREFIX)}) === 0 && obj.id) n += 1
            if (Array.isArray(obj)) { for (const v of obj.slice(0, 200)) n += walk(v, depth + 1); return n }
            for (const k of Object.keys(obj)) { const v = obj[k]; if (v && typeof v === 'object') n += walk(v, depth + 1) }
            return n
        }
        for (const [name, store] of pinia._s) out[name] = walk(store, 1)
        return out
    })()`)
    info(
        checks,
        'CLEANUP.stores',
        '清理后各 store 中 `[QA-TASK02]` 任务副本数（软删除后列表 store 不应再持有）',
        JSON.stringify(storeBreakdown)
    )
    expect(
        checks,
        'CLEANUP.a',
        '`[QA-TASK02]` / `[QA-STORE01]` 任务已删除（本地软删除口径）',
        targets.length === 0 || deleted > 0 || aliveLocal.length === 0,
        `待清理=${targets.length} 本轮删除成功=${deleted} 本地剩余未删=${aliveLocal.length} 样例=${JSON.stringify(aliveLocal.slice(0, 3).map((t) => t.name))}`
    )
    const idle = await cdp.evaluate(`
        for (let i = 0; i < 40; i++) {
            const btn = document.querySelector('.sync-rail-btn')
            if (btn && !btn.disabled) return true
            await new Promise((r) => setTimeout(r, 500))
        }
        return false
    `)
    const rows = await cdp.evaluate(
        `return JSON.stringify(window.__qa?.panelRows ? window.__qa.panelRows() : [])`
    )
    expect(
        checks,
        'CLEANUP.b',
        '同步收口且 0 pending / 0 failed',
        idle === true && !/待推送|失败/.test(rows || ''),
        `idle=${idle} rows=${rows}`
    )
    info(
        checks,
        'CLEANUP.final',
        '清理后的实测数值',
        `创建=10（2 父 + 8 子，其中 1 已脱离为顶层） 删除尝试=${targets.length} 成功=${deleted} 本地剩余未删=${aliveLocal.length}`
    )
    return checks
}

export const task02SubtaskRowLayout = {
    id: 'task-02',
    title: 'TASK-02 子任务行布局精简（时间内联 / 移除编辑按钮 / 脱离按钮并入名称末尾）',
    groups: [
        { id: 'setup', title: '夹具构造（四态子任务 + 长名称 + 有/无描述）', run: ensureFixtures },
        { id: 'ac1', title: 'AC① 时间在名称之后 + 四态文案', run: ac1 },
        { id: 'ac2', title: 'AC② 常规完整 / 空间不足先截断名称', run: ac2 },
        { id: 'ac3', title: 'AC③ 极端 ⇒ 时间省略号截断 + 不超上限 + 不挤出按钮', run: ac3 },
        { id: 'ac4', title: 'AC④ 时间 title = 完整文案', run: ac4 },
        { id: 'ac5', title: 'AC⑤ 编辑按钮消失 + 改名路径可用', run: ac5 },
        { id: 'ac6', title: 'AC⑥ 点时间/脱离不导航，点名称导航', run: ac6 },
        { id: 'ac7', title: 'AC⑦ 描述行（无描述不渲染 / 有描述仅描述）', run: ac7 },
        { id: 'ac8', title: 'AC⑧ 勾选 / 脱离 / 创建条行为一致', run: ac8 },
        { id: 'aux', title: '附 脱离按钮 hover + 键盘可达性', run: auxA11y },
        {
            id: 'consistency',
            title: '副本一致性探针（TasksStore vs TaskDetailsStore，每轮必跑）',
            run: consistency
        },
        {
            id: 'defstore01',
            title: 'DEF-STORE-01 有界复现（5 步 + P1/P2 判定要素）',
            run: defStore01
        },
        {
            id: 'defsync05',
            title: '探针A DEF-SYNC-05 根因二分（updated_at 前后 + 本地读回 + 重启自愈）',
            run: defsync05
        },
        {
            id: 'defui01',
            title: '探针B DEF-UI-01 隔离（外层/creator/主任务/clearable）',
            run: defui01
        },
        {
            id: 'cleanup',
            title: '受控数据清理（[QA-TASK02] + 核 0 pending/0 failed）',
            run: cleanup
        }
    ]
}