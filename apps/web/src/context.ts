import type { Ref, InjectionKey } from 'vue'

// 路由链接
export type RouterLink = { name: string; icon: string; route: string; routeName: string }

// 应用上下文
export type AppContext = {
    routerLinks: RouterLink[]
    responsiveFlag: Ref<number>
}

// 应用上下文键
export const APP_CONTEXT_KEY: InjectionKey<AppContext> = Symbol('APP_CONTEXT')