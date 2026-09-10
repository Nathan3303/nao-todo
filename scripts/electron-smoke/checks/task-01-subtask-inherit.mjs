/**
 * TASK-01 冒烟检查集：子任务创建继承父任务的 `projectId` / `startAt` / `endAt` —— **脚手架（scaffold）**
 *
 * ⚠️ 状态：实现落点 `packages/presentation/task/components/task-details/use-subtasks.ts` 由 rd-fe 修改中，
 * 架构可能把落点下沉领域层 ⇒ **等 PM 发冻结基线（hash 表 + 逐条口径）后再跑**。
 * 现阶段只搭结构；锚点若与实测不符，**只改本文件 ANCHORS 一处**（沿用既有工作流：先 `--only case1` 校准锚点）。
 *
 * ── 可观测路径（PM 要求写清：选择 + 理由）────────────────────────────
 * **主路径 = ② Pinia store 读回**：页内遍历 pinia 全部 store 的 state，收集形如 `Map<id, TaskViewObject>`
 *   的值（`useTasksStoreBase` 用 `ref(new Map())` 存任务，见 `packages/shared/**\/use-mapper-store-base.ts`），
 *   直接读取 `projectId / startAt / endAt / parentTaskId`。
 *   理由：本单判定是**字段级相等（相对比较）**，只有 VO 能给出精确值；UI 只给"今天/明天"等格式化文本，
 *   无法稳定做相等断言；且该路径**不依赖服务端同步**（本地写入即可读），比接口读回更快更稳。
 * **兜底 = ① HTTP 读回**：`GET /tasks/{id}` 与 `GET /tasks/?parentTaskId=<id>`（见
 *   `packages/infrastructure/src/persistence-go/task/task-repo-impl.ts:35/139`）。仅在 store 读不到时启用，
 *   并在报告里标注"经服务端（需同步完成）"，与主路径结论区分。
 * **补充 = ③ UI 呈现**：仅用于 case3 的"同呈逾期"与 case4 的"所属清单"呈现语义（DOM 文本/类名），
 *   作为呈现层证据，不替代字段相等断言。
 *
 * ── 判定口径（PM 写死）──────────────────────────────────────────────
 * - 断言一律**父子字段相等**（相对比较），**禁止硬编码具体日期值**；
 * - **快照语义**：创建子任务后再改父任务（清单/时间窗）⇒ 已存在子任务**必须不变**（case1 追加步骤）；
 * - **不判缺陷**：`apps/mobile` 未同步修（范围外）、存量数据不回填、无继承提示 UI（D6）。
 *
 * ── 断言前提（**防后人踩坑，勿删**）──────────────────────────────────
 * **"父子字段相等"成立的前提**：`CreateTaskValueObject.fillStartAt()` 为**死方法**
 *   （`packages/domain-task/**\/create-task.ts:98`，全仓**零调用点**）⇒ 仅 `endAt` 的父任务，父子 `startAt`
 *   都是 `null`，故 4 例均可统一用"相等"断言。
 * ⚠️ 若将来**启用**该派生（仅 `endAt` 的任务把 `startAt` 派生为创建时间/结束前一分钟），则**"仅 endAt"场景**
 *   的 `startAt` 相等断言**必须改为**：`child.startAt` 非空 **且** `child.startAt <= child.endAt`。
 *
 * 继承规则（架构口径）= **以 `endAt` 为锚**：仅 `startAt` / `start > end` / 无效时间 ⇒ 子任务**两者皆 null**。
 *
 * ── 范围边界 ────────────────────────────────────────────────────────
 * 以下两场景**由 rd-fe 单测覆盖、实机不构造**（脚手架报告登记，不判 FAIL）：
 * 1. 「父任务 VO 缺失 ⇒ 三字段 null」的防御语义（PM seq 57）。
 * 2. **仅 `startAt` 父任务 / `start > end` / 无效时间 ⇒ 子任务两者皆 null**（边界 U3，PM seq 60；
 *    实机经 UI 构造"仅 startAt"的父任务难度高，故不做）。
 *
 * ── 受控数据纪律（沿用上一轮）────────────────────────────────────────
 * 仅创建本任务必需实体（父任务 / 子任务 / 必要时 1 个自定义清单），标题统一前缀 `[QA-TASK01]`，
 * 跑完删除并在报告登记；删除后核验 `0 pending / 0 failed`。
 */
