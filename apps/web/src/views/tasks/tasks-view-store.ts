import {
    useProjectApp,
    useBuiltInProjectApp,
    useTagApp,
    useUserApp,
    useTaskApp,
    useEventApp
} from '@nao-todo/application'
import useInitializer from '@/infrastructure/hooks/tasks-view/use-initializer'
import { defineStore } from 'pinia'
import { useAsideWidth } from '@nao-todo/hooks'
import { ref } from 'vue'
import { columnLabels } from '@/infrastructure/constants/task'
import type { TagVO, TaskVO } from '@nao-todo/types'
import { useRouter } from 'vue-router'
import useAppStore from '@/views/app-store'
import useCommentApp from '@nao-todo/application/comment/app'
import useProjectHandlers from '@/infrastructure/hooks/tasks-view/use-project-handlers'
import useTagHandlers from '@/infrastructure/hooks/tasks-view/use-tag-handlers'
import useDialogManager from '@/infrastructure/hooks/tasks-view/use-dialog-manager'

export default defineStore('TasksViewStore', () => {
    // @store
    const router = useRouter()
    const appStore = useAppStore()

    // @appInstants
    const userApp = useUserApp()
    const projectApp = useProjectApp()
    const tagApp = useTagApp()
    const builtInProjectApp = useBuiltInProjectApp()
    const taskApp = useTaskApp()
    const eventApp = useEventApp()
    const commentApp = useCommentApp()

    // @states
    const isDisplayAside = ref(true)
    const isUseFloatAside = ref(false)
    const isUseFloatOutline = ref(false)

    // @hook 任务界面初始化状态机
    const initializer = useInitializer(userApp, projectApp, builtInProjectApp, tagApp)

    // @hook 侧边栏宽度
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(256, 'ASIDE_WIDTH')
    const { width: outlineWidth, updater: handleResizeOutline } = useAsideWidth(
        480,
        'OUTLINE_WIDTH'
    )

    // @hook 清单相关处理函数
    const projectHandlers = useProjectHandlers(projectApp)

    // @hook 标签相关处理函数
    const tagHandlers = useTagHandlers(tagApp)

    // @hook 对话框管理
    const dialogManager = useDialogManager()

    // @method 获取列选项标识
    const getColumnLabel = (key: string): string => {
        return columnLabels[key] || ''
    }

    // @method 显示任务详情（面板）
    const showTaskDetails = async (taskId: TaskVO['id']) => {
        if (!taskId) return
        return await router.push({
            name: router.currentRoute.value.name,
            params: { taskId }
        })
    }

    // @method 获取标签颜色
    const getTagColor = (tagId: TagVO['id']): string => {
        return tagApp.getByIdFromMap(tagId)?.color || 'transparent'
    }

    // @returns 返回
    return {
        appStore,
        dialogManager,
        userApp,
        projectApp,
        projectHandlers,
        builtInProjectApp,
        tagApp,
        tagHandlers,
        taskApp,
        eventApp,
        commentApp,
        // userProfile: computed(() => userApp.states.profile),
        // projects: computed(() => projectApp.projects),
        // builtInProjects: computed(() => builtInProjectApp.states.projects),
        // tags: tagApp.tags,
        // tasks: taskApp.states.tasks,
        initializer,
        asideWidth,
        handleResizeAside,
        outlineWidth,
        handleResizeOutline,
        isDisplayAside,
        isUseFloatAside,
        isUseFloatOutline,
        getColumnLabel,
        showTaskDetails,
        getTagColor
    }
})
