import { onUnmounted, ref, type Ref } from 'vue'
import { DRAG_THRESHOLD_PX } from '../monthly/use-drag-schedule'

/**
 * useDayPan —— 日视图空白横向平移（TASK-19B C4 / TASK-20 AC1·AC5·AC6 加固）
 * @description 与任务拖拽（`useDragSchedule`）关注点不同：1D 滚动、无吸附、无写回 ⇒ 独立极小组合式，
 *              仅复用同一阈值常量 `DRAG_THRESHOLD_PX`（禁第二套阈值）。
 *              监听挂 `.day-body` **冒泡相**；首行按排除清单零抢占（任务条/段/手柄/列头/全天泳道）。
 *              指针捕获于 `.day-body`，结束/卸载即释放；`pointermove` **不读布局**（起始一次性读 `scrollLeft`）。
 *
 *              TASK-20 加固（用户 Q4=B「鼠标就不稳定」⇒ 按会话卡死/捕获丢失假设）：
 *              ① 自愈 —— `pointerId !== null` 时**先 `release()` 再继续**（不再 return ⇒ 一次未收尾不再永久失效）；
 *              ② 兜底收尾 —— `pointerup` / `pointercancel` **同时挂 `window`**（元素捕获失败或丢失亦不漏收尾），
 *                 捕获调用包 `try/catch`；
 *              ③ `pointerdown` 时 `preventDefault()`（pan 面）抑制文本选中 / 原生拖拽；排除目标上**不**拦截；
 *              ④ `touch-action: pan-y` 由 `.day-body` 样式声明（r6：纵向交原生、横向交 JS）。
 */

/** pan 首行排除清单（起拖命中即让位；条上由 useDragSchedule 独占） */
const PAN_EXCLUDE_SELECTOR =
    '.cal-item, .day-seg, .day-task-resize, .day-cols-head, .day-allday-lane'

export const useDayPan = (containerEl: Ref<HTMLElement | null>) => {
    const isPanning = ref(false)
    let pointerId: number | null = null
    let startX = 0
    let startScrollLeft = 0

    const onPointerUp = (event: PointerEvent): void => {
        if (pointerId === null || event.pointerId !== pointerId) return
        release()
    }

    const onPointerCancel = (event: PointerEvent): void => {
        if (pointerId === null || event.pointerId !== pointerId) return
        release()
    }

    const detachWindow = (): void => {
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerCancel)
    }

    const release = (): void => {
        const el = containerEl.value
        const id = pointerId
        pointerId = null
        isPanning.value = false
        detachWindow()
        if (!el || id === null) return
        try {
            if (el.hasPointerCapture?.(id)) el.releasePointerCapture(id)
        } catch {
            /* 捕获已失效：忽略（不阻断收尾） */
        }
    }

    // @method 起拖（冒泡相）：排除清单零抢占；起始一次性读取 scrollLeft（后续 move 不再读布局）
    const onPointerDown = (event: PointerEvent): void => {
        if (event.button !== 0) return
        const el = containerEl.value
        if (!el) return
        const target = event.target as Element | null
        if (target?.closest(PAN_EXCLUDE_SELECTOR)) return
        // 自愈（AC5）：陈旧会话未收尾 ⇒ 先释放再继续（不 return，避免「一次卡死、永久失效」）
        if (pointerId !== null) release()
        pointerId = event.pointerId
        startX = event.clientX
        startScrollLeft = el.scrollLeft
        try {
            el.setPointerCapture?.(event.pointerId)
        } catch {
            /* 捕获失败：由 window 兜底收尾（AC5） */
        }
        window.addEventListener('pointerup', onPointerUp)
        window.addEventListener('pointercancel', onPointerCancel)
        // pan 面抑制文本选中 / 原生拖拽（排除目标上已提前 return ⇒ 不拦截）
        event.preventDefault()
    }

    const onPointerMove = (event: PointerEvent): void => {
        const el = containerEl.value
        if (!el || pointerId === null || event.pointerId !== pointerId) return
        const dx = event.clientX - startX
        if (!isPanning.value) {
            if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
            isPanning.value = true
        }
        // 仅横向：纵向不变
        el.scrollLeft = startScrollLeft - dx
    }

    // O4 卸载清理：会话进行中组件卸载 → 释放捕获与状态（不残留）
    onUnmounted(() => release())

    return { isPanning, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}