/** 待实测校准的锚点（W: 基线到手后先跑一次快照校准，只改这里） */
const ANCHORS = {
    taskTitlePrefix: '[QA-TASK01]',
    /** 任务创建器（已验证可用） */
    creatorDialog: '.nue-dialog--task-creator',
    creatorTitleInput: 'input[placeholder="待办事项名称"]',
    creatorSaveText: ['创建', '保存'],
    /** 任务详情抽屉 */
    detailsDrawer: '.nue-drawer',
    /** 子任务输入框：精确文案 = `task.details.subTaskNamePlaceholder`（zh：请输入子任务名称），
     *  见 `task-details/main/subtasks.vue:219`；保留文案族做兜底 */
    subTaskInputPlaceholders: ['输入子任务名称', '子任务', '待办事项名称'],
    subTaskAddTexts: ['添加', '新增', '确定', '↵'],
    /** 清单选择（创建器内下拉；文案族兜底） */
    projectPickerTexts: ['收集箱', '清单', '待办'],
    /** 时间设置：创建器内置 `TaskDateSelector`（`dialogs/creator/creator.vue:12`）；
     *  详情页编辑入口 = header 的 `TaskDateSelector`（`task-details/header/index.vue:3`）——
     *  该组件内唯一 `isBefore` 是**逾期样式**判断（`date-selector/task-date-selector.vue:28`），未见禁用过去日期 */
    timeSetupTexts: ['设置时间', '选择开始时间', '选择截止时间'],
    /** 快照语义第 2 步：改父任务清单 = 详情页 footer 的 `TaskProjectSelector`
     *  （`task-details/footer/index.vue:77` 一带；footer 另有「更多」nue-dropdown） */
    detailsFooterProjectTrigger: ['收集箱', '清单', '所属清单'],
    /** 逾期呈现（UI 证据用） */
    overdueMarkers: ['已过期', '逾期', '过期', 'overdue'],
    /** 未安排呈现 */
    unscheduledMarkers: ['未安排', '无日期', '未设置']
}

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

/**
 * 页面内：从 pinia 收集所有任务型 VO（主路径 ②）
 * @description 遍历 `pinia.state.value`，深度受限地扫描 Map / 数组 / 对象；把"id + name + 至少一个
 *              任务字段(projectId|startAt|endAt|parentTaskId)"的对象视为 TaskViewObject
 */
const COLLECT_TASKS = `
    const app = document.getElementById('app')
    const pinia = app && app.__vue_app__ && app.__vue_app__.config.globalProperties.$pinia
    if (!pinia) return { ok: false, reason: '未取到 pinia 实例（app.__vue_app__ 不可用）' }
    const found = new Map()
    const seen = new Set()
    const isTaskVO = (node) =>
        node && typeof node === 'object' && !Array.isArray(node) &&
        typeof node.id === 'string' && typeof node.name === 'string' &&
        ('projectId' in node || 'startAt' in node || 'endAt' in node || 'parentTaskId' in node)
    const walk = (node, depth) => {
        if (!node || typeof node !== 'object' || depth > 6) return
        if (seen.has(node)) return
        seen.add(node)
        if (node instanceof Map) {
            for (const value of node.values()) {
                if (isTaskVO(value)) found.set(value.id, value)
                else walk(value, depth + 1)
            }
            return
        }
        if (Array.isArray(node)) {
            for (const item of node) {
                if (isTaskVO(item)) found.set(item.id, item)
                else walk(item, depth + 1)
            }
            return
        }
        if (isTaskVO(node)) {
            found.set(node.id, node)
            return
        }
        for (const value of Object.values(node)) walk(value, depth + 1)
    }
    for (const storeState of Object.values(pinia.state.value || {})) walk(storeState, 0)
    const tasks = [...found.values()].map((task) => ({
        id: task.id,
        name: task.name,
        parentTaskId: task.parentTaskId ?? null,
        projectId: task.projectId ?? null,
        startAt: task.startAt ?? null,
        endAt: task.endAt ?? null,
        state: task.state ?? null,
        isDeleted: task.isDeleted ?? null
    }))
    return { ok: true, tasks }
`

