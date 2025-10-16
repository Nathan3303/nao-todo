import { useViewStore } from '@/stores/global'
import type { RouteRecordRaw } from 'vue-router'

const SettingsViewRouteLinks = [
    { name: '个人信息', icon: 'user', route: '/settings/profile' },
    // { name: '修改密码', icon: 'lock', route: '/settings/password' },
    { name: '页面设置', icon: 'theme', route: '/settings/view' }
]

const SettingsViewRouteRecordRaw: RouteRecordRaw = {
    path: 'settings',
    name: 'settings',
    component: () => import('./index.vue'),
    redirect: { name: 'settings-profile' },
    beforeEnter: (to, from, next) => {
        // 重置浮动侧边栏的显示状态
        const viewStore = useViewStore()
        viewStore.appAsideStates.visible = false
        next()
    },
    children: [
        {
            path: 'profile',
            name: 'settings-profile',
            component: () => import('@/layouts/settings/contents/profile.vue')
        },
        {
            path: 'password',
            name: 'settings-password',
            component: () => import('@/layouts/settings/contents/password.vue')
        },
        {
            path: 'view',
            name: 'settings-view',
            component: () => import('@/layouts/settings/contents/view.vue')
        }
    ]
}

export default SettingsViewRouteRecordRaw
export { SettingsViewRouteLinks }
