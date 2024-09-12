const projectsRoutes = {
    path: 'project',
    name: 'project',
    component: () => import('backup/project/index.vue'),
    redirect: { name: 'project-all' },
    children: [
        {
            path: 'all',
            name: 'project-all',
            component: () => import('backup/project/all/index.vue')
        },
        {
            path: 'archived',
            name: 'project-archived',
            component: () => import('backup/project/archived.vue')
        },
        {
            path: ':projectId',
            name: 'project-main',
            props: true,
            component: () => import('backup/project/main/main.vue'),
            redirect: { name: 'project-main-table' },
            children: [
                {
                    path: 'overview',
                    name: 'project-main-overview',
                    component: () => import('backup/project/main/overview.vue')
                },
                {
                    path: 'table',
                    name: 'project-main-table',
                    props: true,
                    component: () => import('backup/project/main/table.vue')
                },
                {
                    path: 'kanban',
                    name: 'project-main-kanban',
                    props: true,
                    component: () => import('backup/project/main/kanban.vue')
                }
            ]
        },
        {
            path: 'recycle-bin',
            name: 'project-recycle-bin',
            component: () => import('backup/project/recycle/index.vue')
        }
    ]
}

export default projectsRoutes
