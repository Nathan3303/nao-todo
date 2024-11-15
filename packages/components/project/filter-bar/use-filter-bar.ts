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
        const isArchived = props.filterOptions.isArchived
        return isArchived ? 'square-check-fill' : 'square'
    })

    const deletedOnlyIconName = computed(() => {
        const isDeleted = props.filterOptions.isDeleted
        return isDeleted ? 'square-check-fill' : 'square'
    })

    const handleResetFilter = () => {
        filterText.value = ''
        const newFilterOptions = { ...props.filterOptions }
        delete newFilterOptions.title
        delete newFilterOptions.isDeleted
        delete newFilterOptions.isArchived
        // console.log(newFilterOptions)
        emit('filter', newFilterOptions)
    }

    const handleIsArchived = () => {
        const newFilterOptions = { ...props.filterOptions }
        if (newFilterOptions.isArchived) {
            delete newFilterOptions.isArchived
        } else {
            Object.assign(newFilterOptions, { isArchived: true })
        }
        // console.log(newFilterOptions)
        emit('filter', newFilterOptions)
    }

    const handleIsDeleted = () => {
        const newFilterOptions = { ...props.filterOptions }
        if (newFilterOptions.isDeleted) {
            delete newFilterOptions.isDeleted
        } else {
            Object.assign(newFilterOptions, { isDeleted: true })
        }
        // console.log(newFilterOptions)
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
