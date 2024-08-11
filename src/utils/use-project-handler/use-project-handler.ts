import { useUserStore, useProjectStore } from '@/stores'
import { NueConfirm, NueMessage } from 'nue-ui'
import type { Project, ProjectCreateOptions, ProjectFilterOptions } from '@/stores'

export const useProjectHandler = () => {
    const userStore = useUserStore()
    const projectStore = useProjectStore()

    const handleGetProjects = async (filterOptions: ProjectFilterOptions) => {
        const userId = userStore.user!.id
        await projectStore.init(userId, filterOptions)
    }

    const handleCreateProject = async (createOptions: ProjectCreateOptions) => {
        const userId = userStore.user!.id
        const res = await projectStore.create(userId, { ...createOptions })
        if (res.code === '20000') {
            projectStore._create(res.data)
            NueMessage.success('清单创建成功')
        }
        return res
    }

    const handleArchiveProject = async (projectId: Project['id']) => {
        try {
            await NueConfirm({
                title: '归档清单确认',
                content: '确认归档该清单吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            const userId = userStore.user!.id
            const res = await projectStore.update(userId, projectId, { isArchived: true })
            if (res.code === '20000') {
                // projectStore._update(projectId, { isArchived: true })
                projectStore._remove(projectId)
                NueMessage.success('清单归档成功')
            }
            return res
        } catch (e) {
            console.log(e)
        }
    }

    const handleUnarchiveProject = async (projectId: Project['id']) => {
        try {
            await NueConfirm({
                title: '取消归档确认',
                content: '确认取消归档该清单吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            const userId = userStore.user!.id
            const res = await projectStore.update(userId, projectId, { isArchived: false })
            if (res.code === '20000') {
                // projectStore._update(projectId, { isArchived: false })
                projectStore._remove(projectId)
                NueMessage.success('清单取消归档成功')
            }
            return res
        } catch (e) {
            console.log(e)
        }
    }

    const handleDeleteProject = async (projectId: Project['id']) => {
        try {
            await NueConfirm({
                title: '删除清单确认',
                content: '确认删除该清单吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            const userId = userStore.user!.id
            const res = await projectStore.update(userId, projectId, { isDeleted: true })
            if (res.code === '20000') {
                projectStore._remove(projectId)
                NueMessage.success('清单删除成功')
            }
            return res
        } catch (e) {
            console.log(e)
        }
    }

    const handleRestoreProject = async (projectId: Project['id']) => {
        try {
            await NueConfirm({
                title: '恢复清单确认',
                content: '确认恢复该清单吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消'
            })
            const userId = userStore.user!.id
            const res = await projectStore.update(userId, projectId, { isDeleted: false })
            if (res.code === '20000') {
                // projectStore._update(projectId, { isArchived: false })
                projectStore._remove(projectId)
                NueMessage.success('清单恢复成功')
            }
            return res
        } catch (e) {
            console.log(e)
        }
    }

    return {
        handleGetProjects,
        handleCreateProject,
        handleArchiveProject,
        handleUnarchiveProject,
        handleDeleteProject,
        handleRestoreProject
    }
}
