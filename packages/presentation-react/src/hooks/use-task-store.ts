import { useSyncExternalStore } from 'react'
import type { TaskStoreCore } from '../logic/task-store-core'

/**
 * 任务 store hook
 * @description 订阅 TaskStoreCore 快照（tasks/checkItems/comments），数据变更自动重渲染。
 *              组件只读快照、经 usecase 写数据（组件不直接改 store）。
 */
export const useTaskStore = (store: TaskStoreCore) => {
    const tasks = useSyncExternalStore(store.subscribe, store.getTasksSnapshot)
    const checkItems = useSyncExternalStore(store.subscribe, store.getCheckItemsSnapshot)
    const comments = useSyncExternalStore(store.subscribe, store.getCommentsSnapshot)
    const subTasks = useSyncExternalStore(store.subscribe, store.getSubTasksSnapshot)

    return { store, tasks, checkItems, comments, subTasks }
}