const NORMALIZE_TS = (value) => (value ? new Date(value).getTime() : null)
const sameTime = (a, b) => NORMALIZE_TS(a) === NORMALIZE_TS(b)

/** 读取页内全部任务 VO（主路径 ②） */
async function readTasks(cdp) {
    const result = await cdp.json(`(() => { ${COLLECT_TASKS} })()`)
    return result
}

/** 兜底 ①：按 id / parentTaskId 经 HTTP 读回（需同步完成，仅作交叉核验） */
async function readTasksViaApi(cdp, parentTaskId) {
    return cdp.evaluate(`
        try {
            const jwt = localStorage.getItem('USER_JWT')
            const headers = { Authorization: 'Bearer ' + jwt }
            const res = await fetch('http://localhost:3302/api/tasks/?parentTaskId=' + ${JSON.stringify(parentTaskId)}, { headers })
            const body = await res.json()
            return JSON.stringify({ ok: true, raw: body?.data ?? null, code: body?.code ?? null })
        } catch (err) { return JSON.stringify({ ok: false, reason: String(err).slice(0, 80) }) }
    `)
}

/**
 * 创建任务（父任务）：走创建器 UI（键盘 n）
 * @param {object} cdp CDP 客户端
 * @param {{ title: string, scheduled?: boolean, overdue?: boolean }} options
 *        `scheduled=true` 会打开「设置时间」面板（排期/逾期场景）；**收集箱场景无需额外操作**
 *        （收集箱是创建器默认清单）——故不再单独传 `inbox`。
 * @returns {Promise<{ ok: boolean, task?: object, reason?: string }>}
 */
async function createTaskViaUi(cdp, { title, scheduled = false, overdue = false }) {
    await cdp.pressKey('n', 1500)
    const created = await cdp.json(`(async () => {
        const dialog = [...document.querySelectorAll('${ANCHORS.creatorDialog}')].find((d) => d.getBoundingClientRect().width > 0)
        if (!dialog) return { ok: false, reason: '任务创建器未打开' }
        const input = dialog.querySelector('${ANCHORS.creatorTitleInput}')
        if (!input) return { ok: false, reason: '未找到名称输入框（锚点变化？）' }
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(title)})
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 300))
        return { ok: true, dialogReady: true }
    })()`)
    if (!created.ok) return created
    // 时间/清单：本脚手架只做"尽力点选"（未排期=不点；排期/逾期=点「设置时间」并在日历里选一天）
    if (scheduled || overdue) {
        // 打开「设置时间」面板；日历具体选日待基线到手后按实测补齐（脚手架阶段不猜日历结构）
        await cdp.evaluate(`
            const dialog = [...document.querySelectorAll('${ANCHORS.creatorDialog}')].find((d) => d.getBoundingClientRect().width > 0)
            const btn = [...dialog.querySelectorAll('button')].find((b) => /设置时间/.test(b.innerText || ''))
            btn?.click()
            await new Promise((r) => setTimeout(r, 600))
            return !!btn
        `)
    }
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
    if (!saved.ok) return saved
    const tasks = await readTasks(cdp)
    const task = tasks.ok
        ? tasks.tasks.find((item) => item.name === title && !item.parentTaskId)
        : null
    return task
        ? { ok: true, task }
        : { ok: false, reason: `创建后在 store 未找到任务：${JSON.stringify(tasks).slice(0, 200)}` }
}

