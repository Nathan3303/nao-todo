import { useUserStore, useProjectStore } from '@/stores'
import { NueConfirm, NueMessage, NuePrompt } from 'nue-ui'
import type { Project, ProjectCreateOptions, ProjectFilterOptions } from '@/stores'

const userStore = useUserStore()
const projectStore = useProjectStore()

export const _handleUpdateProject = async (
    projectId: Project['id'],
    updateInfo: Partial<Project>,
    onSuccess?: (payload: any) => void,
    onFailed?: (payload: any) => void
) => {
    try {
        const userId = userStore.user!.id
        const res = await projectStore.update(userId, projectId, updateInfo)
        if (res.code === '20000') {
            projectStore._update(projectId, updateInfo)
            if (onSuccess) onSuccess(res.data)
        } else {
            if (onFailed) onFailed(res.message)
        }
        return res
    } catch (e) {
        NueMessage.error('操作失败' + `(${e})`)
    }
}

// Standards

export const getProjects = async (filterOptions: ProjectFilterOptions) => {
    const userId = userStore.user!.id
    await projectStore.init(userId, filterOptions)
}

export const createProject = async (createOptions: ProjectCreateOptions) => {
    try {
        const userId = userStore.user!.id
        const res = await projectStore.create(userId, { ...createOptions })
        if (res.code === '20000') {
            projectStore._create(res.data)
            NueMessage.success('清单创建成功')
        }
        return res
    } catch (e) {
        NueMessage.info('操作取消')
    }
}

export const handleArchiveProject = async (projectId: Project['id']) => {
    try {
        await NueConfirm({
            title: '归档清单确认',
            content: '确认归档该清单吗？',
            confirmButtonText: '确认',
            cancelButtonText: '取消'
        })
        return _handleUpdateProject(
            projectId,
            { isArchived: true },
            () => NueMessage.success('清单归档成功'),
            (err) => NueMessage.error('清单归档失败' + `(${err})`)
        )
    } catch (e) {
        NueMessage.info('操作取消')
    }
}

export const handleUnarchiveProject = async (projectId: Project['id']) => {
    try {
        await NueConfirm({
            title: '取消归档确认',
            content: '确认取消归档该清单吗？',
            confirmButtonText: '确认',
            cancelButtonText: '取消'
        })
        return _handleUpdateProject(
            projectId,
            { isArchived: false },
            () => NueMessage.success('清单取消归档成功'),
            (err) => NueMessage.error('清单取消归档失败' + `(${err})`)
        )
    } catch (e) {
        NueMessage.info('操作取消')
    }
}

export const handleDeleteProject = async (projectId: Project['id']) => {
    try {
        await NuePrompt({
            title: '删除清单确认',
            content: '确认删除该清单吗？',
            confirmButtonText: '确认',
            cancelButtonText: '取消'
        })
        return _handleUpdateProject(
            projectId,
            { isDeleted: true },
            () => NueMessage.success('清单删除成功'),
            (err) => NueMessage.error('清单删除失败' + `(${err})`)
        )
    } catch (e) {
        NueMessage.info('操作取消')
    }
}

export const handleRestoreProject = async (projectId: Project['id']) => {
    try {
        await NueConfirm({
            title: '恢复清单确认',
            content: '确认恢复该清单吗？',
            confirmButtonText: '确认',
            cancelButtonText: '取消'
        })
        return _handleUpdateProject(
            projectId,
            { isDeleted: false },
            () => NueMessage.success('清单恢复成功'),
            (err) => NueMessage.error('清单恢复失败' + `(${err})`)
        )
    } catch (e) {
        NueMessage.info('操作取消')
    }
}

export const handleRenameProject = async (projectId: Project['id'], name: Project['title']) => {
    try {
        const newName = await NuePrompt({
            title: '修改清单名称',
            placeholder: '请输入新的清单名称',
            confirmButtonText: '确认',
            cancelButtonText: '取消',
            inputValue: name,
            validator: (value: string) => value
        })
        if (!newName) return
        const updateInfo = { title: newName as string }
        return _handleUpdateProject(
            projectId,
            updateInfo,
            () => NueMessage.success('清单名称修改成功'),
            (err) => NueMessage.error('清单名称修改失败' + `(${err})`)
        )
    } catch (e) {
        NueMessage.info('操作取消')
    }
}

export const handleRedescProject = async (
    projectId: Project['id'],
    description: Project['description']
) => {
    try {
        const newDescription = await NuePrompt({
            title: '修改清单名称',
            placeholder: '请输入新的清单描述',
            confirmButtonText: '确认',
            cancelButtonText: '取消',
            inputType: 'textarea',
            inputValue: description,
            validator: (value: string) => value
        })
        if (!newDescription) return
        const updateInfo = { description: newDescription as string }
        return _handleUpdateProject(
            projectId,
            updateInfo,
            () => NueMessage.success('清单描述修改成功'),
            (err) => NueMessage.error('清单描述修改失败' + `(${err})`)
        )
    } catch (e) {
        NueMessage.info('操作取消')
    }
}
