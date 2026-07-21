import tasksRoutes from './tasks/routes'
import calendarRoutes from './calendar/routes'
import pomodoroRoutes from './pomodoro/routes'
import settingsRoutes from './settings/routes'
import searchRoutes from './search/routes'

export default {
    path: '/',
    name: 'index',
    component: () => import('./index.vue'),
    children: [
        tasksRoutes,
        calendarRoutes,
        pomodoroRoutes,
        searchRoutes,
        settingsRoutes,
        {
            path: '/user/restore',
            name: 'user-restore',
            component: () => import('@/components/user/restore-page.vue')
        }
    ]
}
