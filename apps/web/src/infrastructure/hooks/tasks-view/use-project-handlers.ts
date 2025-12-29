import type { ProjectApp } from '@nao-todo/application/project'
import { unwrapError } from '@nao-todo/utils'
import { NueMessage, NuePrompt } from 'nue-ui'

const useProjectHandlers = (projectApp: ProjectApp) => {
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

    // @method 获取清单名称
    const getNameById = (projectId: string): string => {
        const project = projectApp.getByIdFromMap(projectId)
        return project?.name || '收集箱'
    }

    // @return 项目相关的处理函数
    return {
        updateProjectNameByNuePrompt,
        updateProjectDescriptionByNuePrompt,
        getNameById
    }
}

export default useProjectHandlers
