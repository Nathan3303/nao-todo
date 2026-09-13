import { useSubscriber } from '@nao-todo/shared'

/**
 * 应用级失效中心（DEF-STORE-06 方向 1/4）
 * @description 把 `nao-todo:data-changed`（SyncService 落库后派发）桥接到应用级事件总线 `RefreshData`，
 *              与「某视图是否挂载」解耦（原 index-view 视图域订阅会随路由漂移，见 ADR §2 B2/B3）。
 *              幂等守卫：**整应用只注册一次监听**（web 单进程内 index-view 与 desktop AppRoot 各调一次，
 *              仅首个生效），避免双发；应用级单例不做卸载清理（组件作用域订阅才需反订阅，
 *              见 use-subtasks.ts 的 `onUnmounted`）。
 * @returns 无
 */
let invalidationInstalled = false

export const useStoreInvalidationHub = (): void => {
    if (invalidationInstalled) return
    invalidationInstalled = true
    if (typeof window !== 'undefined') {
        window.addEventListener('nao-todo:data-changed', () => {
            useSubscriber().emit('RefreshData')
        })
    }
}