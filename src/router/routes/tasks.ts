import type { RouteLocationRaw, RouteMeta } from 'vue-router'

const buildTaskRoute = (path: string, meta: RouteMeta) => {
    path = path.trim()
    return {
        path,
        name: `tasks-${path}`,
        meta,
        props: true,
        component: () => import(`@/views/index/tasks/basic/index.vue`),
        redirect: { name: `tasks-${path}-table` },
        children: [
            {
                path: 'table/:taskId?',
                name: `tasks-${path}-table`,
                component: () => import(`@/views/index/tasks/basic/table.vue`)
            },
            {
                path: 'kanban/:taskId?',
                name: `tasks-${path}-kanban`,
                component: () => import(`@/views/index/tasks/basic/kanban.vue`)
            }
        ]
    } as RouteLocationRaw
}

const tasksRoutes = {
    path: 'tasks',
    name: 'tasks',
    component: () => import('@/views/index/tasks/index.vue'),
    redirect: { name: 'tasks-today' },
    children: [
        {
            path: '$p:projectId',
            name: `tasks-project`,
            meta: { category: 'project' },
            props: true,
            component: () => import(`@/views/index/tasks/project/index.vue`),
            children: [
                {
                    path: 'table/:taskId?',
                    name: `tasks-project-table`,
                    meta: { viewType: 'table' },
                    component: () => import(`@/views/index/tasks/project/table.vue`)
                },
                {
                    path: 'kanban/:taskId?',
                    name: `tasks-project-kanban`,
                    meta: { viewType: 'kanban' },
                    component: () => import(`@/views/index/tasks/project/kanban.vue`)
                }
            ]
        },
        {
            path: '$t:tagId',
            name: `tasks-tag`,
            props: true,
            component: () => import(`@/views/index/tasks/tag/index.vue`),
            redirect: { name: `tasks-tag-table` },
            children: [
                {
                    path: 'table/:taskId?',
                    name: `tasks-tag-table`,
                    component: () => import(`@/views/index/tasks/tag/table.vue`)
                },
                {
                    path: 'kanban/:taskId?',
                    name: `tasks-tag-kanban`,
                    component: () => import(`@/views/index/tasks/tag/kanban.vue`)
                }
            ]
        }
    ]
}

const links = [
    { path: 'all', meta: { category: 'basic', title: '所有', type: 'all' } },
    { path: 'today', meta: { category: 'basic', title: '今日任务', type: 'today' } },
    { path: 'tomorrow', meta: { category: 'basic', title: '明日任务', type: 'tomorrow' } },
    { path: 'week', meta: { category: 'basic', title: '最近7天', type: 'week' } },
    { path: 'inbox', meta: { category: 'basic', title: '收集箱', type: 'inbox' } },
    { path: 'favorite', meta: { category: 'basic', title: '已收藏', type: 'favorite' } },
    { path: 'recycle', meta: { category: 'basic', title: '垃圾桶', type: 'recycle' } }
]

links.forEach((link) => {
    const { path, meta } = link
    const route = buildTaskRoute(path, meta)
    ;(tasksRoutes.children as RouteLocationRaw[]).unshift(route)
})

export default tasksRoutes
