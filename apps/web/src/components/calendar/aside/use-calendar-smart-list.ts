import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { storeToRefs } from 'pinia'
import { computed, inject } from 'vue'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'

/**
 * useCalendarSmartList
 * @description 处理日历侧边栏的智能清单逻辑：清单/标签选项生成；
 *              选中状态来自日历视图共享筛选状态（与头部范围菜单同源）。
 */
const useCalendarSmartList = () => {
    // @stores
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()

    // @presetStates
    const { avaliableProjects: projects } = storeToRefs(projectsStore)
    const { tags } = storeToRefs(tagsStore)

    // @filterState 共享筛选状态（侧边栏复选框读写同一份数据）
    const { selectedProjectIds, selectedTagIds } = inject(CALENDAR_VIEW_CONTEXT_KEY)!

    // @computeds
    const projectOptions = computed(() => {
        return projects.value.map((p) => ({ id: p.id, name: p.name }))
    })
    const tagOptions = computed(() => {
        return tags.value
            .sort((a, b) => a.sortId - b.sortId)
            .map((t) => ({ id: t.id, name: t.name, color: t.color || 'default' }))
    })

    // @returns
    return {
        projectOptions,
        tagOptions,
        selectedProjectIds,
        selectedTagIds
    }
}

export default useCalendarSmartList