import { reactive } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'

/**
 * F1 拖拽排期（M3）——会话控制器 + 可测纯逻辑
 * @description 纯 UI 状态集中于此组合式：pointer 会话（window 级监听，元素外亦可拖）、
 *              位移阈值消歧（点击语义零回归）、浮空胶囊坐标、落点 dateKey 解析、行源拖起收起抽屉、
 *              busy 禁起与 Esc/非目标区取消。真实拖放链路（pointer 序列/元素命中）由人工冒烟，
 *              可测逻辑（阈值/坐标/落点解析/收起触发）在此导出并由 vitest 覆盖。
 */

// —— 纯函数/常量（可单测） ——

/** 点击/拖拽消歧阈值（px；PM 决议 4~6，取值 5） */
export const DRAG_THRESHOLD_PX = 5

/** 浮空胶囊相对指针的偏移（fixed 固定跟随，非 DOM 克隆） */
export const DRAG_GHOST_OFFSET = { x: 8, y: 8 } as const

/** 日期格标识：data-cal-drop=<dateKey>（月视图含补位灰格；周视图=各列格） */
export const DROP_CELL_SELECTOR = '[data-cal-drop]'

/** 拖源类型：'row' 未安排抽屉行 / 'bar' 月/周已排期任务条 */
export type DragKind = 'row' | 'bar'

/** 位移是否超过阈值（欧氏距离 ≥ 阈值） */
export const isDragPastThreshold = (dx: number, dy: number): boolean =>
    dx * dx + dy * dy >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX

/** 胶囊定位点（指针坐标 + 偏移） */
export const ghostPointOf = (x: number, y: number): { x: number; y: number } => ({
    x: x + DRAG_GHOST_OFFSET.x,
    y: y + DRAG_GHOST_OFFSET.y
})

/** 从事件目标解析落点 dateKey（无命中/非法返回 null） */
export const dropDateKeyOf = (target: unknown): string | null => {
    const el = target as { closest?: (selector: string) => { dataset: DOMStringMap } | null } | null
    if (!el || typeof el.closest !== 'function') return null
    const cell = el.closest(DROP_CELL_SELECTOR)
    if (!cell) return null
    const key = cell.dataset.calDrop
    return key && key.length > 0 ? key : null
}

/** 拖拽会话状态（模板消费） */
export type DragSessionState = {
    active: boolean
    kind: DragKind
    taskId: string
    name: string
    x: number
    y: number
    hoverKey: string | null
}

/** 依赖注入（组装点在月历视图根部；写库沿用 M1 scheduleToDay = T1 + U2 toast） */
export type DragScheduleDeps = {
    isBusy: () => boolean
    closeUnscheduled: () => void
    scheduleOne: (task: TaskViewObject, dateKey: string) => void | Promise<void>
}

const initialSession = (): DragSessionState => ({
    active: false,
    kind: 'bar',
    taskId: '',
    name: '',
    x: 0,
    y: 0,
    hoverKey: null
})

/**
 * useDragSchedule —— F1 拖拽会话控制器
 * @description 调用方绑定 startPossible（pointerdown）。超过位移阈值判定拖拽：
 *              行源激活即收起抽屉、胶囊（name）固定跟随指针、目标格高亮（hoverKey）；
 *              释放命中落点键 → deps.scheduleOne（同一 T1/U2 单条链路），否则取消。
 *              纯点击（阈值内释放）完全放行（任务条/抽屉行/日期格的既有 click 语义零回归）。
 */
