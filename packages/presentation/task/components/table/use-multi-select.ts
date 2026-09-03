import { computed, reactive } from 'vue'
import type { TaskTableEmits, TaskTableMultiSelectPayload, TaskTableProps } from './types'

export default (props: TaskTableProps, emit: TaskTableEmits) => {
    // @state 多行选择范围记录 - 用于多行选择
    const selectRange = reactive<TaskTableMultiSelectPayload['selectRange']>({
        start: -1,
        end: -1,
        original: -1
    })

    // @computed 是否处于多选状态
    const isMultiSelecting = computed(() => {
        return selectRange.start !== -1 && selectRange.end !== -1
    })

    // @method 多选待办处理
    const showMultiSelectPanel = (idx: number) => {
        // 首次 shift+点击：以当前行为基准并打开面板
        if (selectRange.original === -1) {
            selectRange.original = idx
            selectRange.start = idx
            selectRange.end = idx
        } else if (selectRange.original !== idx) {
            // 以基准行为起点、当前行为终点确定选择范围
            if (selectRange.original > idx) {
                selectRange.start = idx
                selectRange.end = selectRange.original
            } else {
                selectRange.start = selectRange.original
                selectRange.end = idx
            }
        }
        // original === idx（重复点击基准行）：保持现有范围，重新 emit 以便重开面板
        const selectedIds = props.tasks
            .slice(selectRange.start, selectRange.end + 1)
            .map((todo) => todo.id)
        emit('showMultiSelectPanel', { selectedIds, selectRange })
    }

    // @method 清空多选范围
    const clearMultiSelect = (fullClear: boolean = false) => {
        if (fullClear) selectRange.original = -1
        selectRange.start = selectRange.original
        selectRange.end = selectRange.original
    }

    // @method 判断是否是选中范围内
    const isInMultiSelectRange = (idx: number) => {
        return idx >= selectRange.start && idx <= selectRange.end
    }

    // @returns 返回值
    return {
        selectRange,
        isMultiSelecting,
        showMultiSelectPanel,
        clearMultiSelect,
        isInMultiSelectRange
    }
}