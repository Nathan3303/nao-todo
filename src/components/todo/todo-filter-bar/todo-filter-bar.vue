<template>
    <nue-div align="center" wrap="nowrap" flex="none" width="fit-content" gap="12px">
        <nue-input
            theme="small"
            v-model="filterText"
            placeholder="筛选任务"
            icon="filter"
            :debounce-time="360"
        ></nue-input>
        <combo-box
            trigger-title="状态"
            :framework="statusComboBoxOptions"
            @change="handleChangeStatusOption"
        ></combo-box>
        <combo-box
            trigger-title="优先级"
            :framework="priorityComboBoxOptions"
            @change="handleChangePriorityOption"
        ></combo-box>
        <nue-button v-if="hasFilter" theme="small,pure" icon="clear" @click="handleResetFilter">
            重置
        </nue-button>
    </nue-div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ComboBox } from '@/components/general'
import type { TodoFilterBarProps, TodoFilterBarEmits } from './types'
import type { TodoState, TodoPriority, TodoFilter } from '@/stores'

defineOptions({ name: 'TodoFilterBar' })
const props = defineProps<TodoFilterBarProps>()
const emit = defineEmits<TodoFilterBarEmits>()

const filterText = ref('')

const hasFilter = computed(() => {
    const { name, state, priority } = props.filterInfo
    return name || state || priority
})

const statusComboBoxOptions = computed({
    get() {
        type Option<T> = { label: string; value: T; icon: string; suffix: number; checked: boolean }
        const options: Option<TodoState>[] = [
            {
                label: '待办(todo)',
                value: 'todo',
                icon: 'circle',
                suffix: 0,
                checked: false
            },
            {
                label: '正在进行(in-progress)',
                value: 'in-progress',
                icon: 'in-progress',
                suffix: 0,
                checked: false
            },
            {
                label: '已完成(done)',
                value: 'done',
                icon: 'success',
                suffix: 0,
                checked: false
            }
        ]
        const { state } = props.filterInfo
        const splitedState = state?.split(',')
        options.forEach((option) => {
            if (splitedState?.includes(option.value)) {
                option.checked = true
            }
            if (props.countInfo.byState) {
                option.suffix = props.countInfo.byState[option.value] || 0
            }
        })
        return options
    },
    set(newValue: any) {
        let filterState = ''
        newValue.forEach((option: any) => {
            if (option.checked) {
                filterState += (filterState === '' ? '' : ',') + option.value
            }
        })
        emit('filter', { state: filterState } as TodoFilter)
    }
})

const priorityComboBoxOptions = computed({
    get() {
        type Option<T> = { label: string; value: T; icon: string; suffix: number; checked: boolean }
        const options: Option<TodoPriority>[] = [
            {
                label: '低(low)',
                value: 'low',
                icon: 'priority-1',
                suffix: 0,
                checked: false
            },
            {
                label: '中(medium)',
                value: 'medium',
                icon: 'priority-2',
                suffix: 0,
                checked: false
            },
            {
                label: '高(high)',
                value: 'high',
                icon: 'priority-3',
                suffix: 0,
                checked: false
            }
        ]
        const { priority } = props.filterInfo
        const splitedPriority = priority?.split(',')
        options.forEach((option) => {
            if (splitedPriority?.includes(option.value as string)) {
                option.checked = true
            }
            if (props.countInfo.byPriority) {
                option.suffix = props.countInfo.byPriority[option.value] || 0
            }
        })
        return options
    },
    set(newValue: any) {
        let filterPriority = ''
        newValue.forEach((option: any) => {
            if (option.checked) {
                filterPriority += (filterPriority === '' ? '' : ',') + option.value
            }
        })
        emit('filter', { priority: filterPriority } as TodoFilter)
    }
})

function handleChangeStatusOption(value: unknown, payload: any) {
    const _options = [...statusComboBoxOptions.value]
    _options.forEach((option, index) => {
        if (option.value === value) {
            _options[index] = { ...option, ...payload }
        }
    })
    statusComboBoxOptions.value = _options
}

function handleChangePriorityOption(value: unknown, payload: any) {
    const _options = [...priorityComboBoxOptions.value]
    _options.forEach((option, index) => {
        if (option.value === value) {
            _options[index] = { ...option, ...payload }
        }
    })
    priorityComboBoxOptions.value = _options
}

function handleResetFilter() {
    filterText.value = ''
    emit('filter', { name: '', state: '', priority: '' } as TodoFilter)
}

watch(
    () => filterText.value,
    (newValue) => {
        emit('filter', { name: newValue } as TodoFilter)
    }
)
</script>

<style scoped>
.nue-input--actived {
    border-color: orange;
    box-shadow: var(--secondary-shadow);
}
</style>