/** 为父任务创建子任务（走详情抽屉内的子任务输入） */
async function createSubTaskViaUi(cdp, { parentId, title }) {
    const opened = await cdp.evaluate(`
        const row = [...document.querySelectorAll('[class*="todo-table__main__row"], [class*="todo-list"] [class*="row"]')]
            .find((node) => (node.innerText || '').includes(${JSON.stringify(title)}))
        if (!row) return false
        row.click()
        await new Promise((r) => setTimeout(r, 1800))
        return !!document.querySelector('${ANCHORS.detailsDrawer}')
    `)
    if (!opened) return { ok: false, reason: '详情抽屉未打开（行锚点变化？）' }
    const filled = await cdp.json(`(async () => {
        const drawer = document.querySelector('${ANCHORS.detailsDrawer}')
        const inputs = [...drawer.querySelectorAll('input')]
        const input = inputs.find((node) => ${JSON.stringify(ANCHORS.subTaskInputPlaceholders)}.some((ph) => (node.placeholder || '').includes(ph)))
        if (!input) return { ok: false, reason: '未找到子任务输入框（锚点变化？）' }
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(title)})
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 300))
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        await new Promise((r) => setTimeout(r, 2500))
        return { ok: true }
    })()`)
    if (!filled.ok) return filled
    const tasks = await readTasks(cdp)
    const child = tasks.ok
        ? tasks.tasks.find((item) => item.name === title && item.parentTaskId === parentId)
        : null
    return child
        ? { ok: true, task: child }
        : { ok: false, reason: `创建后在 store 未找到子任务（parentTaskId=${parentId}）` }
}

/**
 * 详情页 header 的 `TaskDateSelector`：把父任务时间窗改为「过去」（case3 退路；`task-details/header/index.vue:3`）
 * @param {object} cdp CDP 客户端
 * @param {{ daysAgo?: number }} [options]
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function setParentDateViaDetailsHeader(cdp, options = {}) {
    const daysAgo = options.daysAgo ?? 7
    const opened = await cdp.evaluate(`
        const drawer = document.querySelector('${ANCHORS.detailsDrawer}')
        if (!drawer) return false
        const trigger = [...drawer.querySelectorAll('.nue-dropdown-wrapper button, button')]
            .find((b) => ${JSON.stringify(ANCHORS.timeSetupTexts)}.some((t) => (b.innerText || '').includes(t)))
        if (!trigger) return false
        trigger.click()
        await new Promise((r) => setTimeout(r, 800))
        return true
    `)
    if (!opened) return { ok: false, reason: '详情页未找到时间选择触发点（锚点待校准）' }
    // 日历选日：按"当前月内第 N 个可点日期单元"泛化匹配（具体结构待实测校准）
    const picked = await cdp.evaluate(`
        const cells = [...document.querySelectorAll('.nue-date-picker button, .nue-date-selector button, [class*="calendar"] button')]
            .filter((b) => /^\\d{1,2}$/.test((b.innerText || '').trim()) && b.getBoundingClientRect().width > 0)
        if (!cells.length) return false
        const target = cells[Math.max(0, cells.length - ${daysAgo})]
        target.click()
        await new Promise((r) => setTimeout(r, 1200))
        return true
    `)
    return picked ? { ok: true } : { ok: false, reason: '日历日期单元未找到（锚点待校准）' }
}

/**
 * 快照语义第 2 步：修改父任务的清单/时间窗（详情页 footer 清单 + header 时间）
 * @param {object} cdp CDP 客户端
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function mutateParentViaUi(cdp) {
    const dateResult = await setParentDateViaDetailsHeader(cdp, { daysAgo: 3 })
    if (!dateResult.ok) return { ok: false, reason: `改期失败：${dateResult.reason}` }
    const projectChanged = await cdp.evaluate(`
        const drawer = document.querySelector('${ANCHORS.detailsDrawer}')
        if (!drawer) return false
        const trigger = [...drawer.querySelectorAll('.nue-dropdown-wrapper button')]
            .find((b) => ${JSON.stringify(ANCHORS.detailsFooterProjectTrigger)}.some((t) => (b.innerText || '').includes(t)))
        if (!trigger) return false
        trigger.click()
        await new Promise((r) => setTimeout(r, 800))
        // 选第一个与当前不同的可选项（保持"改一下"语义，不依赖具体清单名）
        const items = [...document.querySelectorAll('ul.nue-dropdown li')].filter((li) => li.getBoundingClientRect().width > 0)
        const target = items.find((li) => !/收集箱/.test(li.innerText || '')) ?? items[0]
        if (!target) return false
        target.click()
        await new Promise((r) => setTimeout(r, 1500))
        return true
    `)
    return { ok: true, projectChanged }
}

/**
 * 单例断言：父子字段继承关系
 * @description 相对比较 ⇒ 不硬编码日期；子任务字段应等于父任务字段（NULL 也应相等）
 */
