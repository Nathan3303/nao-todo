/**
 * 日视图「真实命中」抽检 · 实机冒烟（**固化 ADR C12**）
 *
 * 保护的契约：`docs/adr/2026-09-22-day-view-interaction-contract.md` **C12**
 *   「任何 `position: absolute; inset: 0` 的覆盖层必须 `pointer-events: none`（或进入 pan 排除清单），
 *     且任何堆叠关系变更都必须做一次**真实浏览器 `elementFromPoint` 抽检**」。
 *
 * ── 为什么必须实机（jsdom 发现不了）─────────────────────────────────────────
 * TASK-20 用户报「任务条拖不动」的**根因**：`.day-axis-track`（`z-index: 1` + `inset: 0` + 可命中）
 * 在真实浏览器里盖住 `.cal-lanes`（`z-index: auto`）⇒ 时间轴任务条**不可命中指针**，
 * 指针落到覆盖层 ⇒ 被判为空白 ⇒ 起 pan 而非拖条。
 * 而 jsdom **没有布局/堆叠/命中测试**：单测用 `dispatchEvent` 直接派发到条上，**绕过命中测试**，
 * 故 100% 绿也照不出该缺陷。本组用**真实渲染进程** `document.elementFromPoint` 复现/守护该口径。
 *
 * ── 断言口径（按 ADR C12 抽检口径）──────────────────────────────────────────
 * - `setup`：导航 `#/calendar/daily` + 保证有 ≥1 个**日内**任务条；**无数据 ⇒ SKIP 并写明原因，绝不 PASS**
 *   （先只读探测；确无日内条才创建 1 条受控夹具，避免无谓写数据）。
 * - `bars`：每个可见 `.day-seg .cal-item` 的中点 / 条体左内侧命中的 `closest('.cal-item')` = 该条本身。
 * - `handles`：左/右手柄（`.day-task-resize--start` / `.day-task-resize`）命中自身；**两侧恒在**（含续接段）。
 * - `blank`：条右侧/下方空白命中**非** `.cal-item`、**非** 手柄，且命中层为 `.day-grid`
 *   （**不是** `.day-axis-track`）—— 这正是 C12 回归判据。
 * - `overlay`：`.day-axis-track` / `.day-edge-fade` 计算样式 `pointer-events === 'none'`（C12 硬约束）。
 * - `allday`：全天泳道 `.cal-item` 可命中，且**无**拖拽/拉伸手柄。
 * - `ticks`：带文本刻度标签 `.day-col-label`（原生 button）可命中。
 * - `zoom`：**至少 ×1 与 ×4 两档各跑一遍** bars/blank（放大后命中层位会变）；跑完复位 ×1。
 *
 * ── 与派单口径的**唯一差异**（已实测证据，非放宽）────────────────────────────
 * 派单写「`(left+2, midY)` 命中该条本身」；实测**几何上不可能**：左手柄 CSS 为
 * `.day-task-resize--start { left: -3px; width: 8px }` ⇒ 手柄盒 = `[条左缘−3, 条左缘+5]`，
 * 故 `left+2` 落在**左手柄**内（手柄 `z-index: 3` 且 DOM 在后 ⇒ 命中手柄）。
 * 本组因此断言：`left+2` ⇒ **左手柄**（把「左缘归属手柄」写成显式断言），
 * 另以 `left+10`（越过手柄右缘）断言「条体本身可命中」。条的中点口径不变。
 *
 * ── 数据纪律 ───────────────────────────────────────────────────────────────
 * 夹具前缀 `[QA-DAYHIT]`（日内时间窗，走创建器 UI）；仅当**确无日内条**时才创建；
 * `cleanup` 组按前缀经 API DELETE 清理并核 `0 pending / 0 failed`。
 * 环境前置：后端 3302、窗口前台（见 README「环境陷阱」）。
 */
import { sleep } from '../lib/cdp.mjs'
import { qaKit } from './task-01-subtask-inherit.mjs'

const { ANCHORS, ensureTaskList, pickDates, readTasks } = qaKit

const PREFIX = '[QA-DAYHIT]'
const RUN_TAG = Date.now().toString(36)
const DAY_ROUTE = '#/calendar/daily'
/** 档位 × 列数（48 = ×1/×1.5、96 = ×2/×3、288 = ×4；ADR 轴参数化 C4/r2） */
const COLUMNS_OF_ZOOM = { 1: 48, 4: 288 }
/** 左/右手柄命中探测点相对条缘的偏移（手柄盒 = [缘−3, 缘+5] ⇒ 越过手柄取 +10） */
const HANDLE_EDGE_OFFSET = 2
const BAR_INNER_OFFSET = 10

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

/** 跨分组状态（run.mjs 每个分组拿到的是**新** state 对象 ⇒ 必须放模块作用域） */
const runState = { dataOk: false, fixture: null, fixtureTried: false, lastSnap: null }

