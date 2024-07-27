import { createRouter, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/stores/use-user-store'
import { useLoadingScreen } from '@/hooks/use-loading-screen'

const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/authentication/:operation?',
            name: 'authentication',
            props: true,
            component: () => import('../views/authentication/index.vue')
        },
        {
            path: '/',
            name: 'index',
            beforeEnter: async (to, from, next) => {
                const userStore = useUserStore()
                const loadingScreen = useLoadingScreen()
                if (userStore.isAuthenticated) {
                    next()
                    return
                }
                const isLoggedIn = await userStore.isLoggedIn()
                if (isLoggedIn) {
                    loadingScreen.startLoading()
                    await userStore.checkin()
                    if (userStore.isAuthenticated) {
                        next()
                        return
                    } else {
                        loadingScreen.stopLoading()
                    }
                }
                next('/authentication/login')
            },
            component: () => import('@/views/index/index.vue'),
            redirect: { name: 'project' },
            children: [
                {
                    path: 'project',
                    name: 'project',
                    component: () => import('@/views/index/project/index.vue'),
                    redirect: { name: 'project-dashboard' },
                    children: [
                        {
                            path: 'dashboard',
                            name: 'project-dashboard',
                            component: () => import('@/views/index/project/dashboard.vue')
                        },
                        {
                            path: 'archived',
                            name: 'project-archived',
                            component: () => import('@/views/index/project/archived.vue')
                        },
                        {
                            path: ':projectId',
                            name: 'project-main',
                            props: true,
                            component: () => import('@/views/index/project/main/main.vue'),
                            redirect: { name: 'project-main-table' },
                            children: [
                                {
                                    path: 'overview',
                                    name: 'project-main-overview',
                                    component: () =>
                                        import('@/views/index/project/main/overview.vue')
                                },
                                {
                                    path: 'table',
                                    name: 'project-main-table',
                                    props: true,
                                    component: () => import('@/views/index/project/main/table.vue')
                                },
                                {
                                    path: 'kanban',
                                    name: 'project-main-kanban',
                                    props: true,
                                    component: () => import('@/views/index/project/main/kanban.vue')
                                }
                            ]
                        },
                        {
                            path: 'recycle-bin',
                            name: 'project-recycle-bin',
                            component: () => import('@/views/index/project/recycle-bin.vue')
                        }
                    ]
                },
                {
                    path: 'tasks',
                    name: 'tasks',
                    component: () => import('@/views/index/tasks/index.vue'),
                    redirect: { name: 'tasks-all' },
                    children: [
                        {
                            path: 'all',
                            name: 'tasks-all',
                            meta: { title: '所有任务' },
                            component: () => import('@/views/index/tasks/all/index.vue'),
                            redirect: { name: 'tasks-all-table' },
                            children: [
                                {
                                    path: 'table',
                                    name: 'tasks-all-table',
                                    component: () => import('@/views/index/tasks/all/table.vue'),
                                    children: [
                                        {
                                            path: ':taskId',
                                            name: 'tasks-all-table-task',
                                            props: true,
                                            component: () =>
                                                import('@/views/index/tasks/common/task.vue')
                                        }
                                    ]
                                },
                                {
                                    path: 'kanban',
                                    name: 'tasks-all-kanban',
                                    component: () => import('@/views/index/tasks/all/kanban.vue')
                                }
                            ]
                        },
                        {
                            path: 'today',
                            name: 'tasks-today',
                            meta: { title: '今日任务' },
                            component: () => import('@/views/index/tasks/today/index.vue'),
                            redirect: { name: 'tasks-today-table' },
                            children: [
                                {
                                    path: 'table',
                                    name: 'tasks-today-table',
                                    component: () => import('@/views/index/tasks/today/table.vue'),
                                    children: [
                                        {
                                            path: ':taskId',
                                            name: 'tasks-today-table-task',
                                            props: true,
                                            component: () =>
                                                import('@/views/index/tasks/common/task.vue')
                                        }
                                    ]
                                },
                                {
                                    path: 'kanban',
                                    name: 'tasks-today-kanban',
                                    component: () => import('@/views/index/tasks/today/kanban.vue')
                                }
                            ]
                        },
                        {
                            path: 'tomorrow',
                            name: 'tasks-tomorrow',
                            meta: { title: '明日任务' },
                            component: () => import('@/views/index/tasks/tomorrow/index.vue'),
                            redirect: { name: 'tasks-tomorrow-table' },
                            children: [
                                {
                                    path: 'table',
                                    name: 'tasks-tomorrow-table',
                                    component: () =>
                                        import('@/views/index/tasks/tomorrow/table.vue'),
                                    children: [
                                        {
                                            path: ':taskId',
                                            name: 'tasks-tomorrow-table-task',
                                            props: true,
                                            component: () =>
                                                import('@/views/index/tasks/common/task.vue')
                                        }
                                    ]
                                },
                                {
                                    path: 'kanban',
                                    name: 'tasks-tomorrow-kanban',
                                    component: () =>
                                        import('@/views/index/tasks/tomorrow/kanban.vue')
                                }
                            ]
                        },
                        {
                            path: 'week',
                            name: 'tasks-week',
                            meta: { title: '最近7天' },
                            component: () => import('@/views/index/tasks/week/index.vue'),
                            redirect: { name: 'tasks-week-table' },
                            children: [
                                {
                                    path: 'table',
                                    name: 'tasks-week-table',
                                    component: () => import('@/views/index/tasks/week/table.vue'),
                                    children: [
                                        {
                                            path: ':taskId',
                                            name: 'tasks-week-table-task',
                                            props: true,
                                            component: () =>
                                                import('@/views/index/tasks/common/task.vue')
                                        }
                                    ]
                                },
                                {
                                    path: 'kanban',
                                    name: 'tasks-week-kanban',
                                    component: () => import('@/views/index/tasks/week/kanban.vue')
                                }
                            ]
                        },
                        {
                            path: 'inbox',
                            name: 'tasks-inbox',
                            meta: { title: '收集箱' },
                            component: () => import('@/views/index/tasks/inbox/index.vue'),
                            redirect: { name: 'tasks-inbox-table' },
                            children: [
                                {
                                    path: 'table',
                                    name: 'tasks-inbox-table',
                                    component: () => import('@/views/index/tasks/inbox/table.vue'),
                                    children: [
                                        {
                                            path: ':taskId',
                                            name: 'tasks-inbox-table-task',
                                            props: true,
                                            component: () =>
                                                import('@/views/index/tasks/common/task.vue')
                                        }
                                    ]
                                },
                                {
                                    path: 'kanban',
                                    name: 'tasks-inbox-kanban',
                                    component: () => import('@/views/index/tasks/inbox/kanban.vue')
                                }
                            ]
                        },
                        {
                            path: ':projectId',
                            name: 'tasks-project',
                            props: true,
                            component: () => import('@/views/index/tasks/project/index.vue'),
                            redirect: { name: 'tasks-project-table' },
                            children: [
                                {
                                    path: 'table',
                                    name: 'tasks-project-table',
                                    component: () =>
                                        import('@/views/index/tasks/project/table.vue'),
                                    children: [
                                        {
                                            path: ':taskId',
                                            name: 'tasks-project-table-task',
                                            props: true,
                                            component: () =>
                                                import('@/views/index/tasks/common/task.vue')
                                        }
                                    ]
                                },
                                {
                                    path: 'kanban',
                                    name: 'tasks-project-kanban',
                                    component: () =>
                                        import('@/views/index/tasks/project/kanban.vue')
                                }
                            ]
                        },
                        {
                            path: 'recycle',
                            name: 'tasks-recycle',
                            meta: { title: '垃圾桶' },
                            component: () => import('@/views/index/tasks/recycle/index.vue'),
                            redirect: { name: 'tasks-recycle-table' },
                            children: [
                                {
                                    path: 'table',
                                    name: 'tasks-recycle-table',
                                    component: () =>
                                        import('@/views/index/tasks/recycle/table.vue'),
                                    children: [
                                        {
                                            path: ':taskId',
                                            name: 'tasks-recycle-table-task',
                                            props: true,
                                            component: () =>
                                                import('@/views/index/tasks/common/task.vue')
                                        }
                                    ]
                                },
                                {
                                    path: 'kanban',
                                    name: 'tasks-recycle-kanban',
                                    component: () =>
                                        import('@/views/index/tasks/recycle/kanban.vue')
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
})

router.afterEach((to, from) => {
    const { meta } = to
    if (meta && meta.title) {
        document.title = ('NaoTodo - ' + meta.title) as string
    } else {
        document.title = 'NaoTodo'
    }
})

export default router
