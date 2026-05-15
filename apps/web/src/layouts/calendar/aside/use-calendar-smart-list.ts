import { useProjectsStore, useTagsStore } from '@/stores'
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

const useCalendarSmartList = () => {
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()

    const { availableProjects: projects } = storeToRefs(projectsStore)
    const { tags } = storeToRefs(tagsStore)

    const projectOptions = computed(() => projects.value.map((p) => ({ id: p.id, name: p.name })))

    const tagOptions = computed(() =>
        [...tags.value]
            .sort((a, b) => a.sortId - b.sortId)
            .map((t) => ({ id: t.id, name: t.name, color: t.color || 'default' }))
    )

    const selectedProjectIds = ref<string[]>([])
    const selectedTagIds = ref<string[]>([])

    watch(
        selectedProjectIds,
        (val) => {
            console.log('Selected project IDs:', val)
        },
        { deep: true }
    )

    watch(
        selectedTagIds,
        (val) => {
            console.log('Selected tag IDs:', val)
        },
        { deep: true }
    )

    return {
        projectOptions,
        tagOptions,
        selectedProjectIds,
        selectedTagIds
    }
}

export default useCalendarSmartList