/**
 * 页面内一次性采集：骨架 / 几何 / 覆盖层计算样式 / 逐条命中探测
 * @description 全部在渲染进程内完成（避免跨边界矩形换算误差与多次求值竞态）；
 *              每个探测点返回 `selfItem`（命中该条本身）/ `selfNode`（命中该目标节点本身）/
 *              `handle` / `inItem` / `inGrid` / `inTrack` 等判定字段。
 */
const COLLECT = `(async () => {
    const root = document.querySelector('.nue-calendar-daily')
    if (!root) return { ok: false, reason: '未找到 .nue-calendar-daily（未进入日视图）', hash: location.hash }
    const body = root.querySelector('.day-body')
    const grid = root.querySelector('.day-grid')
    const head = root.querySelector('.day-cols-head')
    const scroll = root.querySelector('.day-scroll')
    if (!body || !grid || !head || !scroll) {
        return { ok: false, reason: '日视图骨架缺失', hash: location.hash, has: { body: !!body, grid: !!grid, head: !!head, scroll: !!scroll } }
    }
    const box = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom, cx: b.x + b.width / 2, cy: b.y + b.height / 2 } }
    const r2 = (b) => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), right: Math.round(b.right), bottom: Math.round(b.bottom) })
    const bodyRect = box(body)
    /** 可视区 = 滚动宿主 ∩ 窗口（滚动裁剪后仍可见的部分） */
    const vis = { x: Math.max(bodyRect.x, 0), y: Math.max(bodyRect.y, 0), right: Math.min(bodyRect.right, innerWidth), bottom: Math.min(bodyRect.bottom, innerHeight) }
    const inside = (x, y) => x >= vis.x && x <= vis.right && y >= vis.y && y <= vis.bottom
    /** 元素 ∩ 可视区（宽高 > 2px 才算可见；返回交集中点） */
    const clip = (b) => {
        const x = Math.max(b.x, vis.x), y = Math.max(b.y, vis.y)
        const right = Math.min(b.right, vis.right), bottom = Math.min(b.bottom, vis.bottom)
        return right - x > 2 && bottom - y > 2 ? { x, y, right, bottom, cx: (x + right) / 2, cy: (y + bottom) / 2 } : null
    }
    /** 真实命中探测（**C12 的核心手段**）：target 用于判 selfItem / selfNode */
    const probe = (x, y, target) => {
        const el = document.elementFromPoint(x, y)
        const point = { x: Math.round(x), y: Math.round(y) }
        if (!el) return Object.assign(point, { hit: 'null', selfItem: false, selfNode: false, inItem: false, inGrid: false, inBody: false, inTrack: false, inAllday: false, handle: null, label: null })
        const item = el.closest('.cal-item')
        const handle = el.closest('.day-task-resize, .day-task-resize--start')
        const label = el.closest('.day-col-label')
        return Object.assign(point, {
            hit: el.tagName + '.' + String(el.className || '').split(' ')[0],
            selfItem: !!target && item === target,
            selfNode: !!target && (el === target || target.contains(el)),
            inItem: !!item,
            inGrid: !!el.closest('.day-grid'),
            inBody: !!el.closest('.day-body'),
            inTrack: !!el.closest('.day-axis-track'),
            inAllday: !!el.closest('.day-allday-lane'),
            handle: handle ? (handle.classList.contains('day-task-resize--start') ? 'start' : 'end') : null,
            label: label ? (label.textContent || '').trim() : null
        })
    }
    const nameOf = (el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 32)

    // —— 日内任务条（.day-seg > .cal-item + 两侧手柄）——
    const timed = [...root.querySelectorAll('.day-seg')].map((seg) => {
        const item = seg.querySelector('.cal-item')
        const handleStart = seg.querySelector('.day-task-resize--start')
        const handleEnd = seg.querySelector('.day-task-resize')
        const b = item ? box(item) : null
        const c = b ? clip(b) : null
        const entry = {
            taskId: item ? item.getAttribute('data-task-id') : null,
            name: item ? nameOf(item) : null,
            isStart: item ? !item.classList.contains('has-cont-start') : null,
            isEnd: item ? !item.classList.contains('has-cont-end') : null,
            hasHandleStart: !!handleStart,
            hasHandleEnd: !!handleEnd,
            rect: b ? r2(b) : null,
            visible: !!c,
            probes: {}
        }
        if (item && b && c) {
            entry.probes.mid = probe(c.cx, c.cy, item)
            // 命中栈（paint order）：覆盖层若可命中就会出现在栈里 —— 与 z-index 细节无关的 C12 判据
            entry.probes.midStack = [...document.elementsFromPoint(c.cx, c.cy)].map((el) => (String(el.className || '').split(' ')[0] || el.tagName))
            if (inside(b.x + ${HANDLE_EDGE_OFFSET}, c.cy)) entry.probes.leftEdge = probe(b.x + ${HANDLE_EDGE_OFFSET}, c.cy, item)
            if (inside(b.x + ${BAR_INNER_OFFSET}, c.cy)) entry.probes.leftInner = probe(b.x + ${BAR_INNER_OFFSET}, c.cy, item)
            entry.probes.blankRight = probe(Math.min(vis.right - 3, b.right + 24), c.cy, item)
            entry.probes.blankBelow = probe(c.cx, Math.min(vis.bottom - 3, b.bottom + 40), item)
        }
        if (handleStart) { const h = clip(box(handleStart)); if (h) entry.probes.handleStart = probe(h.cx, h.cy, handleStart) }
        if (handleEnd) { const h = clip(box(handleEnd)); if (h) entry.probes.handleEnd = probe(h.cx, h.cy, handleEnd) }
        return entry
    })

    // —— 全天泳道（只读条，无手柄）——
    const allday = [...root.querySelectorAll('.day-allday-lane .cal-item')].map((item) => {
        const b = box(item)
        const c = clip(b)
        return {
            taskId: item.getAttribute('data-task-id'),
            name: nameOf(item),
            reason: item.getAttribute('data-allday-reason'),
            title: item.getAttribute('title'),
            handleCount: item.querySelectorAll('.day-task-resize, .day-task-resize--start').length,
            inSeg: !!item.closest('.day-seg'),
            visible: !!c,
            rect: r2(b),
            probes: c ? { mid: probe(c.cx, c.cy, item) } : {}
        }
    })

    // —— 刻度标签（原生 button）——
    const ticks = [...root.querySelectorAll('.day-col-label')].map((btn) => {
        const c = clip(box(btn))
        return { text: (btn.textContent || '').trim(), visible: !!c, probes: c ? { mid: probe(c.cx, c.cy, btn) } : {} }
    })

    // —— 覆盖层计算样式（C12）——
    const pe = (sel) => {
        const el = root.querySelector(sel)
        if (!el) return { found: false }
        const cs = getComputedStyle(el)
        return { found: true, pointerEvents: cs.pointerEvents, zIndex: cs.zIndex, position: cs.position }
    }
    const gridRect = box(grid)
    return {
        ok: true,
        hash: location.hash,
        meta: {
            columns: head.children.length,
            gridLines: [...grid.querySelectorAll('[class*="day-col-lines--"]')].map((e) => [...e.classList].find((c) => c.startsWith('day-col-lines--'))).filter(Boolean),
            axisWidth: Math.round(scroll.getBoundingClientRect().width),
            bodyClientWidth: Math.round(body.clientWidth),
            bodyScrollLeft: Math.round(body.scrollLeft),
            stateOverlay: !!grid.querySelector('.day-state'),
            segCount: root.querySelectorAll('.day-seg').length,
            bodyRect: r2(bodyRect),
            gridRect: r2(gridRect)
        },
        overlay: {
            track: pe('.day-axis-track'),
            fadeStart: pe('.day-edge-fade.is-start'),
            fadeEnd: pe('.day-edge-fade.is-end'),
            axisBg: pe('.day-axis-bg'),
            nowLine: pe('.day-now-line'),
            state: pe('.day-state')
        },
        timed,
        allday,
        ticks
    }
})()`

