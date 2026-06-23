import { TASKS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { useBuiltInProjectsStore, useProjectsStore, useTagsStore } from '@/stores'
import { TasksViewContext } from '@/views/index/tasks/tasks-view'
import { NaoSmartListLinkVO } from '@nao-todo/components'
import { storeToRefs } from 'pinia'
import { computed, inject, ref } from 'vue'

/**
 * 侧边栏状态 Hook
 */
export const useAside = () => {
    /**
     * 注入任务视图上下文
     */
    const {
        dialogManager,
        asideWidth,
        handleResizeAside,
        isDisplayAside,
        projectUseCase,
        tagUseCase
    } = inject<TasksViewContext>(TASKS_VIEW_CONTEXT_KEY)!

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
    const projectLinks = computed(() => {
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
        return [...tags.value.values()]
            .sort((a, b) => a.sortId - b.sortId)
            .map((tag) => ({
                id: tag.id,
                title: tag.name,
                route: { name: 'tasks-tag', params: { tagId: tag.id } },
                icon: 'tag',
                payload: { color: tag.color || 'default' }
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
        dialogManager,
        asideWidth,
        handleResizeAside,
        isDisplayAside
    }
}

