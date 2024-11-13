import { ref, watch, computed } from 'vue'
import type { ProjectFilterBarProps, ProjectFilterBarEmits } from './types'

export const useProjectFilterBar = (props: ProjectFilterBarProps, emit: ProjectFilterBarEmits) => {
    const filterText = ref<string>(props.filterOptions.title || '')

    const isFiltering = computed(() => {
        if (!props.filterOptions) return
        const { title, isArchived, isDeleted } = props.filterOptions
        return title || isArchived || isDeleted
    })

    const archivedOnlyIconName = computed(() => {
        if (!props.filterOptions) return
        const { isArchived } = props.filterOptions
        return isArchived ? 'square-check-fill' : 'square'
    })

    const deletedOnlyIconName = computed(() => {
        if (!props.filterOptions) return
        const { isDeleted } = props.filterOptions
        return isDeleted ? 'square-check-fill' : 'square'
    })

    const handleResetFilter = () => {
        filterText.value = ''
        emit('filter', null)
    }

    const handleIsArchived = () => {
        if (!props.filterOptions) return
        const { filterOptions } = props
        const newFilterOptions = { ...filterOptions }
        if (filterOptions.isArchived) {
            delete newFilterOptions.isArchived
        } else {
            Object.assign(newFilterOptions, { isArchived: true })
        }
        emit('filter', newFilterOptions)
    }

    const handleIsDeleted = () => {
        if (!props.filterOptions) return false
        const { filterOptions } = props
        const newFilterOptions = { ...filterOptions }
        if (filterOptions.isDeleted) {
            delete newFilterOptions.isDeleted
        } else {
            Object.assign(newFilterOptions, { isDeleted: true })
        }
        emit('filter', newFilterOptions)
    }

    watch(
        () => filterText.value,
        (newValue) => {
            const { filterOptions } = props
            const newFilterInfo = { ...filterOptions }
            if (newValue === '') {
                delete newFilterInfo.title
            } else {
                Object.assign(newFilterInfo, { title: newValue })
            }
            emit('filter', newFilterInfo)
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