const collect = (cdp) => cdp.json(COLLECT)

/** 导航到日视图并等骨架就绪（不要求无空态覆盖；覆盖情况记入 meta） */
async function gotoDayView(cdp) {
    await cdp.evaluate(`
        if (location.hash !== '${DAY_ROUTE}') location.hash = '${DAY_ROUTE}'
        await new Promise((r) => setTimeout(r, 1200))
        return location.hash
    `)
    let last = null
    for (let i = 0; i < 24; i++) {
        last = await cdp.json(`(() => {
            const root = document.querySelector('.nue-calendar-daily')
            const grid = root ? root.querySelector('.day-grid') : null
            const body = root ? root.querySelector('.day-body') : null
            return {
                ready: !!root && !!grid && !!body,
                hash: location.hash,
                stateOverlay: grid ? !!grid.querySelector('.day-state') : null,
                segs: root ? root.querySelectorAll('.day-seg').length : -1
            }
        })()`)
        if (last.ready) return { ok: true, waitedMs: i * 400, ...last }
        await sleep(400)
    }
    return { ok: false, reason: '日视图骨架 10s 内未就绪', last }
}

/**
 * 保证有**可见**的日内条：若无可见条（例如条落在 00:00 附近、而进入日视图会定位到当前时间）
 * ⇒ 把横向滚动挪到第一条上（**只读几何 + 滚动，不写业务数据**）
 */
async function ensureVisibleBar(cdp) {
    let snap = await collect(cdp)
    if (!snap.ok) return snap
    if (snap.timed.some((seg) => seg.visible)) return snap
    const target = snap.timed[0]
    if (!target) return snap
    const moved = await cdp.evaluate(`
        const root = document.querySelector('.nue-calendar-daily')
        const body = root.querySelector('.day-body')
        const seg = root.querySelectorAll('.day-seg')[0]
        if (!seg) return { ok: false }
        const before = body.scrollLeft
        const b = seg.getBoundingClientRect()
        const view = body.getBoundingClientRect()
        body.scrollLeft = Math.max(0, before + (b.x - view.x) - 40)
        await new Promise((r) => setTimeout(r, 400))
        return { ok: true, before: Math.round(before), after: Math.round(body.scrollLeft) }
    `)
    await sleep(400)
    const next = await collect(cdp)
    return Object.assign(next, { scrolled: moved })
}

