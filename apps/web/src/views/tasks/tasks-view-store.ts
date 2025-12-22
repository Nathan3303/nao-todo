import {
    useProjectApp,
    useBuiltInProjectApp,
    useTagApp,
    useUserApp,
    useTaskApp
} from '@nao-todo/application'
import useInitializer from '@/infrastructure/hooks/tasks-view/use-initializer'
import { defineStore } from 'pinia'
import { useAsideWidth } from '@nao-todo/hooks'
import { ref } from 'vue'
import { NueMessage, NuePrompt } from 'nue-ui'
import { unwrapError } from '@nao-todo/utils'
import { columnLabels } from '@/infrastructure/constants/task'
import type { TaskVO } from '@nao-todo/types'
import { useRouter } from 'vue-router'

export default defineStore('TasksViewStore', () => {
    // @appInstants
    const userApp = useUserApp()
    const projectApp = useProjectApp()
    const tagApp = useTagApp()
    const builtInProjectApp = useBuiltInProjectApp()
    const taskApp = useTaskApp()
    const router = useRouter()

    // @hook 任务界面初始化状态机
    const initializer = useInitializer(userApp, projectApp, builtInProjectApp, tagApp)

    // @hook 侧边栏宽度
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(256)
    const { width: outlineWidth, updater: handleResizeOutline } = useAsideWidth(480)

    // @states
    const isDisplayAside = ref(true)
    const isUseFloatAside = ref(false)
    const isUseFloatOutline = ref(false)

    // @method 更新清单名称
    // 通过 NuePrompt 组件实现用户输入并更新
    const updateProjectNameByNuePrompt = async (projectId: string) => {
        // 1. 获取目前的清单属性
        const currentProject = projectApp.getByIdFromMap(projectId)
        if (!currentProject) {
            NueMessage.error('清单数据获取失败')
            return
        }
        // 2. 弹出提示框，获取用户输入
        const [isByCancel, inputValue] = await NuePrompt({
            title: '更新清单名称',
            placeholder: '请输入清单名称',
            inputValue: currentProject.name,
            confirmButtonText: '确定',
            cancelButtonText: '取消'
        })
        // 3. 处理用户输入
        if (isByCancel) return
        if (!inputValue) {
            NueMessage.error('清单名称不能为空')
            return
        }
        // 4. 更新清单名称
        const updateErr = await projectApp.update(projectId, { name: inputValue as string })
        if (updateErr !== null) {
            NueMessage.error(unwrapError(updateErr))
            return
        }
        // 5. 更新成功
        NueMessage.success('清单名称更新成功')
    }

    // @method 更新清单描述
    // 通过 NuePrompt 组件实现用户输入采集
    const updateProjectDescriptionByNuePrompt = async (projectId: string) => {
        // 1. 获取目前的清单属性
        const currentProject = projectApp.getByIdFromMap(projectId)
        if (!currentProject) {
            NueMessage.error('清单数据获取失败')
            return
        }
        // 2. 弹出提示框，获取用户输入
        const [isByCancel, inputValue] = await NuePrompt({
            title: '更新清单描述',
            placeholder: '请输入清单描述',
            inputValue: currentProject.description,
            inputType: 'textarea',
            confirmButtonText: '确定',
            cancelButtonText: '取消'
        })
        // 3. 处理用户输入
        if (isByCancel) return
        if (!inputValue) {
            NueMessage.error('清单描述不能为空')
            return
        }
        // 4. 更新清单描述
        const updateErr = await projectApp.update(projectId, { description: inputValue as string })
        if (updateErr !== null) {
            NueMessage.error(unwrapError(updateErr))
            return
        }
        // 5. 更新成功
        NueMessage.success('清单描述更新成功')
    }

    // @method 获取列选项标识
    const getColumnLabel = (key: string): string => {
        return columnLabels[key] || ''
    }

    // @method 显示任务详情（面板）
    const showTaskDetails = async (taskId: TaskVO['id']) => {
        // 1. 检查任务 ID 是否合法
        if (!taskId) return
        // 2. 导航到任务详情路由
        return await router.push({ name: router.currentRoute.value.name, params: { taskId } })
    }

    // @returns 返回
    return {
        userProfile: userApp.userProfile,
        userApp,
        projects: projectApp.projects,
        projectApp,
        builtInProjects: builtInProjectApp.builtInProjects,
        builtInProjectApp,
        tags: tagApp.tags,
        tagApp,
        tasks: taskApp.tasks,
        taskApp,
        initializer,
        asideWidth,
        handleResizeAside,
        outlineWidth,
        handleResizeOutline,
        isDisplayAside,
        isUseFloatAside,
        isUseFloatOutline,
        updateProjectNameByNuePrompt,
        updateProjectDescriptionByNuePrompt,
        getColumnLabel,
        showTaskDetails
    }
})
