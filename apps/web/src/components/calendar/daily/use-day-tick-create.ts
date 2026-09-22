import { computed, type Ref } from 'vue'
import type { DayGridModel } from './build-day-grid'

/**
 * useDayTickCreate —— 刻度标签与刻度新建入口（TASK-19B C5；取代 TASK-16 D5 内联编辑器）
 * @description 仅「带文本」刻度可点：原生 `button`（唯一新建入口必须键盘可达），
 *              payload 由宿主桥 `onCreateTaskAt(startMin)` 构造（日视图不自建 payload）；
 *              首/末带文本列挂 `.is-first-tick` / `.is-last-tick` 供边界保护（r3）。
 */

export type DayTickCreateDeps = {
    model: Ref<DayGridModel>
    onCreateTaskAt: (startMin: number) => void
}

export const useDayTickCreate = ({ model, onCreateTaskAt }: DayTickCreateDeps) => {
    /** 刻度值 → `HH:MM`（aria/title 文案；×1 档可见文本为 `HH`，此处仍规范到 `HH:MM`） */
    const tickTextOf = (minutes: number): string =>
        `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

    // @computed 带文本列的索引（首/末列边界保护类名；C5 r3）
    const labelIndices = computed(() =>
        model.value.columns.filter((col) => col.label !== '').map((col) => col.index)
    )
    const firstLabelIndex = computed(() => labelIndices.value[0] ?? -1)
    const lastLabelIndex = computed(() => labelIndices.value[labelIndices.value.length - 1] ?? -1)

    // @method 点击带文本刻度标签 → 经宿主桥打开创建对话框（payload 由宿主桥构造）
    const onCreateAtTick = (tickMin: number): void => onCreateTaskAt(tickMin)

    return { tickTextOf, firstLabelIndex, lastLabelIndex, onCreateAtTick }
}