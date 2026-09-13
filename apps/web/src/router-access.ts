import { getCurrentInstance } from 'vue'
import { useRouter } from 'vue-router'
import type { Router } from 'vue-router'

/**
 * 实例无关的 router 访问（SHELL-05 T1 / C-37）
 * @description 桌面渲染层复用 webapp 源码（`@` → apps/web/src）时，若 vue-router 被打成
 *              多个物理实例，`useRouter()`（按注入 key 取）会返回 `undefined`（H6）。
 *              本模块提供单一访问器：优先 `useRouter()`；不可用时回退
 *              `appContext.config.globalProperties.$router`（由 `app.use(router)` 直接写入，
 *              与 createRouter/useRouter 的物理实例无关）。启动期自检必须显式告警，不得静默。
 */

/** 结构化自检日志固定前缀（可被日志采集钩子识别） */
export const ROUTER_INJECTION_LOG_PREFIX = '[SHELL-05/C-37] router-injection'

export type RouterResolutionSource = 'composable' | 'global' | 'none'

export type RouterResolution = {
    router: Router | undefined
    source: RouterResolutionSource
}

/** 读取 app 级 `$router`（`app.use(router)` 写入 globalProperties，跨实例安全） */
const readGlobalRouter = (): Router | undefined => {
    const instance = getCurrentInstance()
    const globalProperties = instance?.appContext.config.globalProperties as
        | (Record<string, unknown> & { $router?: Router })
        | undefined
    return globalProperties?.$router
}

/** 选择可用 router：composable 优先，`$router` 兜底（纯函数，便于单测） */
export const selectRouter = (
    composable: Router | undefined,
    global: Router | undefined
): RouterResolution => {
    if (composable) return { router: composable, source: 'composable' }
    if (global) return { router: global, source: 'global' }
    return { router: undefined, source: 'none' }
}

/** 当前实例下解析 router：composable 优先，`$router` 兜底 */
export const resolveRouter = (): RouterResolution => selectRouter(useRouter(), readGlobalRouter())

/**
 * 启动期自检（C-37①）：非 composable 路径必须可观测
 * @description 仅 `composable` 为健康路径；降级与完全不可用都输出固定前缀结构化日志。
 */
export const reportRouterInjection = (resolution: RouterResolution): void => {
    if (resolution.source === 'composable') return
    if (resolution.source === 'global') {
        console.error(
            `${ROUTER_INJECTION_LOG_PREFIX} useRouter() 返回 undefined，已降级使用 app 级 $router`,
            { source: resolution.source }
        )
        return
    }
    console.error(
        `${ROUTER_INJECTION_LOG_PREFIX} router 注入不可用：useRouter() 与 app 级 $router 均为 undefined`,
        { source: resolution.source }
    )
}