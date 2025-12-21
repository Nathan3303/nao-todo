import { useProjectApp, useBuiltInProjectApp, useTagApp, useUserApp } from '@nao-todo/application'
import useInitializer from '@/infrastructure/hooks/tasks-view/use-initializer'
import { defineStore } from 'pinia'
import { useAsideWidth } from '@nao-todo/hooks'
import { ref } from 'vue'
import { NueMessage, NuePrompt } from 'nue-ui'
import { unwrapError } from '@nao-todo/utils'
import { columnLabels } from './constants'

export default defineStore('TasksViewStore', () => {
    // @appInstants
    const userApp = useUserApp()
    const projectApp = useProjectApp()
    const tagApp = useTagApp()
    const builtInProjectApp = useBuiltInProjectApp()

    // @hook 任务界面初始化状态机
    const initializer = useInitializer(userApp, projectApp, builtInProjectApp, tagApp)

    // @hook 侧边栏宽度
    const { width: asideWidth, updater: handleResizeAside } = useAsideWidth(256)

    // @states
    const isDisplayAside = ref(true)
    const isUseFloatAside = ref(false)

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

    // @returns
    return {
        userProfile: userApp.userProfile,
        projects: projectApp.projects,
        builtInProjects: builtInProjectApp.builtInProjects,
        tags: tagApp.tags,
        initializer,
        asideWidth,
        handleResizeAside,
        isDisplayAside,
        isUseFloatAside,
        projectApp,
        tagApp,
        builtInProjectApp,
        updateProjectNameByNuePrompt,
        updateProjectDescriptionByNuePrompt,
        getColumnLabel
    }
})
