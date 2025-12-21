import type { ProjectEntity, ProjectPreferenceEntity } from '@nao-todo/domain/project/entities'
import type { BuiltInProjectRepository } from '@nao-todo/domain/project/repositories'
import type { Err, Go } from '@nao-todo/types'
import { defaultBuiltInProjectPreferences, defaultBuiltInProjects } from './default'
import {
    parse2ProjectEntity,
    parse2ProjectPreferenceEntity,
    projectPreferenceEntity2BuiltInPp
} from './converters'

export const newBuiltInProjectRepository = (): BuiltInProjectRepository => {
    const get = (id: string): Go<ProjectEntity> => {
        // 1. 获取清单
        const builtInProject = defaultBuiltInProjects.find((item) => item.id === id)
        if (!builtInProject) {
            return [null, '清单不存在']
        }
        // 2. 转换为实体
        const entity = parse2ProjectEntity(builtInProject)
        // 3. 返回
        return [entity, null]
    }

    const list = (): Go<ProjectEntity[]> => {
        // 1. 获取清单
        const builtInProjects = defaultBuiltInProjects
        // 2. 转换为实体
        const entities = builtInProjects.map(parse2ProjectEntity)
        // 3. 返回
        return [entities, null]
    }

    const getPreference = (userId: string, projectId: string): Go<ProjectPreferenceEntity> => {
        // 1. 构造查询 Key
        const key = `${userId}/${projectId}`
        // 2. 查询 localStorage
        const ppInStorage = localStorage.getItem(key)
        if (ppInStorage) {
            // 2.1 转换为实体
            const ppe = parse2ProjectPreferenceEntity(JSON.parse(ppInStorage))
            // 2.2 返回
            return [ppe, null]
        }
        // 3. 若不存在，则返回默认值
        const defaultPp = defaultBuiltInProjectPreferences.find((pp) => pp.projectId === projectId)
        if (defaultPp) {
            // 3.1 转换为实体
            const ppe = parse2ProjectPreferenceEntity(defaultPp)
            // 3.2 返回
            return [ppe, null]
        }
        // 4. 返回错误
        return [null, '清单偏好获取失败']
    }

    const savePreference = (userId: string, ppe: ProjectPreferenceEntity): Err => {
        // 1. 构造读写 Key
        const key = `${userId}/${ppe.projectId}`
        // 2. 格式转换
        const builtInPp = projectPreferenceEntity2BuiltInPp(ppe)
        // 3. 更新
        localStorage.setItem(key, JSON.stringify(builtInPp))
        // 4. 返回
        return null
    }

    return { get, list, getPreference, savePreference }
}
