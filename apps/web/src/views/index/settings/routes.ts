// import { useUserStore } from '@/stores'
import type { RouteRecordRaw } from 'vue-router'

const _routeRecords = [
    {
        path: 'profile',
        name: 'settings-profile',
        componentName: 'profile-updater',
        title: 'nav.settingsProfile',
        icon: 'user'
    },
    {
        path: 'password',
        name: 'settings-password',
        componentName: 'password-updater',
        title: 'nav.settingsPassword',
        icon: 'lock'
    },
    {
        path: 'app',
        name: 'settings-app',
        componentName: 'app-setting',
        title: 'nav.settingsApp',
        icon: 'setting'
    }
]

const SettingsViewRouteLinks = _routeRecords.map((record) => {
    return {
        name: record.name,
        icon: record.icon,
        route: `/settings/${record.path}`,
        title: record.title
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
            component: () => import(`@/layouts/settings/${record.componentName}/index.vue`)
        }
    })
}

export default SettingsViewRouteRecordRaw
export { SettingsViewRouteLinks }

