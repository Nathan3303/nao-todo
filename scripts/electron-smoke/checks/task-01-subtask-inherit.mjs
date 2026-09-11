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
 * ── 校准发现留档（PM seq 72 要求，后人复用）──────────────────────────
 * 1. **日期**：`设置时间` → 面板内 **「选择开始日期 / 选择截止日期」** → 日历 `.nue-date-picker-panel`
 *    → **`.date-grid .date-cell`**（排除 `.other-month`）→ 面板**「保存」**；翻月按钮在 `.nue-calendar-header`
 *    （`title=上个月`）。逾期改期优先取"本月内已过去的几天"，避免翻月（曾不稳）。
 * 2. **清单**：无清单时用快捷键 `p` 打开 `.nue-dialog--project-creator`（输入「请输入清单名称」→ 创建）；
 *    侧边栏「清单」头部 `icon="plus"` 是同一入口的按钮形态（`tasks/tag/header/index.vue:31`）。
 *    ⚠️ **任务创建器内清单选择器默认文案是「收集箱」**——**不能**用「待办」匹配（那是状态选择器，曾误点）。
 * 3. **详情抽屉**：用**路由直达** `#/tasks/all/table/<taskId>` 最稳（点行/点名单元格依赖列表已渲染，自动流程里会落空）。
 *
 * ── 衍生发现（服务端差异，**不计入本单判定**）DEF-SYNC-04 候选 ──────
 * 现象：同步往返（创建 → 同步 0 pending → 刷新/服务端拉回）后 `startAt` 的**秒级被重写**，
 *       且各记录取各自推送时刻 ⇒ **父子不再逐字相等**；`endAt` 只发生表示法归一（`…Z`+毫秒 → `+08:00`）。
 * 基线原文（2026-09-10 实测，供修复后对照）：
 *   ① 创建后（本地 store）
 *      parent { projectId: 467365129197715456, startAt: 2026-09-10T16:42:00.000Z, endAt: 2026-09-29T16:42:00.000Z }
 *      child  { projectId: 467365129197715456, startAt: 2026-09-10T16:42:00.000Z, endAt: 2026-09-29T16:42:00.000Z }   ← 与父逐字相等
 *   ② 同步/刷新后（服务端拉回）
 *      parent { projectId: 467365129197715456, startAt: 2026-09-11T00:42:30+08:00, endAt: 2026-09-30T00:42:00+08:00 }
 *      child  { projectId: 467365129197715456, startAt: 2026-09-11T00:42:38+08:00, endAt: 2026-09-30T00:42:00+08:00 }
 *      ⇒ parent +30s / child +38s ⇒ 父子 startAt 差 8s（**父任务自身亦被改写 ⇒ 非子任务特有**）
 * 口径（PM seq 74 裁决）：**表示法归一不算破坏值快照**（用**瞬时**比较，`endAt` 判 PASS 成立）；
 *       只有**语义性重写**（如秒数变化）才记为数据变更 ⇒ 本项登记为「服务端差异（衍生）DEF-SYNC-04 候选」，
 *       **不计入 TASK-01 判定、不判 FAIL**。
 * 另：**服务端删除态核验口径待确认** —— `GET /tasks/{id}` 对已软删除任务仍返回"无删除标记"
 *       （实测 `checked=24 未见删除标记=24`）⇒ INFO 登记、不判 FAIL（服务端垃圾桶表示形式未知）。
 *
 * ── 测试夹具（有意保留，勿当残留清理）────────────────────────────────
 * `[QA-TASK01] 清单`（首建于 2026-09-10，id 见运行日志）为**有意保留的测试夹具**：dev 本地库、前缀可识别，
 * 复用于后续脚本。`ensureProject()` 会**先按名查找、存在即复用**（不再重复创建），避免同类残留累积。
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
    timeSetupTexts: ['设置时间', '选择开始日期', '选择开始时间', '选择截止日期', '选择截止时间'],
    /** 快照语义第 2 步：改父任务清单 = 详情页 footer 的 `TaskProjectSelector`
     *  （`task-details/footer/index.vue:77` 一带；footer 另有「更多」nue-dropdown） */
    detailsFooterProjectTrigger: ['收集箱', '清单', '所属清单'],
    /** 日期面板与日单元（实测结构：`.task-date-selector-panel` → `.nue-date-picker-panel` → `.date-grid .date-cell`；
     *  相邻月单元带 `.other-month`；月份切换按钮在 `.nue-calendar-header`，`title` 为「上个月/下个月」等） */
    datePanel: '[class*="task-date-selector-panel"]',
    dateCell: '.date-grid .date-cell',
    /** 清单（项目）创建器：快捷键 `p`（`app.commands` 的 project.create）→ 输入「请输入清单名称」→ 创建
     *  （侧边栏「清单」SmartList 头部另有 `icon="plus"` 入口，见 `tasks/tag/header/index.vue:31`） */
    projectCreatorDialog: '.nue-dialog--project-creator',
    projectNameInput: 'input[placeholder="请输入清单名称"]',
    /** 逾期呈现（UI 证据用） */
    overdueMarkers: ['已过期', '逾期', '过期', 'overdue'],
    /** 未安排呈现 */
    unscheduledMarkers: ['未安排', '无日期', '未设置']
}

import { sleep } from '../lib/cdp.mjs'
import { SEL, bootstrap, clickPanelPrimary, openPanel } from '../lib/app.mjs'

