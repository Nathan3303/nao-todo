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
                path: 'table/:taskId?',
                name: `tasks-${dirName}-table`,
                component: () => import(`@/views/index/tasks/${dirName}/table.vue`)
            },
            {
                path: 'kanban/:taskId?',
                name: `tasks-${dirName}-kanban`,
                component: () => import(`@/views/index/tasks/${dirName}/kanban.vue`)
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
        // }
    ]
}

const links = [
    { path: 'all', meta: { title: '所有' }, dirName: 'all' },
    { path: 'today', meta: { title: '今日任务' }, dirName: 'today' },
    { path: 'tomorrow', meta: { title: '明日任务' }, dirName: 'tomorrow' },
    { path: 'week', meta: { title: '最近7天' }, dirName: 'week' },
    { path: 'inbox', meta: { title: '收集箱' }, dirName: 'inbox' },
    { path: '$p:projectId', meta: {}, dirName: 'project' },
    { path: '$t:tagId', meta: {}, dirName: 'tag' },
    { path: 'recycle', meta: { title: '垃圾桶' }, dirName: 'recycle' }
]

links.forEach((link) => {
    const { path, meta, dirName } = link
    const route = buildTaskRoute(path, meta, dirName)
    ;(tasksRoutes.children as RouteLocationRaw[]).push(route)
})

export default tasksRoutes