/** 创建 1 条受控夹具：**日内**时间窗（开始 = 截止 = 今天 ⇒ 日内段，非全天） */
async function createFixture(cdp) {
    runState.fixtureTried = true
    const name = `${PREFIX} ${RUN_TAG} 日内`
    await ensureTaskList(cdp)
    await cdp.pressKey('n', 1500)
    const filled = await cdp.json(`(async () => {
        const dialog = [...document.querySelectorAll('${ANCHORS.creatorDialog}')].find((d) => d.getBoundingClientRect().width > 0)
        if (!dialog) return { ok: false, reason: '任务创建器未打开' }
        const input = dialog.querySelector('${ANCHORS.creatorTitleInput}')
        if (!input) return { ok: false, reason: '未找到名称输入框' }
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(name)})
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 300))
        return { ok: true }
    })()`)
    if (!filled.ok) return { ok: false, reason: filled.reason }
    // 开始 = 截止 = 今天（datetime 选择器保留当前时刻 ⇒ 日内小窗；跨整天会落全天泳道）
    const today = new Date().getDate()
    const picked = await pickDates(cdp, { start: today, end: today })
    if (!picked.ok) return { ok: false, reason: `时间窗设置失败：${picked.reason ?? ''}`, steps: picked.steps }
    const saved = await cdp.json(`(async () => {
        const dialog = [...document.querySelectorAll('${ANCHORS.creatorDialog}')].find((d) => d.getBoundingClientRect().width > 0)
        if (!dialog) return { ok: false, reason: '创建器已关闭' }
        const footer = dialog.querySelector('.nue-dialog__footer') ?? dialog
        const btn = [...footer.querySelectorAll('button')].find((b) => ${JSON.stringify(ANCHORS.creatorSaveText)}.some((t) => (b.innerText || '').trim() === t))
        if (!btn) return { ok: false, reason: '未找到保存/创建按钮' }
        btn.click()
        await new Promise((r) => setTimeout(r, 2500))
        return { ok: true }
    })()`)
    if (!saved.ok) return { ok: false, reason: saved.reason }
    const tasks = await readTasks(cdp)
    const task = tasks.ok ? tasks.tasks.find((item) => item.name === name) : null
    runState.fixture = { name, id: task ? task.id : null, startAt: task ? task.startAt : null, endAt: task ? task.endAt : null }
    return task
        ? { ok: true, task: runState.fixture }
        : { ok: false, reason: `创建后 store 未找到夹具：${JSON.stringify(tasks).slice(0, 200)}` }
}

// ───────────────────────── 断言组 ─────────────────────────

/** setup：导航 + 保证 ≥1 日内条（无数据 ⇒ SKIP，绝不 PASS） */
async function setup(ctx) {
    const { cdp } = ctx
    const checks = []
    const nav = await gotoDayView(cdp)
    info(checks, 'HIT.setup.nav', '导航到日视图', JSON.stringify(nav))
    if (!nav.ok) {
        runState.dataOk = false
        return skip(checks, 'HIT.setup.ready', '日视图未就绪', nav.reason)
    }
    let snap = await ensureVisibleBar(cdp)
    if (!snap.ok) {
        runState.dataOk = false
        return skip(checks, 'HIT.setup.ready', '日视图采集失败', snap.reason ?? '')
    }
    info(checks, 'HIT.setup.count', '首轮只读探测（未写数据）', JSON.stringify({ timed: snap.timed.length, allday: snap.allday.length, visibleTimed: snap.timed.filter((s) => s.visible).length, stateOverlay: snap.meta.stateOverlay }))

    // 确无日内条 ⇒ 才创建受控夹具（避免无谓写业务数据）
    if (snap.timed.length === 0) {
        const created = await createFixture(cdp)
        info(checks, 'HIT.setup.fixture', '受控夹具创建（[QA-DAYHIT] 日内）', JSON.stringify(created))
        if (!created.ok) {
            runState.dataOk = false
            return skip(checks, 'HIT.setup.data', '无日内任务条且夹具创建失败 ⇒ SKIP（不判 PASS）', created.reason ?? '')
        }
        await gotoDayView(cdp)
        snap = await ensureVisibleBar(cdp)
    }
    runState.lastSnap = snap
    if (snap.timed.length === 0) {
        runState.dataOk = false
        return skip(
            checks,
            'HIT.setup.data',
            '当日无日内任务条 ⇒ SKIP（不判 PASS，避免假绿）',
            JSON.stringify({ hash: snap.hash, timed: 0, allday: snap.allday.length, stateOverlay: snap.meta.stateOverlay, fixtureTried: runState.fixtureTried, fixture: runState.fixture })
        )
    }
    runState.dataOk = true
    expect(checks, 'HIT.setup.ready', '日视图就绪且无状态覆盖层（状态层会盖住网格）', snap.meta.stateOverlay === false, `hash=${snap.hash} stateOverlay=${snap.meta.stateOverlay}`)
    expect(
        checks,
        'HIT.setup.bars',
        '存在日内任务条且至少 1 条可见（可见 = 落在滚动宿主可视区）',
        snap.timed.filter((s) => s.visible).length >= 1,
        JSON.stringify({ timed: snap.timed.length, visible: snap.timed.filter((s) => s.visible).length, columns: snap.meta.columns, axisWidth: snap.meta.axisWidth, bodyClientWidth: snap.meta.bodyClientWidth, scrollLeft: snap.meta.bodyScrollLeft, scrolled: snap.scrolled ?? null })
    )
    info(checks, 'HIT.setup.geometry', '视口/网格几何（px）', JSON.stringify({ bodyRect: snap.meta.bodyRect, gridRect: snap.meta.gridRect, gridLines: snap.meta.gridLines }))
    return checks
}

