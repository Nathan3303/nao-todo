import { useBuiltInProjectDomain } from '@nao-todo/domain/project'
import { newBuiltInProjectRepository } from '@nao-todo/infrastructure/built-in/project/repoImpl'
import type { Go, ProjectPreferenceVO, ProjectVO } from '@nao-todo/types'
import type { ComputedRef, Ref } from 'vue'
import { ref } from 'vue'
import {
    projectEntities2ProjectVO,
    projectEntity2ProjectVO,
    projectPreferenceEntity2ProjectPreferenceVO,
    projectPreferenceVO2Entity
} from './converters'
import useListMapper from '@nao-todo/infrastructure/hooks/use-list-mapper'

export interface BuiltInProjectApp {
    builtInProjects: Ref<ProjectVO[]>
    list: () => Go<ProjectVO[]>
    getById: (id: string) => Go<ProjectVO>
    getPreference: (userId: string, id: string) => Go<ProjectPreferenceVO>
    updatePreference: (userId: string, id: string, preference: ProjectPreferenceVO) => Go<void>
    builtInProjectMap: ComputedRef<Map<string, ProjectVO>>
    getByIdFromMap: (id: string) => ProjectVO | undefined
}

export default (): BuiltInProjectApp => {
    // @domain 内建清单域
    const builtInProjectDomain = useBuiltInProjectDomain(newBuiltInProjectRepository())

    /**
     * 内建清单列表以及相关方法
     */

    // @state 内建清单列表
    const builtInProjects = ref<ProjectVO[]>([])

    // @method 获取内建清单列表
    const list = (): Go<ProjectVO[]> => {
        // 1. 调用域服务
        const [projectEntities, err] = builtInProjectDomain.list()
        if (err !== null) {
            return [null, err]
        }
        // 2. 更新状态
        const plist = projectEntities2ProjectVO(projectEntities)
        // 2. 更新状态
        builtInProjects.value = plist
        // 3. 返回
        return [plist, null]
    }

    // @method 根据 ID 获取内建清单详情
    const getById = (id: string): Go<ProjectVO> => {
        // 1. 判断 id
        if (!id) return [null, '内建清单 ID 不能为空']
        // 2. 调用域服务
        const [projectEntity, err] = builtInProjectDomain.get(id)
        if (err !== null) {
            return [null, err]
        }
        // 3. 实体转viewobject
        const project = projectEntity2ProjectVO(projectEntity)
        // 4. 返回
        return [project, null]
    }

    // @method 根据 ID 获取内建清单偏好
    const getPreference = (userId: string, id: string): Go<ProjectPreferenceVO> => {
        // 1. 判断 id
        if (!id) return [null, '内建清单 ID 不能为空']
        // 2. 调用域服务
        const [projectPreferenceEntity, err] = builtInProjectDomain.getPreference(userId, id)
        if (err !== null) {
            return [null, err]
        }
        // 3. 实体转viewobject
        const projectPreference =
            projectPreferenceEntity2ProjectPreferenceVO(projectPreferenceEntity)
        // 4. 返回
        return [projectPreference, null]
    }

    // @method 更新内建清单偏好
    const updatePreference = (
        userId: string,
        projectId: string,
        preference: ProjectPreferenceVO
    ): Go<void> => {
        // 1. 参数判断
        if (!userId) return '用户 ID 不能为空'
        if (!projectId) return '内建清单 ID 不能为空'
        if (!preference) return '内建清单偏好不能为空'
        // 2. 转换为实体
        preference.projectId = projectId
        const saveEntity = projectPreferenceVO2Entity(preference)
        // 3. 调用域服务
        const err = builtInProjectDomain.savePreference(userId, saveEntity)
        if (err !== null) return err
        // 4. 返回
        return null
    }

    /**
     * 内建清单 Mapper 以及相关方法
     * 主要提供 O(1) 时间复杂度的查询，用于在视图层快速获取内建清单详情
     * Computed 实现响应式变化
     */

    // @hook UseListMapper
    const { map: builtInProjectMap, get: getByIdFromMap } = useListMapper(builtInProjects)

    /**
     * 返回
     */

    return {
        builtInProjects,
        list,
        getById,
        getPreference,
        updatePreference,
        builtInProjectMap,
        getByIdFromMap
    }
}
