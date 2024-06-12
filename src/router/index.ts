import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: () => import('../views/index/index.vue'),
            children: [
                {
                    path: '/inbox',
                    name: 'inbox',
                    component: () => import('../views/index/inbox/index.vue')
                },
                {
                    path: '/myactivity',
                    name: 'myactivity',
                    component: () => import('../views/index/my-activity/index.vue')
                },
                {
                    path: '/project/:projectId',
                    name: 'project',
                    props: true,
                    component: () => import('../views/index/project/index.vue'),
                    redirect(to) {
                        return { name: 'board', params: { projectId: to.params.projectId } }
                    },
                    children: [
                        {
                            path: 'board',
                            name: 'board',
                            props: true,
                            component: () => import('../views/index/project/board/index.vue')
                        }
                    ]
                }
            ]
        }
    ]
})

export default router
