const projectsRoutes = {
    path: 'project',
    name: 'project',
    component: () => import('@/views/index/project/index.vue'),
    redirect: { name: 'project-dashboard' },
    children: [
        {
            path: 'dashboard',
            name: 'project-dashboard',
            component: () => import('@/views/index/project/dashboard.vue')
        },
        {
            path: 'archived',
            name: 'project-archived',
            component: () => import('@/views/index/project/archived.vue')
        },
        {
            path: ':projectId',
            name: 'project-main',
            props: true,
            component: () => import('@/views/index/project/main/main.vue'),
            redirect: { name: 'project-main-table' },
            children: [
                {
                    path: 'overview',
                    name: 'project-main-overview',
                    component: () => import('@/views/index/project/main/overview.vue')
                },
                {
                    path: 'table',
                    name: 'project-main-table',
                    props: true,
                    component: () => import('@/views/index/project/main/table.vue')
                },
                {
                    path: 'kanban',
                    name: 'project-main-kanban',
                    props: true,
                    component: () => import('@/views/index/project/main/kanban.vue')
                }
            ]
        },
        {
            path: 'recycle-bin',
            name: 'project-recycle-bin',
            component: () => import('@/views/index/project/recycle-bin.vue')
        }
    ]
}

export default projectsRoutes