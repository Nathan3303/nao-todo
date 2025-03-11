import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { createProject, deleteProject, getProjects, updateProject } from '@nao-todo/apis'
import type {
    CreateProjectOptions,
    GetProjectsOptions,
    GetProjectsOptionsRaw,
    Project,
    ProjectPreference,
    UpdateProjectOptions,
    UpdateProjectOptionsRaw
} from '@nao-todo/types'
import { NueConfirm, NueMessage, NuePrompt } from 'nue-ui'
import { useMoment } from '@nao-todo/utils'

export const useProjectStore = defineStore('projectStore', () => {
    const projects = ref<Project[]>([])

    // 获取选项
    const getOptions = shallowRef<GetProjectsOptions>({
        page: 1,
        limit: 99,
        sort: { field: 'createdAt', order: 'desc' }
    })

    // 智能清单列表
    const smartListData = computed<Project[]>(() => {
        return projects.value.filter((project) => {
            return !project.isDeleted && !project.isArchived
        })
    })

    /**
     * 更新获取项目的选项
     *
     * 此函数用于更新获取项目列表的选项它接受一个新的选项对象，并用这个新选项替换当前的选项
     * 这有助于在应用程序中灵活地更改获取项目时的参数，例如分页信息、排序规则等
     *
     * @param newOptions - 新的选项，包含更新的参数用于替换旧的选项
     */
    const updateGetOptions = (newOptions: GetProjectsOptions) => {
        getOptions.value = newOptions
    }

    /**
     * 异步函数用于创建项目
     *
     * @param options 创建项目的选项，包括项目名称、描述等信息
     * @returns 返回一个布尔值，表示项目是否成功创建
     */
    const doCreateProject = async (options: CreateProjectOptions) => {
        // 调用createProject函数创建项目，并等待结果
        const result = await createProject(options)
        // 检查返回结果的code是否为20000，如果不是，则表示创建失败，返回false
        if (result.code !== 20000) return false
        // 如果创建成功，从结果数据中获取新创建的项目信息
        const newProject = result.data as Project
        // 输出新创建的项目信息，用于调试目的
        // console.log('[UseProjectStore] doCreateProject:', newProject)
        // 将新创建的项目添加到项目的列表中
        projects.value.push(newProject)
        // 返回true，表示项目创建成功
        return newProject
    }

    /**
     * 更新项目信息的异步函数
     *
     * @param projectId 项目ID，用于标识需要更新的项目
     * @param options 包含需要更新的项目信息的选项对象
     * @returns 返回一个布尔值，表示项目是否成功更新
     */
    const doUpdateProject = async (projectId: Project['id'], options: UpdateProjectOptions) => {
        // 调用updateProject函数更新项目信息，并等待结果
        const result = await updateProject(projectId, options)
        // 如果更新结果的code不为20000，表示更新失败，返回false
        if (result.code !== 20000) return false

        // 在projects数组中查找需要更新的项目索引
        const index = projects.value.findIndex((project) => project.id === projectId)
        // 如果找不到对应的项目，返回false
        if (index === -1) return false

        // 获取需要更新的项目对象
        const project = projects.value[index]
        // 遍历项目对象的属性，根据options更新项目信息
        Object.keys(project).forEach((key) => {
            // 如果options中包含当前属性的值，则更新项目对象的对应属性
            if (
                Object.prototype.hasOwnProperty.call(options, key as keyof UpdateProjectOptionsRaw)
            ) {
                // console.log('[UseProjectStore/doUpdateProject] Update forEach log:', key, project[key as keyof Project], options[key as keyof UpdateProjectOptionsRaw])
                project[key as keyof Project] = options[
                    key as keyof UpdateProjectOptionsRaw
                ] as never
            }
        })

        // 项目信息更新成功，返回true
        return true
    }

    /**
     * 异步获取项目列表
     *
     * 本函数通过调用`getProjects`函数并传递当前的`getOptions.value`来获取项目数据
     * 如果返回结果的代码不是20000，则表示获取失败，函数返回false
     * 否则，将返回的项目数据赋值给`projects.value`，并返回true表示成功
     *
     * @returns Promise<boolean> 获取项目列表是否成功
     */
    const doGetProjects = async () => {
        // 调用getProjects函数获取项目数据
        const result = await getProjects(getOptions.value)
        // 检查返回结果的代码，如果不等于20000，则表示获取失败，返回false
        if (result.code !== 20000) return false
        // 将获取到的项目数据赋值给projects.value，并指定类型为Project数组，表示获取成功，返回true
        projects.value = result.data as Project[]
        return true
    }

    /**
     * 异步函数用于删除指定的项目
     *
     * 该函数首先调用deleteProject函数尝试删除给定ID的项目如果删除操作成功（即deleteProject函数返回的结果代码为20000），
     * 则从projects数组中移除对应的项目，最后返回true表示删除成功；否则，返回false表示删除失败
     *
     * @param projectId 项目ID，指定要删除的项目
     * @returns 返回一个布尔值，true表示删除成功，false表示删除失败
     */
    const doDeleteProject = async (projectId: Project['id']) => {
        // 尝试删除项目
        const result = await deleteProject(projectId)
        // 检查删除结果，如果不成功则返回false
        if (result.code !== 20000) return false
        // 查找projects数组中待删除项目的索引
        const index = projects.value.findIndex((project) => project.id === projectId)
        // 如果找到项目，则从数组中移除
        if (index !== -1) projects.value.splice(index, 1)
        // 返回true表示删除成功
        return true
    }

    /**
     * 异步函数：通过用户提示更新项目标题
     *
     * 此函数用于显示一个提示对话框，让用户输入新的项目标题，并尝试更新项目标题
     * 如果更新成功，会显示成功消息；如果更新失败，会显示错误消息
     *
     * @param projectId 项目的唯一标识符
     * @param currentTitle 当前项目的标题，用作提示对话框的默认输入值
     * @returns 返回一个布尔值，表示项目标题是否更新成功
     */
    const updateProjectTitleWithPrompt = async (
        projectId: Project['id'],
        currentTitle: Project['title']
    ) => {
        try {
            // 显示用户提示对话框，让用户输入新的项目标题
            const result = await NuePrompt({
                title: '修改清单名称',
                placeholder: '请输入新的清单名称',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                inputValue: currentTitle,
                // 简单的验证器，确保输入值不为空
                validator: (value: string) => value,
                onConfirm: async (newTitle: string) =>
                    await doUpdateProject(projectId, { title: newTitle })
            })
            if (result) {
                // 如果更新成功，显示成功消息
                NueMessage.success('清单名称修改成功')
                return true
            } else {
                // 如果更新失败，显示错误消息
                NueMessage.error('清单名称修改失败')
            }
        } catch (error) {
            // 捕获异常并打印错误信息
            console.warn('[UseProjectStore] updateProjectTitleWithPrompt:', error)
        }
        // 如果执行到此处，表示更新失败或出现异常，返回false
        return false
    }

    /**
     * 异步函数：通过提示框更新项目描述
     *
     * 此函数用于通过一个用户提示框来更新项目的描述信息它首先显示一个带有当前描述的提示框，
     * 用户在提示框中输入新的描述并提交后，该函数将尝试更新项目描述如果更新成功，它将显示成功消息，
     * 否则将显示错误消息
     *
     * @param projectId 项目ID，用于标识需要更新描述的项目
     * @param currentDescription 当前项目的描述，用作提示框的默认值
     * @returns 返回一个布尔值，表示项目描述是否更新成功
     */
    const updateProjectDescriptionWithPrompt = async (
        projectId: Project['id'],
        currentDescription: Project['description']
    ) => {
        try {
            // 显示提示框，获取用户输入的新描述
            const result = await NuePrompt({
                title: '修改清单描述',
                placeholder: '请输入新的清单描述',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                inputValue: currentDescription,
                inputType: 'textarea',
                validator: (value: string) => value,
                onConfirm: async (newDescription: string) =>
                    await doUpdateProject(projectId, { description: newDescription })
            })
            // 根据更新结果，显示相应的消息
            if (result) {
                NueMessage.success('清单描述修改成功')
                return true
            } else {
                NueMessage.error('清单描述修改失败')
            }
        } catch (error) {
            // 捕获并处理异常
            console.warn('[UseProjectStore] updateProjectDescriptionWithPrompt:', error)
        }
        // 如果执行到这一步，表示更新失败或发生异常，返回false
        return false
    }

    /**
     * 异步更新项目偏好设置
     *
     * 本函数通过查找项目列表中与给定项目ID匹配的项目，来更新该项目的偏好设置
     * 它首先确定目标项目的索引，然后创建一个新的偏好设置对象，该对象是现有偏好设置和新偏好设置的合并
     * 最后，调用`doUpdateProject`函数来执行实际的更新操作，并根据操作结果提供反馈
     *
     * @param projectId 项目ID，用于标识需要更新偏好的项目
     * @param newPreference 新的项目偏好设置，部分或全部替换现有的偏好设置
     * @returns 返回更新操作的结果，成功或失败
     */
    const updateProjectPreference = async (
        projectId: Project['id'],
        newPreference: Partial<ProjectPreference>
    ) => {
        // 查找目标项目的索引位置
        const targetProjectIndex = projects.value.findIndex((project) => project.id === projectId)
        // 获取目标项目对象
        const targetProject = projects.value[targetProjectIndex]
        // 从目标项目中提取当前的偏好设置
        const oldPreference = targetProject.preference
        // 创建更新选项对象，合并新旧偏好设置
        const updateOptions = { preference: { ...oldPreference, ...newPreference } }
        // 执行项目更新操作，并等待结果
        const result = await doUpdateProject(projectId, updateOptions)
        // 根据更新结果，提供相应的用户反馈
        if (result) {
            NueMessage.success('清单偏好设置修改成功')
        } else {
            NueMessage.error('清单偏好设置修改失败')
        }
        // 返回更新操作的结果
        return result
    }

    /**
     * 异步函数，用于在用户确认后标记项目为删除
     *
     * 此函数首先通过NueConfirm组件显示一个确认对话框，请求用户确认是否删除指定的项目
     * 如果用户确认删除，函数将调用doUpdateProject函数，将项目的isDeleted属性设置为true，并记录删除时间
     *
     * @param projectId Project['id'] 类型的项目ID，用于指定需要删除的项目
     * @returns Promise<boolean> 返回一个Promise，如果项目成功标记为删除，则为true，否则为false
     */
    const removeProjectWithConfirmation = async (projectId: Project['id']) => {
        try {
            // 显示确认对话框，提示用户确认是否删除项目
            const result = await NueConfirm({
                title: '删除清单确认',
                content: '确认删除该清单吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                onConfirm: async () =>
                    await doUpdateProject(projectId, {
                        isDeleted: true,
                        deletedAt: useMoment().toDate()
                    })
            })
            // 根据更新结果，显示相应的消息提示
            if (result) {
                NueMessage.success('清单删除成功')
                return true
            } else {
                NueMessage.error('清单删除失败')
            }
        } catch (error) {
            // 捕获异常，并在控制台中记录错误信息
            console.warn('[UseProjectStore - removeProjectWithConfirmation] Error:', error)
        }
        // 如果删除操作失败或被取消，返回false
        return false
    }

    /**
     * 异步函数：恢复项目并显示确认对话框
     *
     * 该函数尝试恢复一个项目，并在操作前后显示相应的消息
     *
     * @param projectId 项目ID，用于指定需要恢复的项目
     * @returns 返回一个布尔值，表示项目是否恢复成功
     */
    const restoreProjectWithConfirmation = async (projectId: Project['id']) => {
        try {
            // 显示确认对话框，用户需确认是否恢复项目
            const result = await NueConfirm({
                title: '恢复清单确认',
                content: '确认恢复该清单吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                onConfirm: async () =>
                    await doUpdateProject(projectId, { isDeleted: false, deletedAt: null })
            })
            // 根据更新结果，显示相应的消息
            if (result) {
                NueMessage.success('清单恢复成功')
                return true
            } else {
                NueMessage.error('清单恢复失败')
            }
        } catch (error) {
            // 捕获并处理异常
            console.warn('[UseProjectStore - restoreProjectWithConfirmation] Error:', error)
        }
        // 如果操作失败或被取消，返回false
        return false
    }

    /**
     * 异步函数：带有确认对话框的项目归档功能
     *
     * 在归档项目之前，会显示一个确认对话框以确保用户确实想要归档该项目
     * 如果用户确认归档，将更新项目的状态为已归档，并显示操作结果的消息
     *
     * @param projectId 项目ID，用于标识需要归档的项目
     * @returns 返回一个布尔值，表示项目是否成功归档
     */
    const archiveProjectWithConfirmation = async (projectId: Project['id']) => {
        try {
            // 显示确认对话框，询问用户是否确认归档该项目
            const result = await NueConfirm({
                title: '归档清单确认',
                content: '确认归档该清单吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                onConfirm: async () =>
                    await doUpdateProject(projectId, {
                        isArchived: true,
                        archivedAt: useMoment().toDate()
                    })
            })
            // 根据更新结果，显示相应的消息
            if (result) {
                NueMessage.success('清单归档成功')
                return true
            } else {
                NueMessage.error('清单归档失败')
            }
        } catch (error) {
            // 捕获异常，并在控制台中记录错误信息
            console.warn('[UseProjectStore - archiveProjectWithConfirmation] Error:', error)
        }
        // 如果归档操作失败或被取消，返回false
        return false
    }

    /**
     * 异步函数：带有确认对话框的取消归档项目操作
     *
     * 使用确认对话框来确保用户确实想要取消归档一个项目如果用户确认取消归档，该函数将更新项目状态
     * 将其标记为未归档，并显示操作结果的消息
     *
     * @param projectId 项目ID，用于标识需要取消归档的项目
     * @returns 返回一个布尔值，表示取消归档操作是否成功
     */
    const unarchiveProjectWithConfirmation = async (projectId: Project['id']) => {
        try {
            // 显示确认对话框，让用户确认是否要取消归档项目
            const result = await NueConfirm({
                title: '取消归档清单确认',
                content: '确认取消归档该清单吗？',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                onConfirm: async () =>
                    await doUpdateProject(projectId, { isArchived: false, archivedAt: null })
            })
            // 根据更新结果，显示相应的消息
            if (result) {
                NueMessage.success('清单取消归档成功')
                return true
            } else {
                NueMessage.error('清单取消归档失败')
            }
        } catch (error) {
            // 捕获并处理任何可能发生的错误
            console.warn('[UseProjectStore] unarchiveProjectWithConfirmation:', error)
        }
        // 如果操作失败或被用户取消，返回false
        return false
    }

    // 永久删除指定清单（带确认）
    const removeProjectPermanently = async (projectId: Project['id']) => {
        try {
            const result = await NueConfirm({
                title: '永久删除清单确认',
                content: '确认永久删除该清单吗？（清单内的待办任务都将删除）',
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                onConfirm: async () => await doDeleteProject(projectId)
            })
            if (result) {
                NueMessage.success('清单永久删除成功')
                return true
            } else {
                NueMessage.error('清单永久删除失败')
            }
        } catch (error) {
            console.warn('[UseProjectStore] removeProjectPermanently:', error)
        }
        return false
    }

    // 获取本地清单
    const getProjectByIdFromLocal = (projectId: Project['id']) => {
        return projects.value.find((project) => project.id === projectId) || null
    }

    // 获取本地清单(s)
    const findProjectsFromLocal = (
        options: GetProjectsOptionsRaw,
        predicate?: (
            key: string,
            project: Project,
            options: GetProjectsOptionsRaw
        ) => boolean | undefined
    ) => {
        return projects.value.filter((project) => {
            return Object.keys(options).every((key) => {
                if (predicate) {
                    const result = predicate(key as keyof GetProjectsOptionsRaw, project, options)
                    if (typeof result === 'boolean') return result
                }
                return (
                    project[key as keyof Omit<GetProjectsOptionsRaw, 'sort'>] ===
                    options[key as keyof GetProjectsOptionsRaw]
                )
            })
        })
    }

    /**
     * 删除本地项目
     *
     * 该函数通过项目ID在本地项目列表中找到对应的项目，并将其从列表中移除
     * 如果找到了该项目并成功移除，则返回true；如果未找到该项目，则返回false
     *
     * @param projectId 项目ID，用于标识要删除的项目
     * @returns 如果成功删除项目，则返回true；否则返回false
     */
    const deleteLocalProject = (projectId: Project['id']) => {
        // 查找项目ID在项目列表中的索引位置
        const index = projects.value.findIndex((project) => project.id === projectId)
        // 如果未找到项目，则返回false
        if (index === -1) return false
        // 从项目列表中移除找到的项目
        projects.value.splice(index, 1)
        // 成功删除项目后，返回true
        return true
    }

    return {
        projects,
        getOptions,
        smartListData,
        updateGetOptions,
        doCreateProject,
        doUpdateProject,
        doGetProjects,
        doDeleteProject,
        updateProjectTitleWithPrompt,
        updateProjectDescriptionWithPrompt,
        updateProjectPreference,
        removeProjectWithConfirmation,
        restoreProjectWithConfirmation,
        archiveProjectWithConfirmation,
        unarchiveProjectWithConfirmation,
        removeProjectPermanently,
        getProjectByIdFromLocal,
        findProjectsFromLocal,
        deleteLocalProject
    }
})