/** overlay：C12 硬约束 —— 覆盖层不得拦截指针 */
async function overlay(ctx) {
    const { cdp } = ctx
    const checks = []
    const snap = await collect(cdp)
    if (!snap.ok) return skip(checks, 'HIT.overlay', '采集失败', snap.reason ?? '')
    const { track, fadeStart, fadeEnd, axisBg, nowLine, state } = snap.overlay
    expect(checks, 'HIT.overlay.track', '`.day-axis-track` pointer-events = none（C12；根因回归判据）', track.found && track.pointerEvents === 'none', `found=${track.found} pointerEvents=${track.pointerEvents} zIndex=${track.zIndex} position=${track.position}`)
    expect(checks, 'HIT.overlay.fadeStart', '`.day-edge-fade.is-start` pointer-events = none', fadeStart.found && fadeStart.pointerEvents === 'none', JSON.stringify(fadeStart))
    expect(checks, 'HIT.overlay.fadeEnd', '`.day-edge-fade.is-end` pointer-events = none', fadeEnd.found && fadeEnd.pointerEvents === 'none', JSON.stringify(fadeEnd))
    expect(checks, 'HIT.overlay.axisBg', '`.day-axis-bg` pointer-events = none（同口径）', axisBg.found && axisBg.pointerEvents === 'none', JSON.stringify(axisBg))
    expect(checks, 'HIT.overlay.nowLine', '`.day-now-line` pointer-events = none', nowLine.found && nowLine.pointerEvents === 'none', JSON.stringify(nowLine))
    info(checks, 'HIT.overlay.state', '`.day-state`（loading/error/空态覆盖层）计算样式 —— 仅状态期存在，非空白命中路径', JSON.stringify(state))
    return checks
}

/** 逐条命中断言（bars / blank 共用；供 zoom 组两档复用） */
function assertBarsAndBlank(checks, snap, level) {
    if (!snap || !snap.ok) {
        return skip(checks, `HIT.${level}.data`, `${level} 采集失败`, snap ? (snap.reason ?? '') : 'no-snapshot')
    }
    const visible = snap.timed.filter((seg) => seg.visible)
    if (visible.length === 0) {
        return skip(checks, `HIT.${level}.data`, `${level} 无可见日内条 ⇒ SKIP`, JSON.stringify({ timed: snap.timed.length, columns: snap.meta.columns }))
    }
    const midBad = visible.filter((seg) => !seg.probes.mid || !seg.probes.mid.selfItem)
    expect(
        checks,
        `HIT.${level}.mid`,
        `${level} 条中点命中该条本身（closest('.cal-item') === 该条）`,
        midBad.length === 0,
        JSON.stringify({ visible: visible.length, bad: midBad.map((s) => ({ id: s.taskId, name: s.name, probe: s.probes.mid })) })
    )
    const innerProbed = visible.filter((seg) => seg.probes.leftInner)
    // 命中栈不得包含任何覆盖层（C12：覆盖层可命中 ⇒ 出现在栈内）
    const OVERLAYS = ['day-axis-track', 'day-edge-fade', 'day-now-line', 'day-drag-snap-line', 'day-axis-bg']
    const stackBad = visible.filter((seg) => (seg.probes.midStack || []).some((cls) => OVERLAYS.includes(cls)))
    expect(
        checks,
        `HIT.${level}.stack`,
        `${level} 条中点命中栈不含任何覆盖层（${OVERLAYS.join('/')}）`,
        stackBad.length === 0,
        JSON.stringify({ overlays: OVERLAYS, bad: stackBad.map((s) => ({ id: s.taskId, stack: s.probes.midStack })), sample: visible[0] ? visible[0].probes.midStack : null })
    )
    const innerBad = innerProbed.filter((seg) => !seg.probes.leftInner.selfItem)
    expect(
        checks,
        `HIT.${level}.innerLeft`,
        `${level} 条体左内侧（条缘+${BAR_INNER_OFFSET}px，越过左手柄）命中该条本身`,
        innerBad.length === 0,
        JSON.stringify({ probed: innerProbed.length, bad: innerBad.map((s) => ({ id: s.taskId, probe: s.probes.leftInner })) })
    )
    const edgeProbed = visible.filter((seg) => seg.probes.leftEdge)
    const edgeBad = edgeProbed.filter((seg) => seg.probes.leftEdge.handle !== 'start')
    expect(
        checks,
        `HIT.${level}.leftEdge`,
        `${level} 条左缘（条缘+${HANDLE_EDGE_OFFSET}px）命中**左手柄**（口径修正：手柄盒 = [缘−3, 缘+5]）`,
        edgeBad.length === 0,
        JSON.stringify({ probed: edgeProbed.length, bad: edgeBad.map((s) => ({ id: s.taskId, probe: s.probes.leftEdge })) })
    )

    // blank：候选点 = 条右/条下 + 网格级候选；统计「空白」点并断言其命中层为 .day-grid（非 track）
    const candidates = []
    for (const seg of visible) {
        if (seg.probes.blankRight) candidates.push({ tag: `bar:${seg.taskId}:right`, probe: seg.probes.blankRight })
        if (seg.probes.blankBelow) candidates.push({ tag: `bar:${seg.taskId}:below`, probe: seg.probes.blankBelow })
    }
    const blank = candidates.filter((c) => !c.probe.inItem && !c.probe.handle)
    const blankForeign = blank.filter((c) => c.probe.inTrack || !c.probe.inGrid)
    expect(
        checks,
        `HIT.${level}.blank`,
        `${level} 空白命中非任务条/非手柄，且命中层为 .day-grid（**不是** .day-axis-track）`,
        blank.length >= 1 && blankForeign.length === 0,
        JSON.stringify({
            candidates: candidates.length,
            blank: blank.length,
            occupied: candidates.length - blank.length,
            foreign: blankForeign.map((c) => ({ tag: c.tag, probe: c.probe })),
            hits: blank.map((c) => `${c.tag}→${c.probe.hit}`)
        })
    )
    info(
        checks,
        `HIT.${level}.blank.detail`,
        `${level} 空白候选逐点（occupied = 落在别的条上，属布局，不判失败）`,
        JSON.stringify(candidates.map((c) => ({ tag: c.tag, hit: c.probe.hit, inItem: c.probe.inItem, handle: c.probe.handle, inTrack: c.probe.inTrack, inGrid: c.probe.inGrid })))
    )
    return checks
}