function assertInherit(
    checks,
    idPrefix,
    parent,
    child,
    { expectProject = true, expectTime = true } = {}
) {
    if (expectProject) {
        expect(
            checks,
            `${idPrefix}.projectId`,
            '子任务 projectId 与父任务相等（含同为 null）',
            parent.projectId === child.projectId,
            `parent=${JSON.stringify(parent.projectId)} child=${JSON.stringify(child.projectId)}`
        )
    }
    if (expectTime) {
        expect(
            checks,
            `${idPrefix}.startAt`,
            '子任务 startAt 与父任务相等（含同为 null）',
            sameTime(parent.startAt, child.startAt),
            `parent=${JSON.stringify(parent.startAt)} child=${JSON.stringify(child.startAt)}`
        )
        expect(
            checks,
            `${idPrefix}.endAt`,
            '子任务 endAt 与父任务相等（含同为 null）',
            sameTime(parent.endAt, child.endAt),
            `parent=${JSON.stringify(parent.endAt)} child=${JSON.stringify(child.endAt)}`
        )
    }
    expect(
        checks,
        `${idPrefix}.parentTaskId`,
        '子任务 parentTaskId 指向父任务',
        child.parentTaskId === parent.id,
        `child.parentTaskId=${JSON.stringify(child.parentTaskId)} parent.id=${parent.id}`
    )
}

/** CASE 1：已排期父任务（自定义清单 + 完整时间窗）⇒ 继承 + 快照语义 */
async function case1(ctx) {
    const { cdp } = ctx
    const checks = []
    const title = `${ANCHORS.taskTitlePrefix} 已排期父任务`
    if (ctx.state.setupNotes?.length)
        info(checks, 'CASE1.setup', '创建器交互记录', JSON.stringify(ctx.state.setupNotes))
    const parent = await createTaskViaUi(cdp, { title, scheduled: true })
    if (!parent.ok)
        return skip(
            checks,
            'CASE1',
            '已排期父任务 ⇒ 子任务继承清单+时间窗',
            `数据构造失败：${parent.reason}（待锚点校准；不判 FAIL）`
        )
    info(checks, 'CASE1.parent', '父任务 VO', JSON.stringify(parent.task))
    const child = await createSubTaskViaUi(cdp, {
        parentId: parent.task.id,
        title: `${title} - 子任务`
    })
    if (!child.ok)
        return skip(checks, 'CASE1.child', '子任务创建', `失败：${child.reason}（待锚点校准）`)
    info(checks, 'CASE1.child', '子任务 VO', JSON.stringify(child.task))
    assertInherit(checks, 'CASE1.inherit', parent.task, child.task)
    // 快照语义：改父任务（详情页 footer 清单 + header 时间窗）⇒ 已存在子任务必须不变
    const mutated = await mutateParentViaUi(cdp)
    info(checks, 'CASE1.snapshot', '快照语义：修改父任务（清单/时间窗）', JSON.stringify(mutated))
    const after = await readTasks(cdp)
    const afterChild = after.ok ? after.tasks.find((item) => item.id === child.task.id) : null
    if (afterChild) {
        expect(
            checks,
            'CASE1.snapshot.keep',
            '修改父任务后，已存在子任务字段不变（快照语义）',
            sameTime(afterChild.startAt, child.task.startAt) &&
                sameTime(afterChild.endAt, child.task.endAt) &&
                afterChild.projectId === child.task.projectId,
            `before=${JSON.stringify(child.task)} after=${JSON.stringify(afterChild)}`
        )
    } else {
        skip(
            checks,
            'CASE1.snapshot.keep',
            '修改父任务后子任务不变',
            `未读到子任务或父任务编辑未生效（mutated=${JSON.stringify(mutated)}；待锚点校准）`
        )
    }
    return checks
}

