import type { RouteMeta, RouteRecordRaw } from 'vue-router'

const routeLinks = [
    { path: 'all', meta: { category: 'basic', title: '所有', id: 'all' } },
    { path: 'today', meta: { category: 'basic', title: '今日任务', id: 'today' } },
    { path: 'tomorrow', meta: { category: 'basic', title: '明日任务', id: 'tomorrow' } },
    { path: 'week', meta: { category: 'basic', title: '最近7天', id: 'week' } },
    { path: 'inbox', meta: { category: 'basic', title: '收集箱', id: 'inbox' } },
    { path: '$p:projectId?', meta: { category: 'project', id: 'project' } },
    { path: '$t:tagId?', meta: { category: 'tag', id: 'tag' } },
    { path: 'favorite', meta: { category: 'basic', title: '已收藏', id: 'favorite' } },
    { path: 'giveup', meta: { category: 'basic', title: '已放弃', id: 'giveup' } },
    { path: 'recycle', meta: { category: 'basic', title: '垃圾桶', id: 'recycle' } }
]

const buildChildRoute = (path: string, meta: RouteMeta) => {
    return {
        path,
        name: `tasks-${meta.id}`,
        meta,
        component: () => import('./components/main/index.vue'),
        children: [
            {
                path: 'table/:taskId?',
                name: `tasks-${meta.id}-table`,
                meta: { viewType: 'table' },
                component: () => import('./components/main/table-view/index.vue')
            },
            {
                path: 'kanban/:taskId?',
                name: `tasks-${meta.id}-kanban`,
                meta: { viewType: 'kanban' },
                component: () => import('./components/main/kanban-view/index.vue')
            }
        ]
    } as RouteRecordRaw
}

const routes: RouteRecordRaw = {
    path: 'tasks',
    name: 'tasks',
    component: () => import('./index.vue'),
    beforeEnter: (to) => {
        const lastRouteWhenLeave = localStorage.getItem('tasks/lastRouteWhenLeave')
        if (lastRouteWhenLeave && lastRouteWhenLeave !== to.path)
            return { path: lastRouteWhenLeave }
    },
    children: []
}

routeLinks.map((rl) => {
    const child = buildChildRoute(rl.path, rl.meta)
    routes.children.push(child)
})

export default routes
