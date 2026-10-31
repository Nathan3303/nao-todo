import type { RouteLocationRaw } from 'vue-router'

export type NaoRouterLinkProps = {
    /** 导航目标（字符串路径或路由对象） */
    route: RouteLocationRaw
    /** 图标名（nue-ui 图标集） */
    icon?: string
    /** 图标链接（方形、无文本） */
    iconLink?: boolean
    size?: 'small' | 'large'
}