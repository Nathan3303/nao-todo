import { computed, inject, reactive, ref } from 'vue'
import { ProjectHandler } from '@/infrastructure/handlers/project'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { useProjectsStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { PROJECT_CREATOR_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'

/**
 * 项目管理器状态
 * @description 项目管理器状态，包含筛选信息和当前选中的标签页
 */
export type ProjectManagerVO = {
    filterInfo: { name?: string }
    activeTab: 'all' | 'active' | 'deleted'
}

/**
 * 项目管理器
 * @description 管理项目列表，包括筛选、删除、恢复等操作
 * @param props 项目列表和项目创建器打开函数
 * @param emit 事件管理器
 */
const useProjectManager = () => {
    /**
     * 项目管理器上下文
     * @description 项目管理器上下文，包含项目和任务的使用案例
     */
    const { projectUseCase, subscriber, dialogManager } =
        inject(INDEX_VIEW_CONTEXT_KEY)!

    /**
     * 项目管理器存储
     * @description 项目管理器存储，用于存储项目偏好设置
     */
    const projectsStore = useProjectsStore()

    /**
     * 项目列表
     * @description 项目列表，包含所有项目
     */
    const { projects } = storeToRefs(projectsStore)

    /**
     * 项目加载状态
     * @description 项目加载状态，用于跟踪项目是否正在加载中
     */
    const loadingProjects = ref<Map<string, boolean>>(new Map())

    /**
     * 项目管理器状态
     */
    const states = reactive<ProjectManagerVO>({
        filterInfo: { name: '' },
        activeTab: 'all'
    })

    /**
     * 项目管理器操作器
     * @description 项目管理器操作器，用于执行项目相关的操作
     */
    const projectHandler = new ProjectHandler(projectUseCase, projectsStore, subscriber)

    /**
     * 根据 filterInfo 和 activeTab 筛选项目
     * @description 筛选项目列表，根据名称和状态筛选出符合条件的项目
     * @returns 筛选后的项目列表
     */
    const filteredProjects = computed(() => {
        const { name } = states.filterInfo
        return projects.value.filter((project) => {
            const nameMatch = name ? project.name.includes(name) : true
            let statusMatch = true
            if (states.activeTab === 'active') {
                statusMatch = !project.isDeleted
            } else if (states.activeTab === 'deleted') {
                statusMatch = project.isDeleted
            }
            return nameMatch && statusMatch
        })
    })

    /**
     * 设置当前选中的标签页
     * @param tab 要设置的标签页
     */
    const setActiveTab = (tab: 'all' | 'active' | 'deleted') => (states.activeTab = tab)

    /**
     * 删除清单
     * @param projectId 清单 ID
     */
    const deleteProject = (projectId: string) => {
        loadingProjects.value.set(projectId, true)
        projectHandler.deleteProject(projectId).finally(() => {
            loadingProjects.value.set(projectId, false)
        })
    }

    /**
     * 恢复清单
     * @param projectId 清单 ID
     */
    const restoreProject = (projectId: string) => {
        loadingProjects.value.set(projectId, true)
        projectHandler.restoreProject(projectId).finally(() => {
            loadingProjects.value.set(projectId, false)
        })
    }

    /**
     * 打开项目创建器对话框
     * @description 打开项目创建器对话框，用于创建新项目
     */
    const openProjectCreatorDialog = () => {
        dialogManager.open(PROJECT_CREATOR_DIALOG_KEY)
    }

    // @returns
    return {
        states,
        filteredProjects,
        loadingProjects,
        dialogManager,
        setActiveTab,
        deleteProject,
        restoreProject,
        openProjectCreatorDialog
    }
}

export default useProjectManager


