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
            component: () => import('@/layouts/tasks/content/built-in-project-view/index.vue'),
            children: [
                {
                    path: ':viewType(table|list|kanban)/:taskId?',
                    name: 'tasks-built-in-project-main',
                    meta: { category: 'built-in-project' },
                    props: true,
                    components: {
                        Header: () =>
                            import(
                                '@/layouts/tasks/content/built-in-project-view/header/index.vue'
                            ),
                        Content: () =>
                            import(
                                '@/layouts/tasks/content/built-in-project-view/content/index.vue'
                            )
                    }
                }
            ]
        },
        {
            path: `project/:projectId`,
            name: 'tasks-project',
            meta: { category: 'project' },
            props: true,
            component: () => import('@/layouts/tasks/content/project-view/index.vue'),
            children: [
                {
                    path: ':viewType(table|list|kanban)/:taskId?',
                    name: 'tasks-project-main',
                    meta: { category: 'project' },
                    props: true,
                    components: {
                        Header: () => import('@/layouts/tasks/content/project-view/header.vue'),
                        Content: () => import('@/layouts/tasks/content/project-view/content.vue')
                    }
                }
            ]
        },
        {
            path: `tag/:tagId`,
            name: 'tasks-tag',
            meta: { category: 'tag' },
            props: true,
            component: () => import('@/layouts/tasks/content/tag-view/index.vue'),
            children: [
                {
                    path: ':viewType(table|list|kanban)/:taskId?',
                    name: 'tasks-tag-main',
                    meta: { category: 'tag' },
                    props: true,
                    components: {
                        Header: () => import('@/layouts/tasks/content/tag-view/header.vue'),
                        Content: () => import('@/layouts/tasks/content/tag-view/content.vue')
                    }
                }
            ]
        }
    ]
}

export default routes
