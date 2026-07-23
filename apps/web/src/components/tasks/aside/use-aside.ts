import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { TASKS_VIEW_CONTEXT_KEY } from '@/views/index/tasks/context'
import { useBuiltInProjectsStore } from '@nao-todo/presentation/built-in-project'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { NaoSmartListLinkVO } from '@nao-todo/shared'
import { storeToRefs } from 'pinia'
import { computed, inject, ref } from 'vue'

/**
 * 侧边栏状态 Hook
 */
export const useAside = () => {
    /**
     * 注入任务视图上下文
     */
    const { appDialogManager, projectUseCase, tagUseCase } = inject(TASKS_VIEW_CONTEXT_KEY)!
    const { asideWidth, handleResizeAside, isDisplayAside } = inject(INDEX_VIEW_CONTEXT_KEY)!

    /**
     * 数据仓库
     */
    const builtInProjectsStore = useBuiltInProjectsStore()
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()

    /**
     * 前置数据
     */
    const { builtInProjects } = storeToRefs(builtInProjectsStore)
    const { avaliableProjects: projects } = storeToRefs(projectsStore)
    const { tags } = storeToRefs(tagsStore)

    /**
     * @state 侧边栏折叠项
     */
    const collapseItemsRecord = ref(['projects', 'filters', 'tags'])

    /**
     * @computed 侧边栏内建清单路由按钮视图对象
     */
    const builtInProjectLinks = computed<NaoSmartListLinkVO[]>(() => {
        return builtInProjects.value.map((project) => ({
            id: project.id,
            title: project.name,
            route: { name: 'tasks-built-in-project', params: { projectId: project.id } },
            icon: project.icon
        }))
    })

    /**
     * @computed 侧边栏清单路由按钮视图对象
     */
    const projectLinks = computed<NaoSmartListLinkVO[]>(() => {
        return projects.value.map((p) => ({
            id: p.id,
            title: p.name,
            route: { name: 'tasks-project', params: { projectId: p.id } },
            icon: p.icon || 'more2'
        }))
    })

    /**
     * @computed 侧边栏标签路由按钮视图对象（按 sortId 排序）
     */
    const tagLinks = computed<NaoSmartListLinkVO[]>(() => {
        const sortedTags = [...tags.value].sort((a, b) => a.sortId - b.sortId)
        return sortedTags.map((tag) => ({
            id: tag.id,
            title: tag.name,
            route: { name: 'tasks-tag', params: { tagId: tag.id } },
            icon: tag.icon || 'tag',
            payload: { color: tag.color || 'transparent' }
        }))
    })

    /**
     * 处理项目拖拽排序
     * @param originalId 原始项目 ID
     * @param boundId 目标项目 ID
     * @param isBefore 是否在目标项目之前
     */
    const handleProjectResort = (originalId: string, boundId: string, isBefore: boolean) => {
        projectUseCase.resort(originalId, boundId, isBefore)
    }

    /**
     * 处理标签拖拽排序
     * @param originalId 原始标签 ID
     * @param boundId 目标标签 ID
     * @param isBefore 是否在目标标签之前
     */
    const handleTagResort = (originalId: string, boundId: string, isBefore: boolean) => {
        tagUseCase.resort(originalId, boundId, isBefore)
    }

    // @returns
    return {
        builtInProjectLinks,
        projectLinks,
        tagLinks,
        handleProjectResort,
        handleTagResort,
        collapseItemsRecord,
        dialogManager: appDialogManager,
        asideWidth,
        handleResizeAside,
        isDisplayAside
    }
}