/** bars：日内任务条命中 */
async function bars(ctx) {
    const checks = []
    if (!runState.dataOk) return skip(checks, 'HIT.bars', '无日内任务条数据 ⇒ SKIP（见 setup 组）', 'setup 未取得数据')
    const snap = runState.lastSnap && runState.lastSnap.meta.columns === COLUMNS_OF_ZOOM[1] ? runState.lastSnap : await ensureVisibleBar(ctx.cdp)
    runState.lastSnap = snap
    return assertBarsAndBlank(checks, snap, 'bars')
}

/** handles：两侧手柄恒在 + 可命中（含续接段） */
async function handles(ctx) {
    const checks = []
    if (!runState.dataOk) return skip(checks, 'HIT.handles', '无日内任务条数据 ⇒ SKIP（见 setup 组）', 'setup 未取得数据')
    const snap = await ensureVisibleBar(ctx.cdp)
    if (!snap.ok) return skip(checks, 'HIT.handles', '采集失败', snap.reason ?? '')
    const missing = snap.timed.filter((seg) => !seg.hasHandleStart || !seg.hasHandleEnd)
    expect(
        checks,
        'HIT.handles.present',
        '每条（含续接段）左/右手柄均在 DOM（C2 r2 两侧恒在）',
        snap.timed.length > 0 && missing.length === 0,
        JSON.stringify({ total: snap.timed.length, missing: missing.map((s) => ({ id: s.taskId, isStart: s.isStart, isEnd: s.isEnd, hasHandleStart: s.hasHandleStart, hasHandleEnd: s.hasHandleEnd })), cont: snap.timed.filter((s) => !s.isStart || !s.isEnd).map((s) => ({ id: s.taskId, isStart: s.isStart, isEnd: s.isEnd })) })
    )
    const visible = snap.timed.filter((seg) => seg.visible)
    if (visible.length === 0) return skip(checks, 'HIT.handles.hit', '无可见条 ⇒ 命中抽检 SKIP', JSON.stringify({ timed: snap.timed.length }))
    const startBad = visible.filter((seg) => !seg.probes.handleStart || !seg.probes.handleStart.selfNode || seg.probes.handleStart.handle !== 'start')
    const endBad = visible.filter((seg) => !seg.probes.handleEnd || !seg.probes.handleEnd.selfNode || seg.probes.handleEnd.handle !== 'end')
    expect(checks, 'HIT.handles.start', '左手柄中点命中 `.day-task-resize--start` 自身', startBad.length === 0, JSON.stringify({ probed: visible.length, bad: startBad.map((s) => ({ id: s.taskId, probe: s.probes.handleStart })) }))
    expect(checks, 'HIT.handles.end', '右手柄中点命中 `.day-task-resize` 自身', endBad.length === 0, JSON.stringify({ probed: visible.length, bad: endBad.map((s) => ({ id: s.taskId, probe: s.probes.handleEnd })) }))
    return checks
}

