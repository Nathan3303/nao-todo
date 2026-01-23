import tasksRoutes from './tasks/routes'
// import calendarRoutes from '@/views/calendar/routes'
// import searchRoutes from '@/views/search/routes'
// import settingsRoutes from '@/views/settings/routes'

export default {
    path: '/',
    name: 'index',
    component: () => import('./index.vue'),
    children: [
        tasksRoutes
        // searchRoutes
        // calendarRoutes, , settingsRoutes
    ]
}
