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
        const targetProject = projectStore._toFinded(projectId)
        const res = await projectStore.update(userId, projectId, updateInfo)
        if (res.code === '20000') {
            projectStore._update(projectId, updateInfo)
            if (onSuccess) onSuccess({ _target: targetProject, response: res })
        } else {
            if (onFailed) onFailed(res.message)
        }
        return res
    } catch (e) {
        NueMessage.error('操作失败' + `(${e})`)
    }
}

// Standards

export const toGettedProjects = async (filterOptions?: ProjectFilterOptions) => {
    const userId = userStore.user!.id
    const getResult = await projectStore.toGetted(userId, filterOptions)
    if (getResult.code !== '20000') return []
    return getResult.data
}

export const getProjects = async (filterOptions: ProjectFilterOptions) => {
    const userId = userStore.user!.id
    await projectStore.init(userId, filterOptions)
}

export const getProjectsWithNewFitlerOptions = async (newFilterOptions: ProjectFilterOptions) => {
    const userId = userStore.user!.id
    projectStore.mergeFilterInfo(newFilterOptions)
    await projectStore.get(userId)
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
        console.log('[ProjectHandler] Create project failed:', e)
    }
}

// Archive & Unarchive

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
        console.log('[ProjectHandler] Archive project failed:', e)
    }
}

const archiveProject = async (projectId: Project['id']) => {
    return await _handleUpdateProject(projectId, { isArchived: true })
}

export const archiveProjectWithConfirm = async (projectId: Project['id']) => {
    return await NueConfirm({
        title: '归档清单确认',
        content: '确认归档该清单吗？',
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        onConfirm: async () => await archiveProject(projectId)
    }).then(
        (res: any) => {
            requestIdleCallback(() => {
                if (res.code === '20000') {
                    NueMessage.success('清单归档成功')
                }
            })
            return res
        },
        (err) => {
            if (!err) return
            requestIdleCallback(() => {
                NueMessage.error(`清单归档失败 (${err})`)
            })
        }
    )
}

export const handleUnarchiveProject = async (projectId: Project['id']) => {
    try {
        await NueConfirm({
            title: '取消归档确认',
            content: '确认取消归档该清单吗？',
            confirmButtonText: '确认',
            cancelButtonText: '取消'
        })
        return await _handleUpdateProject(
            projectId,
            { isArchived: false },
            () => NueMessage.success('清单取消归档成功'),
            (err) => NueMessage.error('清单取消归档失败' + `(${err})`)
        )
    } catch (e) {
        console.log('[ProjectHandler] Unarchive project failed:', e)
    }
}

const unarchiveProject = async (projectId: Project['id']) => {
    return await _handleUpdateProject(projectId, { isArchived: false })
}

export const unarchiveProjectWithConfirm = async (projectId: Project['id']) => {
    return await NueConfirm({
        title: '取消归档确认',
        content: '确认取消归档该清单吗？',
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        onConfirm: async () => await unarchiveProject(projectId)
    }).then(
        (res: any) => {
            requestIdleCallback(() => {
                if (res.code === '20000') {
                    NueMessage.success('清单取消归档成功')
                }
            })
            return res
        },
        (err) => {
            if (!err) return
            requestIdleCallback(() => {
                NueMessage.error(`清单取消归档失败 (${err})`)
            })
        }
    )
}

// Delete & Restore

