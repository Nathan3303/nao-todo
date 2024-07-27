import type { RouteLocationRaw, RouteMeta } from 'vue-router'

const buildTaskRoute = (path: string, meta: RouteMeta, dirName: string) => {
    path = path.trim()
    return {
        path,
        name: `tasks-${dirName}`,
        meta,
        props: true,
        component: () => import(`@/views/index/tasks/${dirName}/index.vue`),
        redirect: { name: `tasks-${dirName}-table` },
        children: [
            {
                path: 'table',
                name: `tasks-${dirName}-table`,
                component: () => import(`@/views/index/tasks/${dirName}/table.vue`),
                children: [
                    {
                        path: ':taskId',
                        name: `tasks-${dirName}-table-task`,
                        props: true,
                        component: () => import('@/views/index/tasks/common/task.vue')
                    }
                ]
            },
            {
                path: 'kanban',
                name: `tasks-${dirName}-kanban`,
                component: () => import(`@/views/index/tasks/${dirName}/kanban.vue`),
                children: [
                    {
                        path: ':taskId',
                        name: `tasks-${dirName}-kanban-task`,
                        props: true,
                        component: () => import('@/views/index/tasks/common/task.vue')
                    }
                ]
            }
        ]
    } as RouteLocationRaw
}

const tasksRoutes = {
    path: 'tasks',
    name: 'tasks',
    component: () => import('@/views/index/tasks/index.vue'),
    redirect: { name: 'tasks-all' },
    children: [
        // {
        //     path: 'all',
        //     name: 'tasks-all',
        //     meta: { title: '所有任务' },
        //     component: () => import('@/views/index/tasks/all/index.vue'),
        //     redirect: { name: 'tasks-all-table' },
        //     children: [
        //         {
        //             path: 'table',
        //             name: 'tasks-all-table',
        //             component: () => import('@/views/index/tasks/all/table.vue'),
        //             children: [
        //                 {
        //                     path: ':taskId',
        //                     name: 'tasks-all-table-task',
        //                     props: true,
        //                     component: () => import('@/views/index/tasks/common/task.vue')
        //                 }
        //             ]
        //         },
        //         {
        //             path: 'kanban',
        //             name: 'tasks-all-kanban',
        //             component: () => import('@/views/index/tasks/all/kanban.vue'),
        //             children: [
        //                 {
        //                     path: ':taskId',
        //                     name: 'tasks-all-kanban-task',
        //                     props: true,
        //                     component: () => import('@/views/index/tasks/common/task.vue')
        //                 }
        //             ]
        //         }
        //     ]
        // },
        // {
        //     path: 'today',
        //     name: 'tasks-today',
        //     meta: { title: '今日任务' },
        //     component: () => import('@/views/index/tasks/today/index.vue'),
        //     redirect: { name: 'tasks-today-table' },
        //     children: [
        //         {
        //             path: 'table',
        //             name: 'tasks-today-table',
        //             component: () => import('@/views/index/tasks/today/table.vue'),
        //             children: [
        //                 {
        //                     path: ':taskId',
        //                     name: 'tasks-today-table-task',
        //                     props: true,
        //                     component: () => import('@/views/index/tasks/common/task.vue')
        //                 }
        //             ]
        //         },
        //         {
        //             path: 'kanban',
        //             name: 'tasks-today-kanban',
        //             component: () => import('@/views/index/tasks/today/kanban.vue')
        //         }
        //     ]
        // },
        // {
        //     path: 'tomorrow',
        //     name: 'tasks-tomorrow',
        //     meta: { title: '明日任务' },
        //     component: () => import('@/views/index/tasks/tomorrow/index.vue'),
        //     redirect: { name: 'tasks-tomorrow-table' },
        //     children: [
        //         {
        //             path: 'table',
        //             name: 'tasks-tomorrow-table',
        //             component: () => import('@/views/index/tasks/tomorrow/table.vue'),
        //             children: [
        //                 {
        //                     path: ':taskId',
        //                     name: 'tasks-tomorrow-table-task',
        //                     props: true,
        //                     component: () => import('@/views/index/tasks/common/task.vue')
        //                 }
        //             ]
        //         },
        //         {
        //             path: 'kanban',
        //             name: 'tasks-tomorrow-kanban',
        //             component: () => import('@/views/index/tasks/tomorrow/kanban.vue')
        //         }
        //     ]
        // },
        // {
        //     path: 'week',
        //     name: 'tasks-week',
        //     meta: { title: '最近7天' },
        //     component: () => import('@/views/index/tasks/week/index.vue'),
        //     redirect: { name: 'tasks-week-table' },
        //     children: [
        //         {
        //             path: 'table',
        //             name: 'tasks-week-table',
        //             component: () => import('@/views/index/tasks/week/table.vue'),
        //             children: [
        //                 {
        //                     path: ':taskId',
        //                     name: 'tasks-week-table-task',
        //                     props: true,
        //                     component: () => import('@/views/index/tasks/common/task.vue')
        //                 }
        //             ]
        //         },
        //         {
        //             path: 'kanban',
        //             name: 'tasks-week-kanban',
        //             component: () => import('@/views/index/tasks/week/kanban.vue')
        //         }
        //     ]
        // },
        // {
        //     path: 'inbox',
        //     name: 'tasks-inbox',
        //     meta: { title: '收集箱' },
        //     component: () => import('@/views/index/tasks/inbox/index.vue'),
        //     redirect: { name: 'tasks-inbox-table' },
        //     children: [
        //         {
        //             path: 'table',
        //             name: 'tasks-inbox-table',
        //             component: () => import('@/views/index/tasks/inbox/table.vue'),
        //             children: [
        //                 {
        //                     path: ':taskId',
        //                     name: 'tasks-inbox-table-task',
        //                     props: true,
        //                     component: () => import('@/views/index/tasks/common/task.vue')
        //                 }
        //             ]
        //         },
        //         {
        //             path: 'kanban',
        //             name: 'tasks-inbox-kanban',
        //             component: () => import('@/views/index/tasks/inbox/kanban.vue')
        //         }
        //     ]
        // },
        // {
        //     path: ':projectId',
        //     name: 'tasks-project',
        //     props: true,
        //     component: () => import('@/views/index/tasks/project/index.vue'),
        //     redirect: { name: 'tasks-project-table' },
        //     children: [
        //         {
        //             path: 'table',
        //             name: 'tasks-project-table',
        //             component: () => import('@/views/index/tasks/project/table.vue'),
        //             children: [
        //                 {
        //                     path: ':taskId',
        //                     name: 'tasks-project-table-task',
        //                     props: true,
        //                     component: () => import('@/views/index/tasks/common/task.vue')
        //                 }
        //             ]
        //         },
        //         {
        //             path: 'kanban',
        //             name: 'tasks-project-kanban',
        //             component: () => import('@/views/index/tasks/project/kanban.vue')
        //         }
        //     ]
        // },
        // {
        //     path: 'recycle',
        //     name: 'tasks-recycle',
        //     meta: { title: '垃圾桶' },
        //     component: () => import('@/views/index/tasks/recycle/index.vue'),
        //     redirect: { name: 'tasks-recycle-table' },
        //     children: [
        //         {
        //             path: 'table',
        //             name: 'tasks-recycle-table',
        //             component: () => import('@/views/index/tasks/recycle/table.vue'),
        //             children: [
        //                 {
        //                     path: ':taskId',
        //                     name: 'tasks-recycle-table-task',
        //                     props: true,
        //                     component: () => import('@/views/index/tasks/common/task.vue')
        //                 }
        //             ]
        //         },
        //         {
        //             path: 'kanban',
        //             name: 'tasks-recycle-kanban',
        //             component: () => import('@/views/index/tasks/recycle/kanban.vue')
        //         }
        //     ]
        // }
    ]
}

const links = [
    { path: 'all', meta: { title: '所有' }, dirName: 'all' },
    { path: 'today', meta: { title: '今日任务' }, dirName: 'today' },
    { path: 'tomorrow', meta: { title: '明日任务' }, dirName: 'tomorrow' },
    { path: 'week', meta: { title: '最近7天' }, dirName: 'week' },
    { path: 'inbox', meta: { title: '收集箱' }, dirName: 'inbox' },
    { path: ':projectId', meta: {}, dirName: 'project' },
    { path: 'recycle', meta: { title: '垃圾桶' }, dirName: 'recycle' }
]

links.forEach((link) => {
    const { path, meta, dirName } = link
    const route = buildTaskRoute(path, meta, dirName)
    ;(tasksRoutes.children as RouteLocationRaw[]).push(route)
})

export default tasksRoutes