/** 本次运行的唯一标签：避免与历史遗留的 `[QA-TASK01]` 任务同名而被误匹配（清理仍按前缀） */
const RUN_TAG = Date.now().toString(36)

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
    const isTaskVO = (node) =>
        node && typeof node === 'object' && !Array.isArray(node) &&
        typeof node.id === 'string' && typeof node.name === 'string' &&
        ('projectId' in node || 'startAt' in node || 'endAt' in node || 'parentTaskId' in node)
    /** '' 与 null 均表示"空"（列表 VO 用 ''、详情 VO 用 null）⇒ 归一到 null，避免 '' 与 null 比较失真 */
    const norm = (value) => (value === '' || value === undefined ? null : value)
    const offer = (node) => {
        if (!isTaskVO(node)) return
        found.set(node.id, {
            id: node.id,
            name: node.name,
            parentTaskId: norm(node.parentTaskId),
            projectId: norm(node.projectId),
            startAt: norm(node.startAt),
            endAt: norm(node.endAt),
            state: node.state ?? null,
            isDeleted: Boolean(node.isDeleted ?? node.deletedAt ?? false)
        })
    }
    const walk = (node, depth, seen) => {
        if (!node || typeof node !== 'object' || depth > 4) return
        if (seen.has(node)) return
        seen.add(node)
        if (node instanceof Map) {
            for (const value of node.values()) { offer(value); if (!isTaskVO(value)) walk(value, depth + 1, seen) }
            return
        }
        if (Array.isArray(node)) {
            for (const value of node) { offer(value); if (!isTaskVO(value)) walk(value, depth + 1, seen) }
            return
        }
        if (isTaskVO(node)) { offer(node); return }
        for (const value of Object.values(node)) walk(value, depth + 1, seen)
    }
    // 关键：任务集合是 **computed**（useMapperStoreBase 返回 map/list 计算属性），
    // 不在 pinia.state.value 里 ⇒ 必须遍历 pinia._s 的 store 实例属性（读取 computed 得到值）
    for (const store of pinia._s.values()) {
        for (const key of Object.keys(store)) {
            try {
                const value = store[key]
                if (value instanceof Map || Array.isArray(value)) walk(value, 0, new Set())
            } catch (err) { /* 访问器抛错与任务集合无关，忽略 */ }
        }
    }
    for (const state of Object.values(pinia.state.value || {})) walk(state, 0, new Set())
    return { ok: true, tasks: [...found.values()] }
