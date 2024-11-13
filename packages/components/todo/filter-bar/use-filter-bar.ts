import { ref, watch, computed } from 'vue'
import type { TodoFilterBarProps, TodoFilterBarEmits, FilterOptions } from './types'
import type { Todo, GetTodosOptions } from '@nao-todo/types'

const stateOptions: FilterOptions<Todo['state']> = [
    {
        label: '待办(todo)',
        value: 'todo',
        icon: 'circle',
        checked: false
    },
    {
        label: '正在进行(in-progress)',
        value: 'in-progress',
        icon: 'in-progress',
        checked: false
    },
    {
        label: '已完成(done)',
        value: 'done',
        icon: 'success',
        checked: false
    }
]

const priorityOptions: FilterOptions<Todo['priority']> = [
    {
        label: '低(low)',
        value: 'low',
        checked: false,
        icon: 'priority-1',
    },
    {
        label: '中(medium)',
        value: 'medium',
        icon: 'priority-2',
        checked: false
    },
    {
        label: '高(high)',
        value: 'high',
        icon: 'priority-3',
        checked: false
    }
]

export const useTodoFilterBar = (props: TodoFilterBarProps, emit: TodoFilterBarEmits) => {
    const filterText = ref<string>(props.filterOptions?.name || '')

    const isFiltering = computed(() => {
        if (!props.filterOptions) return false
        const { name, state, priority } = props.filterOptions
        return name || state || priority
    })

    const stateComboBoxOptions = computed({
        get() {
            if (!props.filterOptions?.state) return stateOptions
            const { state } = props.filterOptions
            const splitedState = state?.split(',')
            return stateOptions.map((option) => {
                option.checked = splitedState?.includes(option.value) || false
                return option
            })
        },
        set(newValue: FilterOptions<Todo['state']>) {
            const fs = buildFilterString(newValue)
            emit('filter', { state: fs })
        }
    })

    const priorityComboBoxOptions = computed({
        get() {
            if (!props.filterOptions?.priority) return priorityOptions
            const { priority } = props.filterOptions
            const splitedPriority = priority?.split(',')
            return priorityOptions.map((option) => {
                option.checked = splitedPriority?.includes(option.value as string) || false
                return option
            })
        },
        set(newValue: FilterOptions<Todo['priority']>) {
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
        const emptyFilterInfo = { name: '', state: '', priority: '' }
        emit('filter', emptyFilterInfo)
    }

    watch(
        () => filterText.value,
        (newValue) => {
            emit('filter', { name: newValue } as GetTodosOptions)
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
