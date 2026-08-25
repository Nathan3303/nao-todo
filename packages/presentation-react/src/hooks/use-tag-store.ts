import { useSyncExternalStore } from 'react'
import type { TagStoreCore } from '../logic/tag-store-core'

/**
 * 标签 store hook
 * @description 订阅 TagStoreCore 快照（tags + 偏好），数据变更自动重渲染。
 */
export const useTagStore = (store: TagStoreCore) => {
    const tags = useSyncExternalStore(store.subscribe, store.getTagsSnapshot)
    const preference = useSyncExternalStore(store.subscribe, store.getTagPreference)

    return { store, tags, preference }
}