import { onUnmounted, ref, type Ref } from 'vue'
import { DRAG_THRESHOLD_PX } from '../monthly/use-drag-schedule'

/**
 * useDayPan —— 日视图空白横向平移（TASK-19B C4）
 * @description 与任务拖拽（`useDragSchedule`）关注点不同：1D 滚动、无吸附、无写回 ⇒ 独立极小组合式，
 *              仅复用同一阈值常量 `DRAG_THRESHOLD_PX`（禁第二套阈值）。
 *              监听挂 `.day-body` **冒泡相**；首行按排除清单零抢占（任务条/段/手柄/列头/全天泳道）。
 *              指针捕获于 `.day-body`，结束/卸载即释放；`pointermove` **不读布局**（起始一次性读 `scrollLeft`）。
 */

/** pan 首行排除清单（起拖命中即让位；条上由 useDragSchedule 独占） */
const PAN_EXCLUDE_SELECTOR =
    '.cal-item, .day-seg, .day-task-resize, .day-cols-head, .day-allday-lane'

export const useDayPan = (containerEl: Ref<HTMLElement | null>) => {
    const isPanning = ref(false)
    let pointerId: number | null = null
    let startX = 0
    let startScrollLeft = 0

    const release = (): void => {
        const el = containerEl.value
        if (el && pointerId !== null && el.hasPointerCapture?.(pointerId)) {
            el.releasePointerCapture(pointerId)
        }
        pointerId = null
        isPanning.value = false
    }

    // @method 起拖（冒泡相）：排除清单零抢占；起始一次性读取 scrollLeft（后续 move 不再读布局）
    const onPointerDown = (event: PointerEvent): void => {
        if (event.button !== 0 || pointerId !== null) return
        const el = containerEl.value
        if (!el) return
        const target = event.target as Element | null
        if (target?.closest(PAN_EXCLUDE_SELECTOR)) return
        pointerId = event.pointerId
        startX = event.clientX
        startScrollLeft = el.scrollLeft
        el.setPointerCapture?.(event.pointerId)
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

    const onPointerUp = (event: PointerEvent): void => {
        if (pointerId === null || event.pointerId !== pointerId) return
        release()
    }

    const onPointerCancel = (event: PointerEvent): void => {
        if (pointerId === null || event.pointerId !== pointerId) return
        release()
    }

    // O4 卸载清理：会话进行中组件卸载 → 释放捕获与状态（不残留）
    onUnmounted(() => release())

    return { isPanning, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}