import { useProjectDomain } from '@nao-todo/domain/project'
import { useProjectRepository } from '@nao-todo/infrastructure/backend/project/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { type Reactive, reactive, watch } from 'vue'
import {
    projectEntities2ProjectVO,
    projectEntity2ProjectVO,
    projectPreferenceEntity2ProjectPreferenceVO,
    projectPreferenceVO2Entity,
    updateProjectVO2Entity
} from './converters'
import type {
    CreateProjectVO,
    GoAsync,
    ProjectPreferenceVO,
    ProjectVO,
    UpdateProjectVO,
    WithNull
} from '@nao-todo/types'

export type ProjectAppStates = {
    projects: ProjectVO[]
    project: WithNull<ProjectVO>
    preference: WithNull<ProjectPreferenceVO>
    projectsMap: Map<string, ProjectVO>
}

export interface ProjectApp {
    states: Reactive<ProjectAppStates>
    list: () => GoAsync<ProjectVO[]>
    getById: (id: string) => GoAsync<ProjectVO>
    getPreference: (id: string) => GoAsync<ProjectPreferenceVO>
    update: (id: string, project: UpdateProjectVO) => GoAsync<void>
    create: (project: CreateProjectVO) => GoAsync<ProjectVO>
    getByIdFromMap: (id: string) => ProjectVO | undefined
    updatePreference: (id: string, preferenceVO: ProjectPreferenceVO) => GoAsync<string>
}

export default (): ProjectApp => {
    // @domain 清单域
    const projectDomain = useProjectDomain(useProjectRepository(getRequesterImpl()))

    // @states
    const states = reactive<ProjectAppStates>({
        projects: [],
        project: null,
        preference: null,
        projectsMap: new Map()
    })

    // @watch 当 projects 变化时，更新 projectsMap
    watch(
        () => states.projects,
        (projects) => {
            states.projectsMap = new Map(projects.map((p) => [p.id, p]))
        },
        { immediate: true }
    )

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
        states.projects = plist
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
        states.project = project
        // 查找下标更新，不存在则追加
        const projectIndex = states.projects.findIndex((p) => p.id === project.id)
        if (projectIndex !== -1) {
            states.projects[projectIndex] = project
        } else {
            states.projects.push(project)
        }
        // 更新 map
        states.projectsMap = new Map(states.projects.map((p) => [p.id, p]))
        // 4. 返回
        return [project, null]
    }

    // @method 更新清单
    const update = async (id: string, updateVO: UpdateProjectVO): GoAsync<void> => {
        // 1. 判断 id
        if (!id) return '清单 ID 不能为空'
        // 2. 调用域服务
        const projectEntity = updateProjectVO2Entity(updateVO)
        const [, err] = await projectDomain.update(id, projectEntity)
        if (err !== null) {
            return err
        }
        // 3. 更新状态 - 查找下标更新
        const projectIndex = states.projects.findIndex((p) => p.id === id)
        if (projectIndex === -1) return null
        Object.keys(updateVO).forEach((key) => {
            if (key === 'id') return
            const updateValue = updateVO[key as keyof UpdateProjectVO]
            if (updateValue === undefined) return
            ;(states.projects[projectIndex] as any)[key] = updateValue
        })
        // 4. 返回
        return null
    }

    // @method 创建清单
    const create = async (createVO: CreateProjectVO): GoAsync<ProjectVO> => {
        // 1. 参数判断
        if (!createVO) return [null, '清单创建参数不能为空']
        // 2. 调用域服务
        const [projectEntity, err] = await projectDomain.create(createVO)
        if (err !== null) return [null, err]
        // 4. 实体转viewobject
        const project = projectEntity2ProjectVO(projectEntity)
        // 5. 更新状态
        states.projects.push(project)
        // 6. 返回
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
        // 4. 更新状态
        console.log(projectPreference)
        states.preference = projectPreference
        // 5. 返回
        return [projectPreference, null]
    }

    // @method 更新清单偏好
    const updatePreference = async (
        id: string,
        preferenceVO: ProjectPreferenceVO
    ): GoAsync<string> => {
        // 1. 判断 id
        if (!id) return [null, '清单 ID 不能为空']
        // 2. 调用域服务
        const projectPreferenceEntity = projectPreferenceVO2Entity(preferenceVO)
        const [projectId, err] = await projectDomain.updatePreference(id, projectPreferenceEntity)
        if (err !== null) {
            return [null, err]
        }
        // 3. 更新状态
        states.preference = preferenceVO
        // 4. 返回
        return [projectId, null]
    }

    // @method 根据 ID 获取清单详情 - 从 Map 中获取
    const getByIdFromMap = (id: string): ProjectVO | undefined => {
        return states.projectsMap.get(id)
    }

    // @returns
    return {
        states,
        list,
        getById,
        update,
        create,
        getPreference,
        getByIdFromMap,
        updatePreference
    }
}
