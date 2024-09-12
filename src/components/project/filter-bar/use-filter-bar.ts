import { ref, watch, computed } from 'vue'
import type { ProjectFilterBarProps, ProjectFilterBarEmits, FilterOptions } from './types'

export const useTodoFilterBar = (props: ProjectFilterBarProps, emit: ProjectFilterBarEmits) => {
    const filterText = ref<string>(props.filterInfo?.title || '')

    const isFiltering = computed(() => {
        if (!props.filterInfo) return false
        const { id, title, isArchived, isDeleted } = props.filterInfo
        return id || title || isArchived || isDeleted
    })

    const archivedOnlyIconName = computed(() => {
        if (!props.filterInfo) return false
        const { isArchived } = props.filterInfo
        return isArchived ? 'square-check-fill' : 'square'
    })

    const deletedOnlyIconName = computed(() => {
        if (!props.filterInfo) return false
        const { isDeleted } = props.filterInfo
        return isDeleted ? 'square-check-fill' : 'square'
    })

    const handleResetFilter = () => {
        filterText.value = ''
        const emptyFilterInfo = {}
        emit('filter', emptyFilterInfo)
    }

    const handleIsArchived = () => {
        if (!props.filterInfo) return false
        const { filterInfo } = props
        let newFilterInfo = { ...filterInfo }
        if (filterInfo.isArchived) {
            delete newFilterInfo.isArchived
        } else {
            Object.assign(newFilterInfo, { isArchived: true })
        }
        emit('filter', newFilterInfo)
    }

    const handleIsDeleted = () => {
        if (!props.filterInfo) return false
        const { filterInfo } = props
        let newFilterInfo = { ...filterInfo }
        if (filterInfo.isDeleted) {
            delete newFilterInfo.isDeleted
        } else {
            Object.assign(newFilterInfo, { isDeleted: true })
        }
        emit('filter', newFilterInfo)
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
        archivedOnlyIconName,
        deletedOnlyIconName,
        handleResetFilter,
        handleIsArchived,
        handleIsDeleted
    }
}