export const handleDeleteProject = async (projectId: Project['id']) => {
    try {
        await NueConfirm({
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
        console.log('[ProjectHandler] Delete project failed:', e)
    }
}

const deleteProject = async (projectId: Project['id']) => {
    return await _handleUpdateProject(projectId, { isDeleted: true })
}

export const deleteProjectWithConfirm = async (projectId: Project['id']) => {
    return await NueConfirm({
        title: '删除清单确认',
        content: '确认删除该清单吗？',
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        onConfirm: async () => await deleteProject(projectId)
    }).then(
        (res: any) => {
            requestIdleCallback(() => {
                if (res.code === '20000') {
                    NueMessage.success('清单删除成功')
                }
            })
            return res
        },
        (err) => {
            if (!err) return
            requestIdleCallback(() => {
                NueMessage.error(`清单删除失败 (${err})`)
            })
        }
    )
}

export const deleteProjectPermanentlyWithConfirm = async (projectId: Project['id']) => {
    const userId = userStore.user!.id
    return await NueConfirm({
        title: '永久删除清单确认',
        content: '确认永久删除该清单吗？',
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        onConfirm: async () => await projectStore.remove(userId, projectId)
    }).then(
        (res: any) => {
            requestIdleCallback(() => {
                if (res.code === '20000') {
                    NueMessage.success('清单删除成功')
                }
            })
            return res.code === '20000'
        },
        (err) => {
            if (!err) return
            requestIdleCallback(() => {
                NueMessage.error(`清单删除失败 (${err})`)
            })
        }
    )
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
        console.log('[ProjectHandler] Restore project failed:', e)
    }
}

const restoreProject = async (projectId: Project['id']) => {
    return await _handleUpdateProject(projectId, { isDeleted: false })
}

export const restoreProjectWithConfirm = async (projectId: Project['id']) => {
    return await NueConfirm({
        title: '恢复清单确认',
        content: '确认恢复该清单吗？',
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        onConfirm: async () => await restoreProject(projectId)
    }).then(
        (res: any) => {
            requestIdleCallback(() => {
                if (res.code === '20000') {
                    NueMessage.success('清单恢复成功')
                }
            })
            return res
        },
        (err) => {
            if (!err) return
            requestIdleCallback(() => {
                NueMessage.error(`清单恢复失败 (${err})`)
            })
        }
    )
}

// Rename

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
        console.log('[ProjectHandler] Rename project failed:', e)
    }
}

const renameProject = async (projectId: Project['id'], name: Project['title']) => {
    return await _handleUpdateProject(projectId, { title: name })
}

export const renameProjectWithPrompt = async (projectId: Project['id'], name: Project['title']) => {
    return await NuePrompt({
        title: '修改清单名称',
        placeholder: '请输入新的清单名称',
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        inputValue: name,
        validator: (value: string) => value,
        onConfirm: async (name: string) => await renameProject(projectId, name)
    }).then(
        (res: any) => {
            requestIdleCallback(() => {
                NueMessage.success('清单名称修改成功')
            })
            return res
        },
        (err) => {
            if (!err) return
            requestIdleCallback(() => {
                NueMessage.error(`清单名称修改失败 (${err})`)
            })
        }
    )
}

// Redesc

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
        console.log('[ProjectHandler] Redesc project failed:', e)
    }
}

const redescProject = async (projectId: Project['id'], description: Project['description']) => {
    return await _handleUpdateProject(projectId, { description })
}

export const redescProjectWithPrompt = async (
    projectId: Project['id'],
    description: Project['description']
) => {
    return await NuePrompt({
        title: '修改清单描述',
        placeholder: '请输入新的清单描述',
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputValue: description,
        validator: (value: string) => value,
        onConfirm: async (description: string) => await redescProject(projectId, description)
    }).then(
        (res: any) => {
            requestIdleCallback(() => {
                NueMessage.success('清单描述修改成功')
            })
            return res
        },
        (err) => {
            if (!err) return
            requestIdleCallback(() => {
                NueMessage.error(`清单描述修改失败 (${err})`)
            })
        }
    )
}

// Update project preference

export const handleUpdatePreference = async (
    projectId: Project['id'],
    newPreference: Project['preference']
) => {
    const res = await _handleUpdateProject(projectId, { preference: newPreference })
    // console.log(res);
    requestIdleCallback(() => {
        if (res.code === '20000') {
            NueMessage.success('清单偏好修改成功')
        } else {
            NueMessage.error('清单偏好修改失败')
        }
    })
}