/** blank：独立分组（仅条右/下方候选，便于定向复跑） */
async function blank(ctx) {
    const checks = []
    if (!runState.dataOk) return skip(checks, 'HIT.blank', '无日内任务条数据 ⇒ SKIP（见 setup 组）', 'setup 未取得数据')
    const snap = await ensureVisibleBar(ctx.cdp)
    if (!snap.ok) return skip(checks, 'HIT.blank', '采集失败', snap.reason ?? '')
    const visible = snap.timed.filter((seg) => seg.visible)
    if (visible.length === 0) return skip(checks, 'HIT.blank', '无可见条 ⇒ SKIP', JSON.stringify({ timed: snap.timed.length }))
    const candidates = []
    for (const seg of visible) {
        if (seg.probes.blankRight) candidates.push({ tag: `bar:${seg.taskId}:right`, probe: seg.probes.blankRight })
        if (seg.probes.blankBelow) candidates.push({ tag: `bar:${seg.taskId}:below`, probe: seg.probes.blankBelow })
    }
    const blank = candidates.filter((c) => !c.probe.inItem && !c.probe.handle)
    const foreign = blank.filter((c) => c.probe.inTrack || !c.probe.inGrid)
    expect(checks, 'HIT.blank.count', '存在可命中的空白点（条右/条下）', blank.length >= 1, JSON.stringify({ candidates: candidates.length, blank: blank.length, hits: blank.map((c) => `${c.tag}→${c.probe.hit}`) }))
    expect(checks, 'HIT.blank.layer', '空白命中层 = .day-grid（非 .day-axis-track，C12）', foreign.length === 0, JSON.stringify({ foreign: foreign.map((c) => ({ tag: c.tag, probe: c.probe })) }))
    info(checks, 'HIT.blank.detail', '空白候选逐点', JSON.stringify(candidates.map((c) => ({ tag: c.tag, hit: c.probe.hit, inItem: c.probe.inItem, handle: c.probe.handle, inTrack: c.probe.inTrack, inGrid: c.probe.inGrid, inAllday: c.probe.inAllday }))))
    return checks
}

/** allday：全天泳道可命中 + 无手柄 */
async function allday(ctx) {
    const checks = []
    const snap = await collect(ctx.cdp)
    if (!snap.ok) return skip(checks, 'HIT.allday', '采集失败', snap.reason ?? '')
    if (snap.allday.length === 0) {
        return skip(checks, 'HIT.allday', '当日无全天条（需仅设截止时间的当日任务或跨整天窗）⇒ SKIP', JSON.stringify({ timed: snap.timed.length, allday: 0 }))
    }
    const visible = snap.allday.filter((item) => item.visible)
    if (visible.length === 0) return skip(checks, 'HIT.allday.hit', '全天条均不可见（横向滚动位）⇒ 命中抽检 SKIP', JSON.stringify({ allday: snap.allday.length }))
    const bad = visible.filter((item) => !item.probes.mid || !item.probes.mid.selfItem)
    expect(checks, 'HIT.allday.hit', '全天泳道 `.cal-item` 中点命中自身', bad.length === 0, JSON.stringify({ visible: visible.length, bad: bad.map((i) => ({ id: i.taskId, probe: i.probes.mid })) }))
    const handleBad = snap.allday.filter((item) => item.handleCount !== 0 || item.inSeg)
    expect(checks, 'HIT.allday.readonly', '全天条**无**拖拽/拉伸手柄、不在 `.day-seg` 内（只读，C6）', handleBad.length === 0, JSON.stringify({ total: snap.allday.length, bad: handleBad.map((i) => ({ id: i.taskId, handleCount: i.handleCount, inSeg: i.inSeg })) }))
    const reasonBad = snap.allday.filter((item) => !item.reason || !item.title || !item.title.startsWith(item.name))
    expect(checks, 'HIT.allday.reason', '全天条带 `data-allday-reason` 且 `title` = 任务名（原因文案）', reasonBad.length === 0, JSON.stringify(snap.allday.map((i) => ({ id: i.taskId, reason: i.reason, title: i.title }))))
    return checks
}

/** ticks：刻度标签（原生 button）可命中 */
async function ticks(ctx) {
    const checks = []
    const snap = await collect(ctx.cdp)
    if (!snap.ok) return skip(checks, 'HIT.ticks', '采集失败', snap.reason ?? '')
    const visible = snap.ticks.filter((tick) => tick.visible)
    if (visible.length === 0) return skip(checks, 'HIT.ticks', '无可见刻度标签 ⇒ SKIP', JSON.stringify({ total: snap.ticks.length, columns: snap.meta.columns }))
    const sample = [visible[0], visible[Math.floor(visible.length / 2)], visible[visible.length - 1]]
    const bad = sample.filter((tick) => !tick.probes.mid || !tick.probes.mid.selfNode || tick.probes.mid.label !== tick.text)
    expect(checks, 'HIT.ticks.hit', '刻度标签中点命中该 button（含首/中/末各 1）', bad.length === 0, JSON.stringify({ visible: visible.length, sample: sample.map((t) => ({ text: t.text, probe: t.probes.mid })) }))
    return checks
}

