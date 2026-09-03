import { useSyncExternalStore } from 'react'
import { navCore, type AppRoute } from '../logic/nav-core'

/**
 * 导航 hook
 * @description 订阅 navCore 路由栈快照，返回当前路由；组件经 navCore.push/replace/back 导航。
 */
export const useNav = (): AppRoute => useSyncExternalStore(navCore.subscribe, navCore.getCurrent)