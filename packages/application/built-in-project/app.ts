import useBuiltInProjectDomain from '@nao-todo/domain/built-in-project/services'
import useBuiltInProjectRepository from '@nao-todo/infrastructure/built-in/project/repoImpl'
import type {
    BuiltInProject,
    BuiltInProjectPreference
} from '@nao-todo/infrastructure/built-in/project/types'
import type { Go, WithNull } from '@nao-todo/types'
import { reactive, type Reactive } from 'vue'
import {
    builtInProjectEntities2VOs,
    builtInProjectEntity2VO,
    builtInProjectPreferenceValueObject2VO,
    builtInProjectPreferenceVO2ValueObject
} from './converters'

export interface BuiltInProjectApp {
    states: Reactive<{
        builtInProject: WithNull<BuiltInProject>
        builtInProjects: BuiltInProject[]
        builtInProjectPreference: WithNull<BuiltInProjectPreference>
    }>
    listBuiltInProject: () => Go<BuiltInProject[]>
    getBuiltInProjectById: (id: string) => Go<BuiltInProject>
    getBuiltInProjectPreference: (userId: string, id: string) => Go<BuiltInProjectPreference>
    updateBuiltInProjectPreference: (
        userId: string,
        id: string,
        preference: BuiltInProjectPreference
    ) => Go<void>
}

const useBuiltInProjectApp = (): BuiltInProjectApp => {
    // @domain 内建清单域
    const builtInProjectDomain = useBuiltInProjectDomain(useBuiltInProjectRepository())

    // @states 内建清单应用状态
    const states = reactive<BuiltInProjectApp['states']>({
        builtInProject: null,
        builtInProjects: [],
        builtInProjectPreference: null
    })

    /**
     * 获取内建清单列表
     * @returns 内建清单列表
     */
    const listBuiltInProject = (): Go<BuiltInProject[]> => {
        // 1. 调用域服务
        const [projectEntities, err] = builtInProjectDomain.list()
        if (err !== null) {
            return [null, err]
        }
        // 2. 实体转viewobject
        const builtInProjects = builtInProjectEntities2VOs(projectEntities)
        // 3. 更新状态
        states.builtInProjects = builtInProjects
        // 4. 返回
        return [builtInProjects, null]
    }

    /**
     * 根据 ID 获取内建清单详情
     * @param id 内建清单 ID
     * @returns 内建清单详情
     */
    const getBuiltInProjectById = (id: string): Go<BuiltInProject> => {
        // 1. 判断 id
        if (!id) return [null, '内建清单 ID 不能为空']
        // 2. 调用域服务
        const [projectEntity, err] = builtInProjectDomain.get(id)
        if (err !== null) {
            return [null, err]
        }
        // 3. 实体转viewobject
        const project = builtInProjectEntity2VO(projectEntity)
        // 4. 更新状态
        states.builtInProject = project
        // 5. 返回
        return [project, null]
    }

    /**
     * 获取内建清单偏好
     * @param userId 用户 ID
     * @param id 内建清单 ID
     * @returns 内建清单偏好
     */
    const getBuiltInProjectPreference = (
        userId: string,
        id: string
    ): Go<BuiltInProjectPreference> => {
        // 1. 判断 id
        if (!id) return [null, '内建清单 ID 不能为空']
        // 2. 调用域服务
        const [projectPreferenceEntity, err] = builtInProjectDomain.getPreference(userId, id)
        if (err !== null) {
            return [null, err]
        }
        // 3. 实体转viewobject
        const projectPreference = builtInProjectPreferenceValueObject2VO(projectPreferenceEntity)
        // 4. 更新状态
        states.builtInProjectPreference = projectPreference
        // 5. 返回
        return [projectPreference, null]
    }

    /**
     * 更新内建清单偏好
     * @param userId 用户 ID
     * @param projectId 内建清单 ID
     * @param preference 内建清单偏好
     * @returns
     */
    const updateBuiltInProjectPreference = (
        userId: string,
        projectId: string,
        preference: BuiltInProjectPreference
    ): Go<void> => {
        // 1. 参数判断
        if (!userId) return '用户 ID 不能为空'
        if (!projectId) return '内建清单 ID 不能为空'
        if (!preference) return '内建清单偏好不能为空'
        // 2. 转换为实体
        preference.projectId = projectId
        const saveEntity = builtInProjectPreferenceVO2ValueObject(preference)
        // 3. 调用域服务
        const err = builtInProjectDomain.savePreference(userId, saveEntity)
        if (err !== null) return err
        // 4. 返回
        return null
    }

    // @returns
    return {
        states,
        listBuiltInProject,
        getBuiltInProjectById,
        getBuiltInProjectPreference,
        updateBuiltInProjectPreference
    }
}

export default useBuiltInProjectApp