export const useDragSchedule = (deps: DragScheduleDeps) => {
    const session = reactive<DragSessionState>(initialSession())

    let pending: { task: TaskViewObject; kind: DragKind; originX: number; originY: number } | null =
        null
    let isDrag = false
    // 点击抑制：拖拽手势释放所触发的 click 吃一次（防止误开详情/日期格/完成勾选）
    let clickArmed = false

    const detachMoveListeners = (): void => {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerCancel)
        window.removeEventListener('keydown', onKeyDown)
    }
    const armClickSuppression = (): void => {
        if (clickArmed) return
        clickArmed = true
        window.addEventListener('click', onClickCapture, true)
        // 若本次释放未产生 click（极边缘），下次按下前自动解除，绝不误吞后续普通点击
        window.addEventListener('pointerdown', onNextPointerDown, true)
    }
    const disarmClickSuppression = (): void => {
        clickArmed = false
        window.removeEventListener('click', onClickCapture, true)
        window.removeEventListener('pointerdown', onNextPointerDown, true)
    }

    const reset = (drop: { task: TaskViewObject; dateKey: string } | null = null): void => {
        const task = drop?.task ?? pending?.task ?? null
        const dateKey = drop?.dateKey ?? null
        detachMoveListeners()
        session.active = false
        session.hoverKey = null
        pending = null
        isDrag = false
        document.body.style.userSelect = ''
        if (task && dateKey) void deps.scheduleOne(task, dateKey)
    }

    const onPointerMove = (event: PointerEvent): void => {
        if (!pending) return
        if (!isDrag) {
            const dx = event.clientX - pending.originX
            const dy = event.clientY - pending.originY
            if (!isDragPastThreshold(dx, dy)) return
            // 超阈值 → 拖拽开始（该手势后续 click 将被抑制）
            isDrag = true
            session.active = true
            session.taskId = pending.task.id
            session.kind = pending.kind
            session.name = pending.task.name
            document.body.style.userSelect = 'none'
            armClickSuppression()
            if (pending.kind === 'row') deps.closeUnscheduled()
        }
        session.x = event.clientX
        session.y = event.clientY
        session.hoverKey = dropDateKeyOf(event.target)
    }

    const onPointerUp = (): void => {
        if (!pending) return
        if (!isDrag) {
            // 阈值内释放 = 纯点击：彻底放行（click 照常触发既有语义）
            reset()
            return
        }
        const dragTask = pending.task
        const targetKey = session.hoverKey
        reset(targetKey ? { task: dragTask, dateKey: targetKey } : null)
    }

    const onPointerCancel = (): void => {
        if (!pending) return
        // 取消手势不会产生 click：解除抑制后重置
        disarmClickSuppression()
        reset()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            // Esc 取消：保留一次点击抑制（其后的指针释放不误触）
            if (isDrag) armClickSuppression()
            reset()
        }
    }
    const onClickCapture = (event: Event): void => {
        if (!clickArmed) return
        disarmClickSuppression()
        event.preventDefault()
        event.stopPropagation()
    }
    const onNextPointerDown = (): void => {
        disarmClickSuppression()
    }

    /**
     * 起拖入口（pointerdown 绑定）：busy 禁起；仅主键；会话已占用忽略。
     * @param task 拖源任务（bar=已排期条任务；row=未安排抽屉行任务）
     * @param kind 拖源类型
     * @param event 指针按下事件
     */
    const startPossible = (task: TaskViewObject, kind: DragKind, event: Event): boolean => {
        if (session.active || pending) return false
        if (deps.isBusy()) return false
        const pointer = event as PointerEvent
        if (typeof pointer.button === 'number' && pointer.button !== 0) return false
        pending = { task, kind, originX: pointer.clientX, originY: pointer.clientY }
        isDrag = false
        session.x = pointer.clientX
        session.y = pointer.clientY
        window.addEventListener('pointermove', onPointerMove)
        window.addEventListener('pointerup', onPointerUp)
        window.addEventListener('pointercancel', onPointerCancel)
        window.addEventListener('keydown', onKeyDown)
        return true
    }

    // @method 某日期格是否为当前拖拽高亮目标
    const isTarget = (dateKey: string): boolean => session.active && session.hoverKey === dateKey

    return { session, startPossible, isTarget, cancel: () => reset() }
}