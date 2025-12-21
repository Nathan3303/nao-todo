import { useProjectDomain } from '@nao-todo/domain/project'
import { useProjectRepository } from '@nao-todo/infrastructure/backend/project/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { computed, ref, type Ref, type ComputedRef } from 'vue'
import {
    projectEntities2ProjectVO,
    projectEntity2ProjectVO,
    projectPreferenceEntity2ProjectPreferenceVO,
    updateProjectVO2Entity
} from './converters'
import type { GoAsync, ProjectPreferenceVO, ProjectVO, UpdateProjectVO } from '@nao-todo/types'

export interface ProjectApp {
    projects: Ref<ProjectVO[]>
    list: () => GoAsync<ProjectVO[]>
    getById: (id: string) => GoAsync<ProjectVO>
    getPreference: (id: string) => GoAsync<ProjectPreferenceVO>
    update: (id: string, project: UpdateProjectVO) => GoAsync<undefined>
    projectMap: ComputedRef<Map<string, ProjectVO>>
    getByIdFromMap: (id: string) => ProjectVO | undefined
}

export default (): ProjectApp => {
    // @domain 清单域
    const projectDomain = useProjectDomain(useProjectRepository(getRequesterImpl()))

    /**
     * 清单列表以及相关方法
     */

    // @state 清单列表
    const projects = ref<ProjectVO[]>([])

    // @method 获取清单列表
    const list = async (): GoAsync<ProjectVO[]> => {
        // 1. 调用域服务
        const [projectEntities, err] = await projectDomain.list()
        if (err) {
            return [null, err]
        }
        // 2. 更新状态
        const plist = projectEntities2ProjectVO(projectEntities!)
        // 2. 更新状态
        projects.value = plist
        // 3. 返回
        return [plist, null]
    }

    // @method 根据 ID 获取清单详情
    const getById = async (id: string): GoAsync<ProjectVO> => {
        // 1. 判断 id
        if (!id) return [null, '清单 ID 不能为空']
        // 2. 调用域服务
        const [projectEntity, err] = await projectDomain.get(id)
        if (err !== null) {
            return [null, err]
        }
        // 3. 实体转viewobject
        const project = projectEntity2ProjectVO(projectEntity)
        // 4. 更新状态
        // 查找下标更新，不存在则追加
        // const projectIndex = projects.value.findIndex((p) => p.id === project.id)
        // if (projectIndex !== -1) {
        //     projects.value[projectIndex] = project
        // } else {
        //     projects.value.push(project)
        // }
        // 4. 返回
        return [project, null]
    }

    // @method 获取清单偏好
    const getPreference = async (id: string): GoAsync<ProjectPreferenceVO> => {
        // 1. 判断 id
        if (!id) return [null, '清单 ID 不能为空']
        // 2. 调用域服务
        const [projectPreferenceEntity, err] = await projectDomain.getPreference(id)
        if (err !== null) {
            return [null, err]
        }
        // 3. 实体转viewobject
        const projectPreference =
            projectPreferenceEntity2ProjectPreferenceVO(projectPreferenceEntity)
        // 4. 返回
        return [projectPreference, null]
    }

    // @method 更新清单
    const update = async (id: string, updateVO: UpdateProjectVO): GoAsync<undefined> => {
        // 1. 判断 id
        if (!id) return '清单 ID 不能为空'
        // 2. 调用域服务
        const projectEntity = updateProjectVO2Entity(updateVO)
        const [, err] = await projectDomain.update(id, projectEntity)
        if (err !== null) {
            return err
        }
        // 3. 更新状态 - 查找下标更新
        const projectIndex = projects.value.findIndex((p) => p.id === id)
        if (projectIndex === -1) return null
        Object.keys(updateVO).forEach((key) => {
            if (key === 'id') return
            const updateValue = updateVO[key as keyof UpdateProjectVO]
            if (updateValue === undefined) return
            ;(projects.value[projectIndex] as any)[key] = updateValue
        })
        // 4. 返回
        return null
    }

    /**
     * 清单 Mapper 以及相关方法
     * 主要提供 O(1) 时间复杂度的查询，用于在视图层快速获取清单详情
     * Computed 实现响应式变化
     */

    // @computed 清单列表 Mapper
    const projectMap = computed(() => {
        return new Map(projects.value.map((p) => [p.id, p]))
    })

    // @method 根据 ID 获取清单详情
    const getByIdFromMap = (id: string): ProjectVO | undefined => {
        return projectMap.value.get(id)
    }

    return { projects, projectMap, list, getById, update, getByIdFromMap, getPreference }
}
