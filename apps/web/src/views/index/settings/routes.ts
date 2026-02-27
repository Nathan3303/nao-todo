// import { useUserStore } from '@/stores'
import type { RouteRecordRaw } from 'vue-router'

const _routeRecords = [
    {
        path: 'profile',
        name: 'settings-profile',
        componentName: 'profile',
        title: '账户与个人信息',
        icon: 'user'
    },
    // {
    //     path: 'password',
    //     name: 'settings-password',
    //     componentName: 'password',
    //     title: '密码与安全',
    //     icon: 'lock'
    // },
    // {
    //     path: 'view',
    //     name: 'settings-view',
    //     componentName: 'view',
    //     title: '页面设置',
    //     icon: 'theme'
    // },
    // {
    //     path: 'smartlist',
    //     name: 'settings-smartlist',
    //     componentName: 'smartlist',
    //     title: '智能列表',
    //     icon: 'list'
    // }
]

const SettingsViewRouteLinks = _routeRecords.map((record) => {
    return {
        name: record.title,
        icon: record.icon,
        route: `/settings/${record.path}`
    }
})

const SettingsViewRouteRecordRaw: RouteRecordRaw = {
    path: 'settings',
    name: 'settings',
    component: () => import('./entry.vue'),
    redirect: { name: 'settings-profile' },
    children: _routeRecords.map((record) => {
        return {
            path: record.path,
            name: record.name,
            meta: { title: record.title, icon: record.icon },
            component: () => import(`@/layouts/settings/contents/${record.componentName}.vue`)
        }
    })
}

export default SettingsViewRouteRecordRaw
export { SettingsViewRouteLinks }

