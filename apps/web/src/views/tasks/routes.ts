import { useViewStore } from '@/stores/global'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'tasks',
    name: 'tasks',
    component: () => import('./index.vue'),
    redirect: { name: 'tasks-basic', params: { viewId: 'all' } },
    beforeEnter: (to, from, next) => {
        // 重置浮动侧边栏的显示状态
        const viewStore = useViewStore()
        viewStore.appAsideStates.visible = false
        next()
    },
    children: [
        {
            path: `:viewId(all|today|tomorrow|week|inbox|overdue|favourite|givenup|deleted)`,
            name: 'tasks-basic',
            meta: { category: 'basic' },
            props: true,
            component: () => import('@/layouts/tasks/main/basic/index.vue'),
            children: [
                {
                    path: ':viewType(table|list|kanban)/:todoId?',
                    name: 'tasks-basic-main',
                    meta: { category: 'basic' },
                    props: true,
                    components: {
                        Header: () => import('@/layouts/tasks/main/basic/header.vue'),
                        Content: () => import('@/layouts/tasks/main/basic/content.vue')
                    }
                }
            ]
        },
        {
            path: `project/:projectId`,
            name: 'tasks-project',
            meta: { category: 'project' },
            props: true,
            component: () => import('@/layouts/tasks/main/project/index.vue'),
            children: [
                {
                    path: ':viewType(table|list|kanban)/:todoId?',
                    name: 'tasks-project-main',
                    meta: { category: 'project' },
                    props: true,
                    components: {
                        Header: () => import('@/layouts/tasks/main/project/header.vue'),
                        Content: () => import('@/layouts/tasks/main/project/content.vue')
                    }
                }
            ]
        },
        {
            path: `tag/:tagId`,
            name: 'tasks-tag',
            meta: { category: 'tag' },
            props: true,
            component: () => import('@/layouts/tasks/main/tag/index.vue'),
            children: [
                {
                    path: ':viewType(table|list|kanban)/:todoId?',
                    name: 'tasks-tag-main',
                    meta: { category: 'tag' },
                    props: true,
                    components: {
                        Header: () => import('@/layouts/tasks/main/tag/header.vue'),
                        Content: () => import('@/layouts/tasks/main/tag/content.vue')
                    }
                }
            ]
        }
    ]
}

export default routes
