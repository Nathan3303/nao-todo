import { ref, watch, computed } from 'vue'
import type { ProjectFilterBarProps, ProjectFilterBarEmits, FilterOptions } from './types'

export const useTodoFilterBar = (props: ProjectFilterBarProps, emit: ProjectFilterBarEmits) => {
    const filterText = ref<string>(props.filterInfo?.title || '')

    const isFiltering = computed(() => {
        if (!props.filterInfo) return false
        const { id, title } = props.filterInfo
        return id || title
    })

    const handleResetFilter = () => {
        filterText.value = ''
        const emptyFilterInfo = { id: '', title: '' }
        emit('filter', emptyFilterInfo)
    }

    watch(
        () => filterText.value,
        (newValue) => {
            emit('filter', { title: newValue })
        }
    )

    return {
        filterText,
        isFiltering,
        handleResetFilter
    }
}