/** CASE 2：未排期父任务 ⇒ 子任务"未安排"（行为变更点：现状落到"今天"） */
async function case2(ctx) {
    const { cdp } = ctx
    const checks = []
    const title = `${ANCHORS.taskTitlePrefix} 未排期父任务`
    const parent = await createTaskViaUi(cdp, { title, scheduled: false })
    if (!parent.ok)
        return skip(
            checks,
            'CASE2',
            '未排期父任务 ⇒ 子任务未安排',
            `数据构造失败：${parent.reason}（待锚点校准；不判 FAIL）`
        )
    info(
        checks,
        'CASE2.parent',
        '父任务 VO（应 startAt/endAt 均为 null）',
        JSON.stringify(parent.task)
    )
    const child = await createSubTaskViaUi(cdp, {
        parentId: parent.task.id,
        title: `${title} - 子任务`
    })
    if (!child.ok)
        return skip(checks, 'CASE2.child', '子任务创建', `失败：${child.reason}（待锚点校准）`)
    info(checks, 'CASE2.child', '子任务 VO', JSON.stringify(child.task))
    assertInherit(checks, 'CASE2.inherit', parent.task, child.task)
    expect(
        checks,
        'CASE2.unscheduled',
        '子任务 startAt/endAt 均为 null（不再落到"今天"）',
        child.task.startAt === null && child.task.endAt === null,
        `child.startAt=${JSON.stringify(child.task.startAt)} child.endAt=${JSON.stringify(child.task.endAt)}（行为变更点）`
    )
    const ui = await cdp.json(`(() => {
        const text = (document.body ? document.body.innerText : '') || ''
        return { unscheduled: ${JSON.stringify(ANCHORS.unscheduledMarkers)}.some((m) => text.includes(m)) }
    })()`)
    info(checks, 'CASE2.ui', 'UI 是否出现"未安排"类文案（补充证据）', JSON.stringify(ui))
    return checks
}

/** CASE 3：逾期父任务（endAt 在过去）⇒ 子任务照抄同日期、同呈逾期 */
async function case3(ctx) {
    const { cdp } = ctx
    const checks = []
    const title = `${ANCHORS.taskTitlePrefix} 逾期父任务`
    const parent = await createTaskViaUi(cdp, { title, scheduled: true, overdue: true })
    if (!parent.ok)
        return skip(
            checks,
            'CASE3',
            '逾期父任务 ⇒ 子任务同日期同逾期',
            `数据构造失败：${parent.reason}（待锚点校准；不判 FAIL）`
        )
    let parentTask = parent.task
    if (!parentTask.endAt) {
        // 退路（PM seq 57）：创建器若拦过去日期 ⇒ 用详情页 header 的 TaskDateSelector 改为过去
        const fallback = await setParentDateViaDetailsHeader(cdp, { daysAgo: 7 })
        info(
            checks,
            'CASE3.fallback',
            '创建器未落下过去日期 → 详情页 header 改期（退路）',
            JSON.stringify(fallback)
        )
        const refreshed = await readTasks(cdp)
        const updated = refreshed.ok
            ? refreshed.tasks.find((item) => item.id === parent.task.id)
            : null
        if (updated) parentTask = updated
    }
    info(checks, 'CASE3.parent', '父任务 VO', JSON.stringify(parentTask))
    const child = await createSubTaskViaUi(cdp, {
        parentId: parentTask.id,
        title: `${title} - 子任务`
    })
    if (!child.ok)
        return skip(checks, 'CASE3.child', '子任务创建', `失败：${child.reason}（待锚点校准）`)
    assertInherit(checks, 'CASE3.inherit', parentTask, child.task)
    const overtime = await cdp.json(`(() => {
        const text = (document.body ? document.body.innerText : '') || ''
        return { markers: ${JSON.stringify(ANCHORS.overdueMarkers)}.some((m) => text.includes(m)) }
    })()`)
    expect(
        checks,
        'CASE3.overdue.ui',
        '子任务行/详情呈逾期（UI 证据，补充断言）',
        overtime.markers === true,
        JSON.stringify(overtime)
    )
    return checks
}

