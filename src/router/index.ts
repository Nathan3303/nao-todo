import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/authentication/:operation?',
            name: 'authentication',
            props: true,
            component: () => import('../views/authentication/index.vue')
        },
        {
            path: '/',
            name: 'index',
            component: () => import('@/views/index/index.vue'),
            redirect: { name: 'project' },
            children: [
                {
                    path: 'project',
                    name: 'project',
                    component: () => import('@/views/index/project/index.vue'),
                    redirect: { name: 'project-dashboard' },
                    children: [
                        {
                            path: 'dashboard',
                            name: 'project-dashboard',
                            component: () => import('@/views/index/project/dashboard/dashboard.vue')
                        },
                        {
                            path: ':projectId',
                            name: 'project-main',
                            props: true,
                            component: () => import('@/views/index/project/main/main.vue'),
                            redirect: { name: 'project-main-overview' },
                            children: [
                                {
                                    path: 'overview',
                                    name: 'project-main-overview',
                                    component: () =>
                                        import('@/views/index/project/main/overview.vue')
                                },
                                {
                                    path: 'table',
                                    name: 'project-main-table',
                                    props: true,
                                    component: () => import('@/views/index/project/main/table.vue')
                                }
                            ]
                        }
                    ]
                },
                {
                    path: 'tasks',
                    name: 'tasks',
                    component: () => import('@/views/index/tasks/index.vue')
                }
            ]
        }
    ]
})

export default router
