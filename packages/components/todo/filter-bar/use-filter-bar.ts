import { ref, watch, computed } from 'vue'
import type { TodoFilterBarProps, TodoFilterBarEmits, FrameworkOptions } from './types'
import type { Todo } from '@nao-todo/types'

const stateOptions: FrameworkOptions<Todo['state']> = [
    {
        label: '待办 (todo)',
        value: 'todo',
        icon: 'circle',
        checked: false
    },
    {
        label: '正在进行 (in-progress)',
        value: 'in-progress',
        icon: 'in-progress',
        checked: false
    },
    {
        label: '已完成 (done)',
        value: 'done',
        icon: 'success',
        checked: false
    }
]

const priorityOptions: FrameworkOptions<Todo['priority']> = [
    {
        label: '低优先级 (low)',
        value: 'low',
        checked: false,
        icon: 'priority-1'
    },
    {
        label: '中优先级 (medium)',
        value: 'medium',
        icon: 'priority-2',
        checked: false
    },
    {
        label: '高优先级 (high)',
        value: 'high',
        icon: 'priority-3',
        checked: false
    }
]

const buildFilterString = <T>(filterOptions: FrameworkOptions<T>) => {
    let filterString = ''
    filterOptions.forEach((option: any) => {
        if (option.checked) {
            const prefix = filterString === '' ? '' : ','
            filterString += prefix + option.value
        }
    })
    return filterString
}

export const useTodoFilterBar = (props: TodoFilterBarProps, emit: TodoFilterBarEmits) => {
    const filterText = ref<string>(props.filterOptions?.name || '')

    const isFiltering = computed(() => {
        if (!props.filterOptions) return false
        const { name, state, priority } = props.filterOptions
        let res = 0
        res += name ? 1 : 0
        res += state ? 1 : 0
        res += priority ? 1 : 0
        return res
    })

    const stateComboBoxOptions = computed({
        get() {
            const { state } = props.filterOptions
            const splitedState = state.split(',')
            return stateOptions.map((option) => {
                option.checked = splitedState.includes(option.value)
                return option
            })
        },
        set(newValue: FrameworkOptions<Todo['state']>) {
            const filterOptions = { ...props.filterOptions }
            filterOptions.state = buildFilterString(newValue)
            emit('filter', filterOptions)
        }
    })

    const priorityComboBoxOptions = computed({
        get() {
            const { priority } = props.filterOptions
            const splitedPriority = priority.split(',')
            return priorityOptions.map((option) => {
                option.checked = splitedPriority?.includes(option.value)
                return option
            })
        },
        set(newValue: FrameworkOptions<Todo['priority']>) {
            const filterOptions = { ...props.filterOptions }
            filterOptions.priority = buildFilterString(newValue)
            emit('filter', filterOptions)
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
            const filterOptions = { ...props.filterOptions }
            filterOptions.name = newValue
            emit('filter', filterOptions)
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
