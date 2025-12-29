import { useBuiltInProjectDomain } from '@nao-todo/domain/project'
import { newBuiltInProjectRepository } from '@nao-todo/infrastructure/built-in/project/repoImpl'
import { reactive, watch } from 'vue'
import {
    projectEntities2ProjectVO,
    projectEntity2ProjectVO,
    projectPreferenceEntity2ProjectPreferenceVO,
    projectPreferenceVO2Entity
} from './converters'
import type { Go, ProjectPreferenceVO, ProjectVO } from '@nao-todo/types'
import type { ComputedRef, Reactive } from 'vue'
import { useListMapperV2 } from '@nao-todo/infrastructure/hooks/use-list-mapper'

export type BuiltInProjectAppStates = {
    projects: ProjectVO[]
    projectMap: Map<string, number>
}

export interface BuiltInProjectApp {
    states: Reactive<BuiltInProjectAppStates>
    list: () => Go<ProjectVO[]>
    getById: (id: string) => Go<ProjectVO>
    getPreference: (userId: string, id: string) => Go<ProjectPreferenceVO>
    updatePreference: (userId: string, id: string, preference: ProjectPreferenceVO) => Go<void>
    getByIdFromMap: (id: string) => ProjectVO | undefined
    computedGetByIdFromMap: (id: string) => ComputedRef<ProjectVO | undefined>
}

export default (): BuiltInProjectApp => {
    // @domain 内建清单域
    const builtInProjectDomain = useBuiltInProjectDomain(newBuiltInProjectRepository())

    // @states
    const states = reactive<BuiltInProjectAppStates>({
        projects: [],
        projectMap: new Map()
    })

    /**
     * Projects 相关方法
     */

    // @method 获取内建清单列表
    const list = (): Go<ProjectVO[]> => {
        // 1. 调用域服务
        const [projectEntities, err] = builtInProjectDomain.list()
        if (err !== null) {
            return [null, err]
        }
        // 2. 更新状态
        const plist = projectEntities2ProjectVO(projectEntities)
        // 3. 更新状态
        states.projects = plist
        // 4. 返回
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
     * ProjectMap 相关方法
     */

    // @hook
    const { makeMap, getById: getByIdFromMap, useComputedGetter } = useListMapperV2<ProjectVO>()

    // @watch 监听 tasks 变化，更新 taskMap
    watch(
        () => states.projects,
        (newList) => makeMap(newList),
        { immediate: true }
    )

    /**
     * 返回
     */

    return {
        states,
        list,
        getById,
        getPreference,
        updatePreference,
        getByIdFromMap,
        computedGetByIdFromMap: useComputedGetter
    }
}
