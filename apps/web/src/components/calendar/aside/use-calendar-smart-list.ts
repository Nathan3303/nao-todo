import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

/**
 * useCalendarSmartList
 * 处理日历侧边栏的智能清单逻辑，包括项目和标签的选项生成以及选中状态管理。
 */
const useCalendarSmartList = () => {
    // @stores
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()

    // @presetStates
    const { avaliableProjects: projects } = storeToRefs(projectsStore)
    const { tags } = storeToRefs(tagsStore)

    // @states
    const selectedProjectIds = ref<string[]>([]) // 已选择的清单（筛选）
    const selectedTagIds = ref<string[]>([]) // 已选择的标签（筛选）

    // @computeds
    const projectOptions = computed(() => {
        return projects.value.map((p) => ({ id: p.id, name: p.name }))
    })
    const tagOptions = computed(() => {
        return tags.value
            .sort((a, b) => a.sortId - b.sortId)
            .map((t) => ({ id: t.id, name: t.name, color: t.color || 'default' }))
    })

    // @watchs 调试
    watch(selectedProjectIds, (val) => console.log('Selected project IDs:', val), { deep: true })
    watch(selectedTagIds, (val) => console.log('Selected tag IDs:', val), { deep: true })

    // @returns
    return {
        projectOptions,
        tagOptions,
        selectedProjectIds,
        selectedTagIds
    }
}

export default useCalendarSmartList