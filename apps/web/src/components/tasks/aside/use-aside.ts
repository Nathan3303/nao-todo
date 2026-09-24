import { useProjectUseCase, useTagUseCase, useTaskUseCase } from '@/hooks'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { TASKS_VIEW_CONTEXT_KEY } from '@/views/index/tasks/context'
import { runProjectArchive } from '@/components/tasks/project/archive-project-action'
import { useBuiltInProjectsStore } from '@nao-todo/presentation/built-in-project'
import { useProjectsStore } from '@nao-todo/presentation/project'
import { useTagsStore } from '@nao-todo/presentation/tag'
import { useTasksStore } from '@nao-todo/presentation/task'
import { NaoSmartListLinkVO } from '@nao-todo/shared/components/smart-list'
import { PROJECT_MANAGER_DIALOG_KEY } from '@nao-todo/shared/constants'
import { storeToRefs } from 'pinia'
import { computed, inject, onMounted, onUnmounted, reactive, ref } from 'vue'

/**
 * 侧边栏状态 Hook
 */
export const useAside = () => {
    /**
     * 注入任务视图上下文
     */
    const { appDialogManager } = inject(TASKS_VIEW_CONTEXT_KEY)!
    const { asideWidth, handleResizeAside, isDisplayAside, isUseFloatAside, setControllOption } =
        inject(INDEX_VIEW_CONTEXT_KEY)!

    /**
     * 数据仓库
     */
    const builtInProjectsStore = useBuiltInProjectsStore()
    const projectsStore = useProjectsStore()
    const tagsStore = useTagsStore()

    // @usecase 业务依赖本地组装（DI 入口；不来自父视图上下文）
    const projectUseCase = useProjectUseCase(projectsStore)
    const tagUseCase = useTagUseCase(tagsStore)
    const taskUseCase = useTaskUseCase(useTasksStore())

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
    const handleProjectResort = async (originalId: string, boundId: string, isBefore: boolean) => {
        await projectUseCase.resort(originalId, boundId, isBefore)
    }

    /**
     * 处理标签拖拽排序
     * @param originalId 原始标签 ID
     * @param boundId 目标标签 ID
     * @param isBefore 是否在目标标签之前
     */
    const handleTagResort = async (originalId: string, boundId: string, isBefore: boolean) => {
        await tagUseCase.resort(originalId, boundId, isBefore)
    }

    /**
     * @state 清单右键菜单
     * @description 入口二（PRD §3-1）：侧栏清单链接右键弹出菜单（项 id = `archive-project`，
     *              与头部 execute-id 同一 id ⇒ 一次 handler 覆盖两处入口，ADR §15.3）
     */
    const contextMenu = reactive<{
        visible: boolean
        x: number
        y: number
        projectId: string | null
    }>({ visible: false, x: 0, y: 0, projectId: null })

    const closeProjectContextMenu = () => {
        contextMenu.visible = false
        contextMenu.projectId = null
    }

    /** 右键打开清单菜单（事件委派：`data-drag-id` = 清单 ID） */
    const openProjectContextMenu = (event: MouseEvent) => {
        const link = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-drag-id]')
        const projectId = link?.dataset.dragId ?? null
        if (!projectId || !projects.value.some((p) => p.id === projectId)) return
        contextMenu.projectId = projectId
        contextMenu.x = event.clientX
        contextMenu.y = event.clientY
        contextMenu.visible = true
    }

    /** 执行菜单项（与头部归档同一实现：二次确认 N + 归档） */
    const executeProjectContextMenu = async (executeId: string): Promise<void> => {
        const projectId = contextMenu.projectId
        closeProjectContextMenu()
        if (executeId !== 'archive-project' || !projectId) return
        await runProjectArchive({
            taskUseCase,
            projectId,
            archive: (id) => projectUseCase.archive(id)
        })
    }

    /**
     * 打开清单管理弹窗（可指定初始 tab）
     * @description 侧栏底部「已归档」入口 ⇒ 直达 `archived` tab（PRD §3-3 / DP-5）
     */
    const openProjectManager = (
        activeTab: 'all' | 'active' | 'deleted' | 'archived' = 'all'
    ): void => {
        appDialogManager.open(PROJECT_MANAGER_DIALOG_KEY, { activeTab })
    }

    // 键盘可达：Esc 关闭右键菜单
    const handleContextMenuKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') closeProjectContextMenu()
    }
    onMounted(() => document.addEventListener('keydown', handleContextMenuKeydown))
    onUnmounted(() => document.removeEventListener('keydown', handleContextMenuKeydown))

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
        isDisplayAside,
        isUseFloatAside,
        setControllOption,
        contextMenu,
        openProjectContextMenu,
        closeProjectContextMenu,
        executeProjectContextMenu,
        openProjectManager
    }
}