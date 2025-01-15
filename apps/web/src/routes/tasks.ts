import type { RouteLocationRaw, RouteMeta } from 'vue-router'

const tasksRoutes = {
    path: 'tasks',
    name: 'tasks',
    component: () => import('../views/index/tasks/index.vue'),
    redirect: { name: 'tasks-today-table' },
    children: []
}

const links = [
    { path: 'all', meta: { category: 'basic', title: '所有', id: 'all' } },
    { path: 'today', meta: { category: 'basic', title: '今日任务', id: 'today' } },
    { path: 'tomorrow', meta: { category: 'basic', title: '明日任务', id: 'tomorrow' } },
    { path: 'week', meta: { category: 'basic', title: '最近7天', id: 'week' } },
    { path: 'inbox', meta: { category: 'basic', title: '收集箱', id: 'inbox' } },
    { path: '$p:projectId?', meta: { category: 'project', id: 'project' } },
    { path: '$t:tagId?', meta: { category: 'tag', id: 'tag' } },
    { path: 'favorite', meta: { category: 'basic', title: '已收藏', id: 'favorite' } },
    { path: 'recycle', meta: { category: 'basic', title: '垃圾桶', id: 'recycle' } }
]

const buildTaskRoute = (path: string, meta: RouteMeta) => {
    return {
        path,
        name: `tasks-${meta.id}`,
        meta,
        component: () => import(`@/views/index/tasks/main/index.vue`),
        children: [
            {
                path: 'table/:taskId?',
                name: `tasks-${meta.id}-table`,
                component: () => import(`@/views/index/tasks/main/table.vue`)
            },
            {
                path: 'kanban/:taskId?',
                name: `tasks-${meta.id}-kanban`,
                component: () => import(`@/views/index/tasks/main/kanban.vue`)
            }
        ]
    } as RouteLocationRaw
}

links.forEach((link) => {
    const { path, meta } = link
    const route = buildTaskRoute(path, meta)
    const children = tasksRoutes.children as RouteLocationRaw[]
    children.push(route)
})

export default tasksRoutes
