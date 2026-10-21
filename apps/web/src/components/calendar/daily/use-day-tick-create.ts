import { computed, type Ref } from 'vue'
import type { DayGridModel } from './build-day-grid'

/**
 * useDayTickCreate —— 刻度标签与刻度新建入口（TASK-19B C5；取代 TASK-16 D5 内联编辑器）
 * @description 仅「带文本」刻度可点：原生 `button`（唯一新建入口必须键盘可达），
 *              payload 由宿主桥 `onCreateTaskAt(startMin)` 构造（日视图不自建 payload）；
 *              首列带文本刻度挂 `.is-first-tick` 供左端边界保护（r3：首列居中会向左裁掉一半）。
 *              T518 / R7：**内部标签一律居中**（不再对末列做右对齐保护），轴末端对齐由端标签唯一承担；
 *              轴终点标签（R2 / D1）由模型 `axisEndpoints` 提供，**不新增点击入口**（C5 零变化）。
 */

export type DayTickCreateDeps = {
    model: Ref<DayGridModel>
    onCreateTaskAt: (startMin: number) => void
}

export const useDayTickCreate = ({ model, onCreateTaskAt }: DayTickCreateDeps) => {
    /** 刻度值 → `HH:MM`（aria/title 文案；×1 档可见文本为 `HH`，此处仍规范到 `HH:MM`） */
    const tickTextOf = (minutes: number): string =>
        `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

    // @computed 首列带文本索引（左端边界保护；R7：末列不再需要边界保护，轴末端已由端标签承担）
    const labelIndices = computed(() =>
        model.value.columns.filter((col) => col.label !== '').map((col) => col.index)
    )
    const firstLabelIndex = computed(() => labelIndices.value[0] ?? -1)

    // @computed 轴终点标签（R2 / D1）：承载列 = 末列（标签右对齐于轴终点）；文本型式随档位（`24` / `24:00`）
    const axisEndLabelIndex = computed(
        () => model.value.axisEndpoints.find((endpoint) => endpoint.key === 'end')?.labelIndex ?? -1
    )
    const axisEndLabelText = computed(
        () => model.value.axisEndpoints.find((endpoint) => endpoint.key === 'end')?.label ?? ''
    )

    // @method 点击带文本刻度标签 → 经宿主桥打开创建对话框（payload 由宿主桥构造）
    const onCreateAtTick = (tickMin: number): void => onCreateTaskAt(tickMin)

    return {
        tickTextOf,
        firstLabelIndex,
        axisEndLabelIndex,
        axisEndLabelText,
        onCreateAtTick
    }
}