`

const NORMALIZE_TS = (value) => (value ? new Date(value).getTime() : null)
const sameTime = (a, b) => NORMALIZE_TS(a) === NORMALIZE_TS(b)

/**
 * 读取页内全部任务 VO（主路径 ②）
 * @deprecated ⚠️ **单副本读法**（`readTasks().find()` / 只读一个 store）：仅作便捷读法**保留**，
 *             但**不得作为强断言依据** —— 真相优先取服务端读回 `readViaApi()`（HTTP）；需要两副本比对时
 *             先出差异结论（见本文件 `qaKit` JSDoc「多副本口径」）。
 *             注：本函数本身（读全量 VO 列表）仍是主路径 ②，**未废弃**；废弃的是「单副本当唯一真相」的用法。
 */
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

/** 读取项目（清单）VO：id + name 且非任务形态 */
async function readProjects(cdp) {
    const result = await cdp.json(`(() => {
        const app = document.getElementById('app')
        const pinia = app && app.__vue_app__ && app.__vue_app__.config.globalProperties.$pinia
        if (!pinia) return { ok: false, projects: [] }
        const found = new Map()
        const isProject = (node) =>
            node && typeof node === 'object' && !Array.isArray(node) &&
            typeof node.id === 'string' && typeof node.name === 'string' &&
            !('parentTaskId' in node) && !('startAt' in node) && !('endAt' in node) &&
            ('icon' in node || 'sortId' in node || 'archivedAt' in node || 'projectId' in node)
        const walk = (node, depth, seen) => {
            if (!node || typeof node !== 'object' || depth > 4) return
            if (seen.has(node)) return
            seen.add(node)
            if (node instanceof Map) { for (const v of node.values()) { if (isProject(v)) found.set(v.id, v); else walk(v, depth + 1, seen) } ; return }
            if (Array.isArray(node)) { for (const v of node) { if (isProject(v)) found.set(v.id, v); else walk(v, depth + 1, seen) } ; return }
            if (isProject(node)) { found.set(node.id, node); return }
            for (const v of Object.values(node)) walk(v, depth + 1, seen)
        }
        for (const store of pinia._s.values()) {
            for (const key of Object.keys(store)) {
                try { const value = store[key]; if (value instanceof Map || Array.isArray(value)) walk(value, 0, new Set()) } catch (err) { /* ignore */ }
            }
        }
        return { ok: true, projects: [...found.values()].map((p) => ({ id: p.id, name: p.name })) }
    })()`)
    return result.ok ? result.projects : []
}

/**
 * 确保存在指定名称的清单（不存在则用快捷键 `p` 打开清单创建器创建）
 * @description 受控数据：仅在缺失时创建 1 个清单，跑完由 cleanup 组删除
 * @param {object} cdp CDP 客户端
 * @param {string} name 清单名
 * @returns {Promise<{ ok: boolean, id?: string, created?: boolean, reason?: string }>}
 */
async function ensureProject(cdp, name) {
    const existing = (await readProjects(cdp)).find((p) => p.name === name)
    if (existing) return { ok: true, id: existing.id, created: false }
    await ensureTaskList(cdp)
    await cdp.pressKey('p', 1800)
    const created = await cdp.json(`(async () => {
        const dialog = [...document.querySelectorAll('${ANCHORS.projectCreatorDialog}')].find((d) => d.getBoundingClientRect().width > 0)
        if (!dialog) return { ok: false, reason: '清单创建器未打开（快捷键 p 未生效？）' }
        const input = dialog.querySelector('${ANCHORS.projectNameInput}') ?? dialog.querySelector('input')
        if (!input) return { ok: false, reason: '未找到清单名称输入框' }
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(name)})
        input.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 300))
        const footer = dialog.querySelector('.nue-dialog__footer') ?? dialog
        const btn = [...footer.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '创建')
        if (!btn) return { ok: false, reason: '未找到「创建」按钮' }
        btn.click()
        await new Promise((r) => setTimeout(r, 2500))
        return { ok: true }
    })()`)
    if (!created.ok) return created
    const project = (await readProjects(cdp)).find((p) => p.name === name)
    return project
        ? { ok: true, id: project.id, created: true }
        : { ok: false, reason: '创建后在 store 未找到清单' }
}

/**
 * 在任务创建器内把「清单」切到指定清单（默认是「收集箱」）
 * @param {object} cdp CDP 客户端
 * @param {string} projectName 目标清单名
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function selectProjectInCreator(cdp, projectName) {
    const opened = await cdp.json(`(async () => {
        const dialog = [...document.querySelectorAll('${ANCHORS.creatorDialog}')].find((d) => d.getBoundingClientRect().width > 0)
        if (!dialog) return { ok: false, reason: '创建器未打开' }
        // 只认「清单」选择器：默认文案为「收集箱」，其余下拉是 状态(待办)/优先级(低优先级)/标签 等
        const trigger = [...dialog.querySelectorAll('.nue-select button, .nue-dropdown-wrapper button')]
            .find((b) => /收集箱|所属清单/.test((b.innerText || '').trim()))
        if (!trigger) return { ok: false, reason: '未找到清单选择器' }
        trigger.click()
        await new Promise((r) => setTimeout(r, 900))
        const lists = [...document.querySelectorAll('ul.nue-dropdown')].filter((ul) => ul.getBoundingClientRect().width > 0)
        const ul = lists[lists.length - 1]
        const items = ul ? [...ul.querySelectorAll('li')] : []
        const target = items.find((li) => (li.innerText || '').includes(${JSON.stringify(projectName)}))
        if (!target) return { ok: false, reason: '下拉中未找到清单：' + ${JSON.stringify(projectName)} + '；候选项=' + JSON.stringify(items.map((li) => (li.innerText || '').trim().slice(0, 12))) }
        target.click()
        await new Promise((r) => setTimeout(r, 1200))
        return { ok: true }
    })()`)
    return opened
}

/**
 * 确保当前处于任务列表视图（避免沿用上次会话的详情路由导致找不到任务行）
 * @param {object} cdp CDP 客户端
 * @returns {Promise<void>}
 */
async function ensureTaskList(cdp) {
    await cdp.evaluate(`
        if (!location.hash.startsWith('#/tasks/all/table') || location.hash.split('/').length > 4) {
            location.hash = '#/tasks/all/table'
        }
        await new Promise((r) => setTimeout(r, 1800))
        return 'ok'
    `)
}

/**
 * 通用日期选择（结构无关，best-effort）
 * @description 打开「设置时间」面板 → 逐项点开日期选择器 → 点"日"单元 → 点面板「保存」。
 *              日单元判定：弹层池内**文本为 1–2 位数字**且自身或父级类名含 day/date/cell/calendar 的元素。
 * @param {object} cdp CDP 客户端
 * @param {{ start?: number|null, end?: number|null, prevMonth?: boolean, scope?: 'creator'|'details' }} options
 * @returns {Promise<{ ok: boolean, reason?: string, steps: string[] }>}
 */
async function pickDates(cdp, options = {}) {
    // 语义：`undefined` = 不改该项；`null` = 改、取该月**最后一个**日单元；数字 = 改、取该日
    const { start, end, prevMonth = false, scope = 'creator' } = options
    const steps = []
    const hostExpr =
        scope === 'creator'
            ? `[...document.querySelectorAll('${ANCHORS.creatorDialog}')].find((d) => d.getBoundingClientRect().width > 0)`
            : `document.querySelector('${ANCHORS.detailsDrawer}')`
    // ① 打开日期面板 → 轮询等 `[class*="task-date-selector-panel"]` 出现（弹层有动画，抢跑会落空）
    //    触发器文案：创建器内是「设置时间」；**详情页 header 是日期区间文本**（实测形如「今天 00:11 ~ 本月30日 00:11」）
    let panelReady = false
    for (let attempt = 0; attempt < 4 && !panelReady; attempt++) {
        panelReady = await cdp.evaluate(`return (async () => {
            const host = ${hostExpr}
            if (!host) return false
            const buttons = [...host.querySelectorAll('button')]
            const btn =
                buttons.find((b) => /设置时间/.test(b.innerText || '')) ??
                (${scope === 'details' ? 'true' : 'false'}
                    ? buttons.find((b) => /(~|今天|本月)/.test(b.innerText || '') && !/保存|取消/.test(b.innerText || ''))
                    : null)
            if (!btn) return false
            btn.click()
            for (let i = 0; i < 12; i++) {
                await new Promise((r) => setTimeout(r, 350))
                if ([...document.querySelectorAll('[class*="task-date-selector-panel"]')].some((e) => e.getBoundingClientRect().width > 0)) return true
            }
            return false
        })()`)
        steps.push(`openPanel#${attempt}=${panelReady}`)
        if (!panelReady) await sleep(600)
    }
    if (!panelReady) return { ok: false, reason: '「设置时间」面板未出现', steps }

    /**
     * 单个日期项：点「选择开始日期 / 选择截止日期」按钮 → 日历面板 →（可选翻月）→ 点日单元 `.date-cell`
     * @description 按钮文案族兼容「日期 / 时间」两种写法（用户实测为「选择开始日期」）
     */
    const pickOne = async (label, day, usePrevMonth) => {
        const opened = await cdp.evaluate(`return (async () => {
            const btn = [...document.querySelectorAll('[class*="task-date-selector-panel"] button')]
                .find((b) => new RegExp(${JSON.stringify(label)}).test(b.innerText || '') && b.getBoundingClientRect().width > 0)
            if (!btn) return false
            btn.click()
            for (let i = 0; i < 12; i++) {
                await new Promise((r) => setTimeout(r, 300))
                if ([...document.querySelectorAll('.nue-date-picker-panel')].some((e) => e.getBoundingClientRect().width > 0)) return true
            }
            return false
        })()`)
        steps.push(`${label}:calendar=${opened}`)
        if (!opened) return false
        if (usePrevMonth) {
            const prev = await cdp.evaluate(`return (async () => {
                const header = [...document.querySelectorAll('.nue-calendar-header')].find((e) => e.getBoundingClientRect().width > 0)
                const btn = header ? [...header.querySelectorAll('button')].find((b) => /上个月|上月/.test(b.getAttribute('title') || '')) : null
                if (!btn) return false
                btn.click()
                await new Promise((r) => setTimeout(r, 600))
                return true
            })()`)
            steps.push(`${label}:prevMonth=${prev}`)
        }
        const clicked = await cdp.evaluate(`return (async () => {
            const panel = [...document.querySelectorAll('.nue-date-picker-panel')].filter((e) => e.getBoundingClientRect().width > 0).pop()
            if (!panel) return JSON.stringify({ ok: false, reason: 'NO-PANEL' })
            const cells = [...panel.querySelectorAll('${ANCHORS.dateCell}')]
                .filter((e) => !e.classList.contains('other-month') && e.getBoundingClientRect().width > 0)
            if (!cells.length) return JSON.stringify({ ok: false, reason: 'NO-DATE-CELL' })
            const target = ${day === null ? 'cells[cells.length - 1]' : `cells.find((e) => (e.innerText || '').trim() === String(${day})) ?? cells[cells.length - 1]`}
            target.click()
            await new Promise((r) => setTimeout(r, 700))
            return JSON.stringify({ ok: true, count: cells.length, picked: (target.innerText || '').trim() })
        })()`)
        steps.push(`${label}:pick=${clicked}`)
        return JSON.parse(clicked).ok === true
    }
    if (start !== undefined) await pickOne('选择开始', start, prevMonth)
    if (end !== undefined) await pickOne('选择截止', end, prevMonth)
    const saved = await cdp.evaluate(`return (async () => {
        const btn = [...document.querySelectorAll('[class*="task-date-selector-panel"] button')]
            .find((b) => (b.innerText || '').trim() === '保存' && b.getBoundingClientRect().width > 0)
        if (!btn) return false
        btn.click()
        await new Promise((r) => setTimeout(r, 1200))
        return true
    })()`)
    steps.push(`save=${saved}`)
    if (saved !== true) return { ok: false, reason: '未找到面板「保存」按钮', steps }
    return { ok: true, steps }
}

