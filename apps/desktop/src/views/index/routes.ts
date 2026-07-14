import tasksRoutes from './tasks/routes'

export default {
    path: '/',
    name: 'index',
    component: () => import('./index.vue'),
    children: [tasksRoutes]
}
