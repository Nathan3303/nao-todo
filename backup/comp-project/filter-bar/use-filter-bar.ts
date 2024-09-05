import { ref, watch, computed } from 'vue'
import type { ProjectFilterBarProps, ProjectFilterBarEmits, FilterOptions } from './types'
import type { ProjectFilterOptions } from '@/stores'

export const useProjectFilterBar = (props: ProjectFilterBarProps, emit: ProjectFilterBarEmits) => {
    const filterText = ref<string>('')

    const isFiltering = computed(() => {
        if (!props.filterInfo) return false
        const { id, title } = props.filterInfo
        return id || title
    })

    const handleResetFilter = () => {
        filterText.value = ''
        const emptyFilterInfo: ProjectFilterOptions = { id: '', title: '' }
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
