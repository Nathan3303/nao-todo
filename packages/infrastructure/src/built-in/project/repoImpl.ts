import type {
    BuiltInProjectEntity,
    BuiltInProjectPreferenceEntity,
    BuiltInProjectRepository
} from '@nao-todo/domain/built-in-project'
import type { Go } from '@nao-todo/shared'
import { bipRes2bipEntity, bippRes2bippVO, bippVO2bippRes } from './converters'
import { defaultBuiltInProjectPreferences, defaultBuiltInProjects } from './default'

const useBuiltInProjectRepository = (): BuiltInProjectRepository => {
    /**
     * 获取指定 ID 的清单
     * @param id 清单 ID
     * @returns 清单实体
     */
    const get = (id: string): Go<BuiltInProjectEntity> => {
        // 1. 获取清单
        const builtInProject = defaultBuiltInProjects.find((item) => item.id === id)
        if (!builtInProject) {
            return [null, '清单不存在']
        }
        // 2. 转换为实体
        const bipe = bipRes2bipEntity(builtInProject)
        // 3. 返回
        return [bipe, null]
    }

    /**
     * 获取所有清单
     * @returns 清单实体数组
     */
    const list = (): Go<BuiltInProjectEntity[]> => {
        // 1. 获取清单
        const builtInProjects = defaultBuiltInProjects
        // 2. 转换为实体
        const entities = builtInProjects.map(bipRes2bipEntity)
        // 3. 返回
        return [entities, null]
    }

    /**
     * 获取指定清单的偏好
     * @param userId 用户 ID
     * @param projectId 清单 ID
     * @returns 清单偏好实体
     */
    const getPreference = (userId: string, id: string): Go<BuiltInProjectPreferenceEntity> => {
        // 1. 构造查询 Key
        const key = `${userId}/${id}`
        // 2. 查询 localStorage
        const builtInProjectPreferenceInLocalStorage = localStorage.getItem(key)
        if (builtInProjectPreferenceInLocalStorage) {
            // 2.1 转换为实体
            const bippvo = bippRes2bippVO({
                ...JSON.parse(builtInProjectPreferenceInLocalStorage),
                projectId: id
            })
            // 2.2 返回
            return [bippvo, null]
        }
        // 3. 若不存在，则返回默认值
        const defaultBuiltInProjectPreference = defaultBuiltInProjectPreferences.find(
            (pp) => pp.projectId === id
        )
        if (defaultBuiltInProjectPreference) {
            // 3.1 转换为实体
            const bippvo = bippRes2bippVO({
                ...defaultBuiltInProjectPreference,
                projectId: id
            })
            // 3.2 返回
            return [bippvo, null]
        }
        // 4. 返回错误
        return [null, '清单偏好获取失败']
    }

    /**
     * 保存清单偏好
     * @param userId 用户 ID
     * @param bippvo 清单偏好值对象
     * @returns 错误信息
     */
    const savePreference = (
        userId: string,
        projectId: string,
        bippvo: BuiltInProjectPreferenceEntity
    ): Go<void> => {
        // 1. 构造读写 Key
        const key = `${userId}/${projectId}`
        // 2. 格式转换
        const builtInPp = bippVO2bippRes(bippvo)
        // 3. 更新
        localStorage.setItem(key, JSON.stringify(builtInPp))
        // 4. 返回
        return null
    }

    // @returns
    return {
        get,
        list,
        getPreference,
        savePreference
    }
}

export default useBuiltInProjectRepository