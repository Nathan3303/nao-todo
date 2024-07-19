import { ref, watch, computed } from 'vue'
import type { TodoFilterBarProps, TodoFilterBarEmits, FilterOptions } from './types'
import type { TodoFilter, TodoPriority, TodoState } from '@/stores'

const stateOptions: FilterOptions<TodoState> = [
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

const priorityOptions: FilterOptions<TodoPriority> = [
    {
        label: '低(low)',
        value: 'low',
        checked: false,
        icon: 'priority-1',
        suffix: 0
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

export const useTodoFilterBar = (props: TodoFilterBarProps, emit: TodoFilterBarEmits) => {
    const filterText = ref<string>('')

    const isFiltering = computed(() => {
        if (!props.filterInfo) return false
        const { id, name, state, priority } = props.filterInfo
        return id || name || state || priority
    })

    const stateComboBoxOptions = computed({
        get() {
            const { state } = props.filterInfo
            const splitedState = state?.split(',')
            return stateOptions.map((option) => {
                option.checked = splitedState?.includes(option.value)!
                option.suffix = props.countInfo.byState[option.value] || 0
                return option
            })
        },
        set(newValue: FilterOptions<TodoState>) {
            const fs = buildFilterString(newValue)
            emit('filter', { state: fs })
        }
    })

    const priorityComboBoxOptions = computed({
        get() {
            const { priority } = props.filterInfo
            const splitedPriority = priority?.split(',')
            return priorityOptions.map((option) => {
                option.checked = splitedPriority?.includes(option.value as string)!
                option.suffix = props.countInfo.byPriority[option.value] || 0
                return option
            })
        },
        set(newValue: FilterOptions<TodoPriority>) {
            const fs = buildFilterString(newValue)
            emit('filter', { priority: fs })
        }
    })

    const handleChangeStatusOption = (value: unknown, payload: any) => {
        const _options = [...stateComboBoxOptions.value]
        _options.forEach((option, index) => {
            if (option.value === value) {
                _options[index] = { ...option, ...payload }
            }
        })
        stateComboBoxOptions.value = _options
    }

    const handleChangePriorityOption = (value: unknown, payload: any) => {
        const _options = [...priorityComboBoxOptions.value]
        _options.forEach((option, index) => {
            if (option.value === value) {
                _options[index] = { ...option, ...payload }
            }
        })
        priorityComboBoxOptions.value = _options
    }

    const handleResetFilter = () => {
        filterText.value = ''
        const emptyFilterInfo = { id: '', name: '', state: '', priority: '' }
        emit('filter', emptyFilterInfo)
    }

    watch(
        () => filterText.value,
        (newValue) => {
            emit('filter', { name: newValue } as TodoFilter)
        }
    )

    return {
        filterText,
        isFiltering,
        stateComboBoxOptions,
        priorityComboBoxOptions,
        handleChangeStatusOption,
        handleChangePriorityOption,
        handleResetFilter
    }
}

const buildFilterString = <T>(filterOptions: FilterOptions<T>) => {
    let filterString = ''
    filterOptions.forEach((option: any) => {
        if (option.checked) {
            const prefix = filterString === '' ? '' : ','
            filterString += prefix + option.value
        }
    })
    return filterString
}