/** CASE 4：收集箱父任务 ⇒ 子任务也在收集箱（清单部分保持现状） */
async function case4(ctx) {
    const { cdp } = ctx
    const checks = []
    const title = `${ANCHORS.taskTitlePrefix} 收集箱父任务`
    const parent = await createTaskViaUi(cdp, { title, inbox: true })
    if (!parent.ok)
        return skip(
            checks,
            'CASE4',
            '收集箱父任务 ⇒ 子任务同收集箱',
            `数据构造失败：${parent.reason}（待锚点校准；不判 FAIL）`
        )
    info(checks, 'CASE4.parent', '父任务 VO', JSON.stringify(parent.task))
    const child = await createSubTaskViaUi(cdp, {
        parentId: parent.task.id,
        title: `${title} - 子任务`
    })
    if (!child.ok)
        return skip(checks, 'CASE4.child', '子任务创建', `失败：${child.reason}（待锚点校准）`)
    assertInherit(checks, 'CASE4.inherit', parent.task, child.task, { expectTime: false })
    return checks
}

/** 兜底路径冒烟（不判定功能，仅证明 ① 可用）：有子任务时用 HTTP 读回交叉核验 */
async function apiCrossCheck(ctx) {
    const { cdp } = ctx
    const checks = []
    const tasks = await readTasks(cdp)
    if (!tasks.ok)
        return skip(checks, 'API', 'HTTP 读回交叉核验', `pinia 读取失败：${tasks.reason}`)
    const anyParent = tasks.tasks.find((item) =>
        tasks.tasks.some((child) => child.parentTaskId === item.id)
    )
    if (!anyParent)
        return skip(
            checks,
            'API',
            'HTTP 读回交叉核验',
            '尚未构造出父子任务（本组依赖 case1–case4 已跑）'
        )
    const api = await readTasksViaApi(cdp, anyParent.id)
    info(
        checks,
        'API',
        'HTTP 读回（兜底路径 ① —— **经服务端、需同步完成**，结论强度弱于主路径 ②，仅作交叉核验）',
        api
    )
    return checks
}

export const task01SubtaskInherit = {
    id: 'task-01',
    title: 'TASK-01 子任务继承父任务 projectId/startAt/endAt',
    pending: 'TASK-01 实现（use-subtasks.ts）与架构落点结论冻结后，由 PM 派发正式运行',
    groups: [
        { id: 'case1', title: 'CASE1 已排期父任务 ⇒ 继承清单+时间窗（含快照语义）', run: case1 },
        { id: 'case2', title: 'CASE2 未排期父任务 ⇒ 子任务未安排（行为变更点）', run: case2 },
        { id: 'case3', title: 'CASE3 逾期父任务 ⇒ 同日期 + 同呈逾期', run: case3 },
        { id: 'case4', title: 'CASE4 收集箱父任务 ⇒ 同收集箱', run: case4 },
        { id: 'api', title: '兜底路径 ① HTTP 读回交叉核验（不判定功能）', run: apiCrossCheck }
    ]
}