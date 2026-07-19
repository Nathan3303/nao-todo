// import { useViewStore } from '@/stores/global'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'tasks',
    name: 'tasks',
    component: () => import('./entry.vue'),
    beforeEnter: (to) => {
        if (to.name === 'tasks') {
            return { name: 'tasks-built-in-project', params: { projectId: 'all' } }
        }
    },
    children: [
        {
            path: `:projectId`,
            name: 'tasks-built-in-project',
            meta: { category: 'built-in-project' },
            props: true,
            component: () => import('@/components/tasks/built-in-project/index.vue'),
            children: [
                {
                    path: ':viewType(table|list|kanban)/:taskId?',
                    name: 'tasks-built-in-project-main',
                    meta: { category: 'built-in-project' },
                    props: true,
                    components: {
                        Header: () =>
                            import('@/components/tasks/built-in-project/header/index.vue'),
                        Main: () => import('@/components/tasks/built-in-project/main/index.vue')
                    }
                }
            ]
        },
        {
            path: `p/:projectId`,
            name: 'tasks-project',
            meta: { category: 'project' },
            props: true,
            component: () => import('@/components/tasks/project/index.vue'),
            children: [
                {
                    path: ':viewType(table|list|kanban)/:taskId?',
                    name: 'tasks-project-main',
                    meta: { category: 'project' },
                    props: true,
                    components: {
                        Header: () => import('@/components/tasks/project/header/index.vue'),
                        Main: () => import('@/components/tasks/project/main/index.vue')
                    }
                }
            ]
        },
        {
            path: `t/:tagId`,
            name: 'tasks-tag',
            meta: { category: 'tag' },
            props: true,
            component: () => import('@/components/tasks/tag/index.vue'),
            children: [
                {
                    path: ':viewType(table|list|kanban)/:taskId?',
                    name: 'tasks-tag-main',
                    meta: { category: 'tag' },
                    props: true,
                    components: {
                        Header: () => import('@/components/tasks/tag/header/index.vue'),
                        Main: () => import('@/components/tasks/tag/main/index.vue')
                    }
                }
            ]
        }
    ]
}

export default routes
