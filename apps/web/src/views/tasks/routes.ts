// import { useViewStore } from '@/stores/global'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'tasks',
    name: 'tasks',
    component: () => import('./entry.vue'),
    beforeEnter: (to, from, next) => {
        if (to.name === 'tasks') {
            next({ name: 'tasks-built-in-project', params: { projectId: 'all' } })
            return
        }
        next()
    },
    children: [
        {
            path: `:projectId`,
            name: 'tasks-built-in-project',
            meta: { category: 'built-in-project' },
            props: true,
            component: () => import('@/layouts/tasks/content/built-in-project/index.vue'),
            children: [
                {
                    path: ':viewType(table|list|kanban)/:taskId?',
                    name: 'tasks-built-in-project-main',
                    meta: { category: 'built-in-project' },
                    props: true,
                    components: {
                        Header: () =>
                            import('@/layouts/tasks/content/built-in-project/header/index.vue'),
                        Main: () =>
                            import('@/layouts/tasks/content/built-in-project/main/index.vue')
                    }
                }
            ]
        },
        {
            path: `p/:projectId`,
            name: 'tasks-project',
            meta: { category: 'project' },
            props: true,
            component: () => import('@/layouts/tasks/content/project/index.vue'),
            children: [
                {
                    path: ':viewType(table|list|kanban)/:taskId?',
                    name: 'tasks-project-main',
                    meta: { category: 'project' },
                    props: true,
                    components: {
                        Header: () => import('@/layouts/tasks/content/project/header/index.vue'),
                        Main: () => import('@/layouts/tasks/content/project/main/index.vue')
                    }
                }
            ]
        },
        {
            path: `t/:tagId`,
            name: 'tasks-tag',
            meta: { category: 'tag' },
            props: true,
            component: () => import('@/layouts/tasks/content/tag/index.vue'),
            children: [
                {
                    path: ':viewType(table|list|kanban)/:taskId?',
                    name: 'tasks-tag-main',
                    meta: { category: 'tag' },
                    props: true,
                    components: {
                        Header: () => import('@/layouts/tasks/content/tag/header/index.vue'),
                        Main: () => import('@/layouts/tasks/content/tag/main/index.vue')
                    }
                }
            ]
        }
    ]
}

export default routes


