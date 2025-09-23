import type { RouteRecordRaw } from 'vue-router'

const routeLinks = [
    { path: 'basic/:id/:todoId?', meta: { category: 'basic' } },
    { path: 'project/:id/:todoId?', meta: { category: 'project' } },
    { path: 'tag/:id/:todoId?', meta: { category: 'tag' } }
]

const routes: RouteRecordRaw = {
    path: 'tasks',
    name: 'tasks',
    component: () => import('./index.vue'),
    redirect: { path: '/tasks/basic/all' },
    children: routeLinks.map(({ path, meta }) => {
        return {
            path,
            name: 'tasks-' + meta.category,
            meta,
            props: true,
            component: () => import('./main.vue')
        } as RouteRecordRaw
    })
}

export default routes