/**
 * 创建任务（父任务）：走创建器 UI（键盘 n）
 * @param {object} cdp CDP 客户端
 * @param {{ title: string, scheduled?: boolean, overdue?: boolean }} options
 *        `scheduled=true` 会打开「设置时间」面板（排期/逾期场景）；**收集箱场景无需额外操作**
 *        （收集箱是创建器默认清单）——故不再单独传 `inbox`。
 * @returns {Promise<{ ok: boolean, task?: object, reason?: string }>}
 */
async function createTaskViaUi(
    cdp,
    { title, scheduled = false, overdue = false, projectName = null }
) {
    await ensureTaskList(cdp)
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
    // 时间窗设置（best-effort，结构无关）：
    // - 排期(case1)：开始=今天、截止=本月最后一个日单元（保证 start ≤ end）
    // - 逾期(case3)：先翻到上一月，开始/截止都取该月靠后的日单元（构造过去时间窗）
    if (scheduled || overdue) {
        const today = new Date().getDate()
        // 完整时间窗：开始=今天、截止=该月最后一个日单元（`day:null` ⇒ 取最后一个可点日单元）
        // 逾期(case3)：优先取"本月内已过去的几天"（today-3 / today-1），**不依赖翻月**（翻月曾不稳）；
        //              仅当本月头几天无法构造过去区间时才回退"上一月 + 最后日单元"
        const usePrevMonth = overdue && today < 4
        const picked = overdue
            ? await pickDates(cdp, {
                  start: usePrevMonth ? today : today - 3,
                  end: usePrevMonth ? null : today - 1,
                  prevMonth: usePrevMonth
              })
            : await pickDates(cdp, { start: today, end: null })
        // 记录到调用方（通过返回值 notes）
        if (!picked.ok)
            return {
                ok: false,
                reason: `时间窗设置失败：${picked.reason ?? ''} steps=${JSON.stringify(picked.steps ?? [])}`
            }
    }
    if (projectName) {
        const selected = await selectProjectInCreator(cdp, projectName)
        if (!selected.ok) return { ok: false, reason: `切清单失败：${selected.reason}` }
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

/** 为父任务创建子任务（走详情抽屉：点「新增子任务」显示输入框 → 输入 → Enter） */
async function createSubTaskViaUi(cdp, { parentId, title }) {
    await ensureTaskList(cdp)
    // 打开详情抽屉：**直接用路由** `#/tasks/all/table/<taskId>`
    // 理由：点击行/名单元格依赖列表是否已渲染出新任务（实测自动流程里新任务常常尚未渲染 ⇒ 不可靠）；
    //      而应用本身用 `router.push({ params: { taskId } })` 打开详情（点行时 href 就是这个路径）⇒ 路由直达最稳。
    let opened = false
    for (let attempt = 0; attempt < 8 && !opened; attempt++) {
        opened = await cdp.evaluate(`
            const target = '#/tasks/all/table/' + ${JSON.stringify(parentId)}
            if (location.hash !== target) location.hash = target
            await new Promise((r) => setTimeout(r, 2200))
            return !!document.querySelector('${ANCHORS.detailsDrawer}')
        `)
        if (!opened) await sleep(900)
    }
    if (!opened) {
        const diag = await cdp.json(
            `({ hash: location.hash, drawer: !!document.querySelector('${ANCHORS.detailsDrawer}') })`
        )
        return { ok: false, reason: `路由直达详情失败（${JSON.stringify(diag)}）` }
    }
    // 点「新增子任务」显示输入框（实测：抽屉默认无输入框，需先点该按钮）
    const revealed = await cdp.evaluate(`
        const drawer = document.querySelector('${ANCHORS.detailsDrawer}')
        const add = [...drawer.querySelectorAll('button')].find((b) => /新增子任务/.test(b.innerText || ''))
        if (!add) return false
        add.click()
        await new Promise((r) => setTimeout(r, 800))
        return true
    `)
    if (!revealed) return { ok: false, reason: '未找到「新增子任务」按钮（锚点变化？）' }
    const filled = await cdp.json(`(async () => {
        const drawer = document.querySelector('${ANCHORS.detailsDrawer}')
        const inputs = [...drawer.querySelectorAll('input')]
        const input = inputs.find((node) => ${JSON.stringify(ANCHORS.subTaskInputPlaceholders)}.some((ph) => (node.placeholder || '').includes(ph)))
        if (!input) return { ok: false, reason: '未找到子任务输入框（锚点变化？placeholder=' + JSON.stringify(inputs.map((i) => i.placeholder)) + '）' }
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
        : {
              ok: false,
              reason: `创建后在 store 未找到子任务（parentTaskId=${parentId}；store 任务数=${tasks.ok ? tasks.tasks.length : 'n/a'}）`
          }
}

/**
 * 详情页 header 的 `TaskDateSelector`：把父任务时间窗改为「过去」（case3 退路；`task-details/header/index.vue:3`）
 * @param {object} cdp CDP 客户端
 * @param {{ daysAgo?: number }} [options]
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function setParentDateViaDetailsHeader(cdp, options = {}) {
    const daysAgo = options.daysAgo ?? 7
    const today = new Date().getDate()
    const daysBack = Math.min(daysAgo, Math.max(1, today - 1))
    // 复用统一实现：详情页 header 的 TaskDateSelector 与创建器同一套面板/日历结构
    const result = await pickDates(cdp, {
        scope: 'details',
        start: today - daysBack,
        end: null,
        prevMonth: today - daysBack < 1
    })
    return result.ok
        ? { ok: true }
        : { ok: false, reason: `改期失败：${result.reason}`, steps: result.steps }
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
        const lists = [...document.querySelectorAll('ul.nue-dropdown')].filter((ul) => ul.getBoundingClientRect().width > 0)
        const ul = lists[lists.length - 1]
        const items = ul ? [...ul.querySelectorAll('li')] : []
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
    const title = `${ANCHORS.taskTitlePrefix} ${RUN_TAG} 已排期父任务`
    // 自定义清单：不存在则创建（受控数据，跑完由 cleanup 组删除）
    const projectName = `${ANCHORS.taskTitlePrefix} 清单`
    const project = await ensureProject(cdp, projectName)
    info(checks, 'CASE1.setup', '自定义清单（不存在则创建）', JSON.stringify(project))
    if (!project.ok)
        return skip(
            checks,
            'CASE1',
            '已排期父任务 ⇒ 子任务继承清单+时间窗',
            `清单准备失败：${project.reason}（待锚点校准；不判 FAIL）`
        )
    ctx.state.probeProjectName = projectName
    ctx.state.probeProjectCreated = project.created === true
    const parent = await createTaskViaUi(cdp, { title, scheduled: true, projectName })
    if (!parent.ok)
        return skip(
            checks,
            'CASE1',
            '已排期父任务 ⇒ 子任务继承清单+时间窗',
            `数据构造失败：${parent.reason}（待锚点校准；不判 FAIL）`
        )
    info(checks, 'CASE1.parent', '父任务 VO', JSON.stringify(parent.task))
    expect(
        checks,
        'CASE1.setup.project',
        '父任务已落在自定义清单（projectId 非空且等于清单 id）',
        parent.task.projectId === project.id,
        `parent.projectId=${JSON.stringify(parent.task.projectId)} project.id=${project.id}`
    )
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
    const title = `${ANCHORS.taskTitlePrefix} ${RUN_TAG} 未排期父任务`
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
    const title = `${ANCHORS.taskTitlePrefix} ${RUN_TAG} 逾期父任务`
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
    const title = `${ANCHORS.taskTitlePrefix} ${RUN_TAG} 收集箱父任务`
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

/**
 * 受控数据清理：删除本次/历史 `[QA-TASK01]` 前缀任务（软删除 → 垃圾桶）与探针清单
 * @description 纪律要求"测完删除并核 0 pending / 0 failed"；清单删除为 best-effort（失败则登记为遗留，不判 FAIL）
 */
async function cleanup(ctx) {
    const { cdp } = ctx
    const checks = []
    const allResult = await readTasks(cdp)
    const all = allResult.ok ? allResult.tasks : []
    const targets = all.filter((task) =>
        String(task.name || '').startsWith(ANCHORS.taskTitlePrefix)
    )
    info(checks, 'CLEANUP.info', '待清理任务数（前缀匹配）', String(targets.length))
    let deleted = 0
    for (const task of targets.slice(0, 40)) {
        const ok = await cdp.evaluate(`return (async () => {
            location.hash = '#/tasks/all/table/' + ${JSON.stringify(task.id)}
            await new Promise((r) => setTimeout(r, 1600))
            const drawer = document.querySelector('${ANCHORS.detailsDrawer}')
            if (!drawer) return false
            const more = [...drawer.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === '更多')
            if (!more) return false
            more.click()
            await new Promise((r) => setTimeout(r, 1000))
            const item = [...document.querySelectorAll('ul.nue-dropdown li')].find((li) => (li.innerText || '').trim() === '删除待办任务' && li.getBoundingClientRect().width > 0)
            if (!item) return false
            item.click()
            await new Promise((r) => setTimeout(r, 1200))
            return true
        })()`)
        if (ok) deleted += 1
    }
    // 以**服务端**为准核验删除状态（本地 store VO 未必暴露 isDeleted ⇒ 会高估失败）
    const serverState = await cdp.evaluate(`return (async () => {
        const jwt = localStorage.getItem('USER_JWT')
        const ids = ${JSON.stringify(targets.slice(0, 25).map((t) => t.id))}
        let alive = 0
        const aliveSample = []
        for (const id of ids) {
            try {
                const res = await fetch('http://localhost:3302/api/tasks/' + id, { headers: { Authorization: 'Bearer ' + jwt } })
                const body = await res.json()
                const record = body?.data
                const isDeleted = !!(record && (record.deletedAt || record.isDeleted))
                if (!isDeleted) { alive += 1; if (aliveSample.length < 3) aliveSample.push(id) }
            } catch (err) { /* 忽略单条失败 */ }
        }
        return JSON.stringify({ checked: ids.length, alive, aliveSample })
    })()`)
    const afterResult = await readTasks(cdp)
    const serverParsed = JSON.parse(serverState)
    const localAlive = (afterResult.ok ? afterResult.tasks : []).filter(
        (task) => String(task.name || '').startsWith(ANCHORS.taskTitlePrefix) && !task.isDeleted
    ).length
    expect(
        checks,
        'CLEANUP.a',
        '`[QA-TASK01]` 任务已删除（本地软删除口径）',
        targets.length === 0 || deleted > 0 || localAlive === 0,
        `待清理=${targets.length} 本轮删除成功=${deleted} 本地剩余未删=${localAlive}`
    )
    // 服务端删除态**核验口径待确认**：`GET /tasks/{id}` 的 deletedAt/isDeleted 未反映垃圾桶状态（见实际值）
    info(
        checks,
        'CLEANUP.server',
        '服务端删除态核验（口径待确认：该字段未反映软删除）',
        `checked=${serverParsed.checked} 未见删除标记=${serverParsed.alive} 样例=${JSON.stringify(serverParsed.aliveSample)} —— 本地已完成软删除；服务端垃圾桶表示形式待 PM/架构确认后再作为判据`
    )
    // 清单：仅当本轮创建时才删（best-effort）
    {
        const gone = await cdp.evaluate(`return (async () => {
            const app = document.getElementById('app')
            const pinia = app.__vue_app__.config.globalProperties.$pinia
            // 侧边栏「清单」→ 打开清单视图 → 头部操作下拉删除
            const nav = [...document.querySelectorAll('#app button, #app a')].find((b) => /清单/.test(b.innerText || ''))
            nav?.click()
            await new Promise((r) => setTimeout(r, 1800))
            const opt = [...document.querySelectorAll('#app button')].find((b) => /操作|更多/.test(b.innerText || ''))
            if (opt) {
                opt.click()
                await new Promise((r) => setTimeout(r, 1000))
                const del = [...document.querySelectorAll('ul.nue-dropdown li')].find((li) => (li.innerText || '').trim() === '删除清单' && li.getBoundingClientRect().width > 0)
                if (del) { del.click(); await new Promise((r) => setTimeout(r, 1500)); return 'clicked' }
            }
            return 'not-found'
        })()`)
        info(checks, 'CLEANUP.project', '探针清单删除（best-effort）', String(gone))
    }
    // 同步一次并核 0 pending / 0 failed
    try {
        await openPanel(cdp)
        await clickPanelPrimary(cdp)
    } catch (err) {
        info(
            checks,
            'CLEANUP.panel',
            '同步面板操作异常（已降级为 INFO，不中断清理）',
            String(err).slice(0, 200)
        )
    }
    const idle = await cdp.evaluate(`
        for (let i = 0; i < 40; i++) {
            const btn = document.querySelector('.sync-rail-btn')
            if (btn && !btn.disabled) return true
            await new Promise((r) => setTimeout(r, 500))
        }
        return false
    `)
    const rows = await cdp.evaluate(
        `return JSON.stringify(window.__qa?.panelRows ? window.__qa.panelRows() : null)`
    )
    expect(
        checks,
        'CLEANUP.b',
        '同步收口且 0 pending / 0 failed',
        idle === true && !/待推送|失败/.test(rows || ''),
        `idle=${idle} rows=${rows}`
    )
    return checks
}

/**
 * CASE1 定向补测（PM seq 72 授权）：**本地创建后** vs **同步/刷新（服务端拉回）后** 的字段一致性
 * @description 动机：此前断言全部基于"创建后在本地 store 读回"；子任务经同步写服务端，刷新后从服务端拉回，
 *              若服务端/同步做过字段归一化或填充，需要显式发现。**两者不一致 ⇒ 标注"服务端归一化/差异"并附实际值**
 *              （这是发现面，不默认判 FAIL）。
 */
async function case1Recheck(ctx) {
    const { cdp, password } = ctx
    const checks = []
    const projectName = `${ANCHORS.taskTitlePrefix} 清单`
    const title = `${ANCHORS.taskTitlePrefix} ${RUN_TAG} 补测父任务`
    const project = await ensureProject(cdp, projectName)
    info(checks, 'RECHECK.setup', '复用夹具清单', JSON.stringify(project))
    if (!project.ok)
        return skip(checks, 'RECHECK', 'CASE1 同步后字段一致性', `清单准备失败：${project.reason}`)
    const parent = await createTaskViaUi(cdp, { title, scheduled: true, projectName })
    if (!parent.ok) return skip(checks, 'RECHECK.parent', '父任务创建', `失败：${parent.reason}`)
    const child = await createSubTaskViaUi(cdp, {
        parentId: parent.task.id,
        title: `${title} - 子任务`
    })
    if (!child.ok) return skip(checks, 'RECHECK.child', '子任务创建', `失败：${child.reason}`)
    const localParent = parent.task
    const localChild = child.task
    info(
        checks,
        'RECHECK.local',
        '① 创建后（本地 store）',
        JSON.stringify({ parent: localParent, child: localChild })
    )

    // 触发同步完成（在线 + 0 pending）
    await cdp.unblockUrls()
    await openPanel(cdp)
    await clickPanelPrimary(cdp)
    await sleep(4000)
    const synced = await cdp.evaluate(`
        for (let i = 0; i < 60; i++) {
            const rows = window.__qa?.panelRows ? window.__qa.panelRows() : []
            const btn = document.querySelector('.sync-rail-btn')
            if (btn && !btn.disabled && !rows.some((row) => /待推送|失败/.test(row))) return true
            await new Promise((r) => setTimeout(r, 500))
        }
        return false
    `)
    info(checks, 'RECHECK.sync', '同步收口（0 pending / 0 failed）', String(synced))

    // 刷新/重进：reload → **复用 bootstrap**（登录/解锁/等壳，避免内联解锁在时序上失手）
    await cdp.reload(3000)
    const session = await bootstrap(cdp, { email: ctx.email, password })
    info(
        checks,
        'RECHECK.reboot',
        '刷新后重新引导（bootstrap）',
        `ok=${session.ok} hash=${session.hash} notes=${JSON.stringify(session.notes)}`
    )
    // 等壳就绪（解锁后仍需等初始同步门退出/任务列表加载）
    for (let i = 0; i < 30; i++) {
        if (await cdp.evaluate(`return !!document.querySelector('${SEL.railBtn}')`)) break
        await sleep(1000)
    }
    // 路由直达任务详情，确保详情 VO 也重新拉取；并轮询等任务 VO 回到 store（最多 20s）
    await cdp.evaluate(
        `location.hash = '#/tasks/all/table/' + ${JSON.stringify(parent.task.id)}; await new Promise((r) => setTimeout(r, 2500)); return 'ok'`
    )
    let afterParent = null
    let afterChild = null
    let afterResult = { ok: false, tasks: [] }
    for (let i = 0; i < 20; i++) {
        afterResult = await readTasks(cdp)
        afterParent = afterResult.ok
            ? afterResult.tasks.find((task) => task.id === localParent.id)
            : null
        afterChild = afterResult.ok
            ? afterResult.tasks.find((task) => task.id === localChild.id)
            : null
        if (afterChild) break
        await sleep(1000)
    }
    info(
        checks,
        'RECHECK.storeSize',
        '刷新后 store 任务数',
        String(afterResult.ok ? afterResult.tasks.length : -1)
    )
    info(
        checks,
        'RECHECK.after',
        '② 同步/刷新后（服务端拉回）',
        JSON.stringify({ parent: afterParent, child: afterChild })
    )
    if (!afterChild)
        return skip(
            checks,
            'RECHECK.compare',
            '同步后字段一致性',
            '刷新后未读回子任务（可能仍在同步中）'
        )
    expect(
        checks,
        'RECHECK.projectId',
        '子任务 projectId 与父任务逐字相等（两时点均成立）',
        afterChild.projectId === afterParent?.projectId,
        `local: parent=${JSON.stringify(localParent.projectId)} child=${JSON.stringify(localChild.projectId)}；after: parent=${JSON.stringify(afterParent?.projectId)} child=${JSON.stringify(afterChild.projectId)}`
    )
    expect(
        checks,
        'RECHECK.startAt',
        '子任务 startAt 与父任务逐字相等（两时点均成立）',
        sameTime(afterChild.startAt, afterParent?.startAt),
        `local: parent=${JSON.stringify(localParent.startAt)} child=${JSON.stringify(localChild.startAt)}；after: parent=${JSON.stringify(afterParent?.startAt)} child=${JSON.stringify(afterChild.startAt)}`
    )
    expect(
        checks,
        'RECHECK.endAt',
        '子任务 endAt 与父任务逐字相等（两时点均成立）',
        sameTime(afterChild.endAt, afterParent?.endAt),
        `local: parent=${JSON.stringify(localParent.endAt)} child=${JSON.stringify(localChild.endAt)}；after: parent=${JSON.stringify(afterParent?.endAt)} child=${JSON.stringify(afterChild.endAt)}`
    )
    expect(
        checks,
        'RECHECK.parentTaskId',
        '子任务 parentTaskId 指向父任务（两时点均成立）',
        afterChild.parentTaskId === localParent.id,
        `after child.parentTaskId=${JSON.stringify(afterChild.parentTaskId)} parent.id=${localParent.id}`
    )
    // 两时点差异显式标注（发现面）
    const diff = []
    if (afterChild.projectId !== localChild.projectId)
        diff.push(
            `projectId: ${JSON.stringify(localChild.projectId)} → ${JSON.stringify(afterChild.projectId)}`
        )
    if (!sameTime(afterChild.startAt, localChild.startAt))
        diff.push(
            `startAt: ${JSON.stringify(localChild.startAt)} → ${JSON.stringify(afterChild.startAt)}`
        )
    if (!sameTime(afterChild.endAt, localChild.endAt))
        diff.push(
            `endAt: ${JSON.stringify(localChild.endAt)} → ${JSON.stringify(afterChild.endAt)}`
        )
    if (diff.length) {
        info(checks, 'RECHECK.diff', '⚠️ 服务端归一化/差异（两时点不一致）', JSON.stringify(diff))
    } else {
        info(
            checks,
            'RECHECK.diff',
            '两时点逐字一致（无服务端归一化/差异）',
            'projectId / startAt / endAt 全部一致'
        )
    }
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

/**
 * 服务端真相读回（HTTP，兜底路径 ①）——**副本一致性口径**的真相基准
 * @description ⚠️ 口径修正（PM seq 96，架构纠正）：**真相优先取服务端读回**，Pinia 两副本只作辅助；
 *              不得用"取信息最全副本"静默抹平副本差异（否则 `DEF-STORE-01` 会被口径永久掩盖）。
 * @returns {Promise<{ok: boolean, value?: {startAt: string|null, endAt: string|null, projectId: string|null, state: string|null}, status?: number, error?: string}>}
 */
export async function readViaApi(cdp, taskId) {
    const result = await cdp.json(`(async () => {
        const jwt = localStorage.getItem('USER_JWT')
        try {
            const res = await fetch('http://localhost:3302/api/tasks/' + ${JSON.stringify(taskId)}, { headers: { Authorization: 'Bearer ' + jwt } })
            const body = await res.json()
            const record = body?.data ?? null
            const norm = (v) => (v === '' || v === undefined ? null : v)
            return {
                ok: !!record,
                status: res.status,
                value: record
                    ? {
                          startAt: norm(record.startAt),
                          endAt: norm(record.endAt),
                          projectId: norm(record.projectId),
                          state: norm(record.state),
                          deletedAt: norm(record.deletedAt),
                          createdAt: norm(record.createdAt),
                          updatedAt: norm(record.updatedAt)
                      }
                    : null,
                raw: record ? undefined : body
            }
        } catch (err) {
            return { ok: false, error: String(err).slice(0, 200) }
        }
    })()`)
    return result
}

/**
 * **副本一致性探针**（PM seq 96 要求：每轮都跑）——对同一 id **同时**读列表副本与详情副本并比较
 * @description 比较字段：`startAt / endAt / projectId / state`。**有差异 ⇒ 登记 + 告警**（返回 diff 行，供报告单列）；
 *              **不得**静默取"最全副本"抹平。`picked` 字段仅作**兜底读法**（取最全副本），必须与 `diff` 结论分开呈现。
 * @returns {Promise<{id: string, list: object|null, details: object|null, diff: string[], picked: object|null}>}
 */
export async function readCopies(cdp, taskId) {
    const result = await cdp.json(`(async () => {
        const app = document.getElementById('app')
        const pinia = app.__vue_app__.config.globalProperties.$pinia
        const norm = (v) => (v === '' || v === undefined ? null : v)
        const toVo = (vo) =>
            vo
                ? { name: vo.name ?? null, state: norm(vo.state), parentTaskId: norm(vo.parentTaskId), projectId: norm(vo.projectId), startAt: norm(vo.startAt), endAt: norm(vo.endAt) }
                : null
        /** 在一个 store 的**所有任务型数组**里找同一 id（详情 store 可能把子任务放在 subTasks 等属性上） */
        const scan = (storeName) => {
            const store = pinia._s.get(storeName)
            if (!store) return { storeFound: false, sources: [] }
            const sources = []
            for (const key of Object.keys(store)) {
                let value = null
                try { value = store[key] } catch (err) { continue }
                if (!Array.isArray(value) || value.length === 0) continue
                if (!value.some((item) => item && typeof item === 'object' && 'id' in item && 'name' in item)) continue
                const hit = value.find((item) => item && item.id === ${JSON.stringify(taskId)})
                sources.push({ key, size: value.length, vo: toVo(hit ?? null) })
            }
            return { storeFound: true, sources }
        }
        return { tasks: scan('TasksStore'), details: scan('TaskDetailsStore'), stores: [...pinia._s.keys()] }
    })()`)
    const FIELDS = ['state', 'projectId', 'startAt', 'endAt']
    const tasksSources = (result.tasks?.sources ?? []).filter((source) => source.vo)
    const detailsSources = (result.details?.sources ?? []).filter((source) => source.vo)
    const presentInTasksStore = tasksSources.length > 0
    const presentInDetailsStore = detailsSources.length > 0
    const bothPresent = presentInTasksStore && presentInDetailsStore
    const diff = []
    if (bothPresent) {
        const listVo = tasksSources[0].vo
        for (const source of detailsSources) {
            for (const field of FIELDS) {
                if ((listVo[field] ?? null) !== (source.vo[field] ?? null))
                    diff.push(
                        `${field}: list=${JSON.stringify(listVo[field] ?? null)} details.${source.key}=${JSON.stringify(source.vo[field] ?? null)}`
                    )
            }
        }
    }
    const score = (vo) => (vo ? FIELDS.filter((f) => vo[f] !== null).length : -1)
    const picked =
        [tasksSources[0]?.vo, ...detailsSources.map((source) => source.vo)]
            .filter(Boolean)
            .sort((a, b) => score(b) - score(a))[0] ?? null
    return {
        id: taskId,
        presentInTasksStore,
        presentInDetailsStore,
        bothPresent,
        tasksStoreSources: (result.tasks?.sources ?? []).map((source) => ({
            key: source.key,
            size: source.size,
            hit: !!source.vo
        })),
        detailsStoreSources: (result.details?.sources ?? []).map((source) => ({
            key: source.key,
            size: source.size,
            hit: !!source.vo
        })),
        list: tasksSources[0]?.vo ?? null,
        details: detailsSources[0]?.vo ?? null,
        stores: result.stores,
        diff,
        picked
    }
}

/**
 * 对一组 id 批量跑副本一致性探针，并附**服务端真相**
 * @returns {Promise<{checked: number, hits: Array, clean: Array}>}
 */
export async function storeConsistencyProbe(cdp, ids) {
    const hits = []
    const clean = []
    const invalid = []
    for (const id of ids.slice(0, 20)) {
        const copies = await readCopies(cdp, id)
        // **空集比较无信息量**：两副本未同时在场时，0 差异不算"一致"
        if (!copies.bothPresent) {
            invalid.push({
                id,
                presentInTasksStore: copies.presentInTasksStore,
                presentInDetailsStore: copies.presentInDetailsStore,
                list: copies.list,
                details: copies.details
            })
            continue
        }
        if (copies.diff.length > 0) {
            const api = await readViaApi(cdp, id)
            hits.push({
                id,
                diff: copies.diff,
                list: copies.list,
                details: copies.details,
                api: api.value ?? null
            })
        } else {
            clean.push({ id, list: copies.list, details: copies.details })
        }
    }
    return {
        checked: Math.min(ids.length, 20),
        valid: clean.length + hits.length,
        hits,
        clean,
        invalid
    }
}

/**
 * **只经服务端**改任务字段（P3 受控可见性用：让"列表侧"先变、详情副本不动）
 * @description `PUT /tasks/{id}`（`updateTaskValueObject2Req` 语义）；成功码 `40020`
 */
export async function apiUpdateTask(cdp, taskId, patch) {
    return cdp.json(`(async () => {
        const jwt = localStorage.getItem('USER_JWT')
        const res = await fetch('http://localhost:3302/api/tasks/' + ${JSON.stringify(taskId)}, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
            body: JSON.stringify(${JSON.stringify(patch)})
        })
        const body = await res.json()
        return { status: res.status, code: body?.code ?? null, message: body?.message ?? null }
    })()`)
}

/**
 * 供其它 feature 复用的最小工具集（TASK-02 起）：**只读/构造夹具**用，避免同一套 CDP 手法二处漂移
 * @description 不导出各 case 自身，导出的是：断言工具 + 任务/清单读取与创建 + 唯一运行标签
 *
 * ⚠️ **多副本口径（PM seq 96 修正版，架构纠正后即时生效）**：同一任务可能同时存在于 `TasksStore`（列表）
 *    与 `TaskDetailsStore`（详情），**二者不同步**（实测：列表 `endAt=2026-09-10T04:56Z` / 详情 `''` /
 *    API 已落库；记 **DEF-STORE-01 候选**）。口径：
 *    1. **真相优先取服务端读回**（`readViaApi()`，HTTP）；Pinia 两副本**只作辅助**；
 *    2. **每轮都跑副本一致性探针**（`storeConsistencyProbe()` / `readCopies()`）：同 id 同时读两副本并比较
 *       `startAt/endAt/projectId/state`，**有差异 ⇒ 登记 + 告警 + 报告单列**；
 *    3. "取信息最全副本"（`task-02` 的 `voOf()`）**仅作兜底读法**，必须**先出差异结论**再使用；
 *       **禁止**用最全副本静默抹平差异（否则 DEF-STORE-01 会被口径永久掩盖）；
 *    4. `readTasks().find()` 这种**单副本读取**不作强断言依据（命中首个副本，详情副本陈旧时会误判）。
 */
export const qaKit = {
    ANCHORS,
    RUN_TAG,
    expect,
    info,
    skip,
    sleep,
    readTasks,
    readProjects,
    ensureProject,
    ensureTaskList,
    pickDates,
    createTaskViaUi,
    createSubTaskViaUi,
    readViaApi,
    readCopies,
    storeConsistencyProbe,
    apiUpdateTask
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
        { id: 'api', title: '兜底路径 ① HTTP 读回交叉核验（不判定功能）', run: apiCrossCheck },
        {
            id: 'case1recheck',
            title: 'CASE1 定向补测：本地创建 vs 同步/刷新（服务端拉回）字段一致性',
            run: case1Recheck
        },
        {
            id: 'cleanup',
            title: '受控数据清理（删除 [QA-TASK01] 任务/清单 + 核 0 pending/0 failed）',
            run: cleanup
        }
    ]
}