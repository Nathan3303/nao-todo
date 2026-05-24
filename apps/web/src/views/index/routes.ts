import tasksRoutes from './tasks/routes'
import calendarRoutes from './calendar/routes'
// import searchRoutes from '@/views/search/routes'
import settingsRoutes from './settings/routes'

export default {
    path: '/',
    name: 'index',
    component: () => import('./index.vue'),
    children: [
        tasksRoutes,
        calendarRoutes,
        // searchRoutes
        settingsRoutes
    ]
}

