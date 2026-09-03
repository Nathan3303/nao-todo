import { useSyncExternalStore } from 'react'
import type { ProjectStoreCore } from '../logic/project-store-core'

/**
 * 项目 store hook
 * @description 订阅 ProjectStoreCore 快照（projects + 偏好），数据变更自动重渲染。
 */
export const useProjectStore = (store: ProjectStoreCore) => {
    const projects = useSyncExternalStore(store.subscribe, store.getProjectsSnapshot)
    const preference = useSyncExternalStore(store.subscribe, store.getProjectPreference)

    return { store, projects, preference }
}