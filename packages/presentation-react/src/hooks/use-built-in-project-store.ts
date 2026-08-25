import { useSyncExternalStore } from 'react'
import type { BuiltInProjectStoreCore } from '../logic/built-in-project-store-core'

/**
 * 内建清单 store hook
 * @description 订阅 BuiltInProjectStoreCore 快照（清单列表 + 偏好），数据变更自动重渲染。
 */
export const useBuiltInProjectStore = (store: BuiltInProjectStoreCore) => {
    const builtInProjects = useSyncExternalStore(store.subscribe, store.getBuiltInProjectsSnapshot)
    const preference = useSyncExternalStore(store.subscribe, store.getBuiltInProjectPreference)

    return { store, builtInProjects, preference }
}