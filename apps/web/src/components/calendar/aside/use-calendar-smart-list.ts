import { useProjectsStore, useTagsStore } from '@/stores'
import { computed, inject, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'

/**
 * 处理日历侧边栏的智能清单逻辑，包括项目和标签的选项生成以及选中状态管理。
 */
const useCalendarSmartList = () => {
    const { dialogManager } = inject(CALENDAR_VIEW_CONTEXT_KEY)!

    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()

    const { avaliableProjects: projects } = storeToRefs(projectsStore)
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
        dialogManager,
        projectOptions,
        tagOptions,
        selectedProjectIds,
        selectedTagIds
    }
}

export default useCalendarSmartList



