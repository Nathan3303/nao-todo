import type { RouteRecordRaw } from 'vue-router'

const SettingsViewRouteLinks = [
    { name: '用户信息', icon: 'user', route: '/settings/profile' },
    { name: '修改密码', icon: 'lock', route: '/settings/password' }
]

const SettingsViewRouteRecordRaw: RouteRecordRaw = {
    path: 'settings',
    name: 'settings',
    component: () => import('./index.vue'),
    redirect: { name: 'settings-profile' },
    children: [
        {
            path: 'profile',
            name: 'settings-profile',
            component: () => import('./profile-view.vue')
        },
        {
            path: 'password',
            name: 'settings-password',
            component: () => import('./password-view.vue')
        }
    ]
}

export default SettingsViewRouteRecordRaw
export { SettingsViewRouteLinks }