/** zoom：×1 与 ×4 各跑一遍 bars/blank（放大后命中层位会变） */
async function zoom(ctx) {
    const { cdp } = ctx
    const checks = []
    if (!runState.dataOk) return skip(checks, 'HIT.zoom', '无日内任务条数据 ⇒ SKIP（见 setup 组）', 'setup 未取得数据')
    /** 入口③：Ctrl/⌘ + 滚轮（真实处理器；`.ctrl` 修饰符 + deltaY 符号） */
    const wheel = (deltaY, times) =>
        cdp.evaluate(`
            const el = document.querySelector('.day-body')
            if (!el) return false
            for (let i = 0; i < ${times}; i++) {
                el.dispatchEvent(new WheelEvent('wheel', { deltaY: ${deltaY}, ctrlKey: true, bubbles: true, cancelable: true }))
                await new Promise((r) => setTimeout(r, 220))
            }
            await new Promise((r) => setTimeout(r, 500))
            return true
        `)

    // 归一：先降到底（×1 饱和）⇒ 不依赖用户残留档位
    await wheel(120, 6)
    let snap = await ensureVisibleBar(cdp)
    expect(checks, 'HIT.zoom.base', '×1 档位归一（列数 48 / 格线 day-col-lines--30）', snap.ok && snap.meta.columns === COLUMNS_OF_ZOOM[1] && snap.meta.gridLines.includes('day-col-lines--30'), JSON.stringify(snap.ok ? snap.meta : snap))
    assertBarsAndBlank(checks, snap, 'zoom1')

    // 放大到 ×4（4 档：1 → 1.5 → 2 → 3 → 4）
    await wheel(-120, 4)
    snap = await ensureVisibleBar(cdp)
    expect(checks, 'HIT.zoom.x4', '×4 档位（列数 288 / 格线 day-col-lines--5）', snap.ok && snap.meta.columns === COLUMNS_OF_ZOOM[4] && snap.meta.gridLines.includes('day-col-lines--5'), JSON.stringify(snap.ok ? snap.meta : snap))
    assertBarsAndBlank(checks, snap, 'zoom4')

    // 复位 ×1（不留用户偏好）
    await wheel(120, 6)
    const back = await collect(cdp)
    expect(checks, 'HIT.zoom.restore', '跑完复位 ×1（列数 48，不留档位偏好）', back.ok && back.meta.columns === COLUMNS_OF_ZOOM[1], JSON.stringify(back.ok ? back.meta : back))
    return checks
}

/** cleanup：受控夹具清理（按前缀 API DELETE）+ 同步收口 */
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
        return { targets: targets.length, deleted, remain }
    })()`)
    info(checks, 'CLEANUP.info', '[QA-DAYHIT] 清理（仅当本轮创建过夹具）', JSON.stringify({ ...result, fixture: runState.fixture }))
    expect(checks, 'CLEANUP.a', '`[QA-DAYHIT]` 任务已清空（API 口径）', result.remain === 0, `targets=${result.targets} remain=${result.remain}`)
    const idle = await cdp.evaluate(`
        for (let i = 0; i < 40; i++) {
            const btn = document.querySelector('.sync-rail-btn')
            if (btn && !btn.disabled) return true
            await new Promise((r) => setTimeout(r, 500))
        }
        return false
    `)
    expect(checks, 'CLEANUP.b', '同步收口（0 pending / 0 failed）', idle === true, `idle=${idle}`)
    return checks
}

export const dayViewHit = {
    id: 'day-view',
    title: '日视图真实命中抽检（固化 ADR C12：覆盖层不得吞命中 / 条·手柄·刻度·全天条可命中）',
    groups: [
        { id: 'setup', title: '导航日视图 + 保证 ≥1 日内任务条（无数据 ⇒ SKIP，绝不 PASS）', run: setup },
        { id: 'overlay', title: '覆盖层 pointer-events（.day-axis-track / .day-edge-fade 等，C12 硬约束）', run: overlay },
        { id: 'bars', title: '日内任务条命中（中点 / 条体左内侧 / 左缘归属手柄）', run: bars },
        { id: 'handles', title: '两侧手柄恒在且可命中（含续接段）', run: handles },
        { id: 'blank', title: '空白命中非任务条，且命中层为 .day-grid（非 .day-axis-track）', run: blank },
        { id: 'allday', title: '全天泳道命中 + 只读（无手柄）', run: allday },
        { id: 'ticks', title: '刻度标签（原生 button）命中', run: ticks },
        { id: 'zoom', title: '×1 与 ×4 两档各跑一遍 bars/blank + 复位', run: zoom },
        { id: 'cleanup', title: '受控数据清理（[QA-DAYHIT] + 0 pending/0 failed）', run: cleanup }
    ]
}
