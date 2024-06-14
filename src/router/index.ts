import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
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
                        return { name: 'list', params: { projectId: to.params.projectId } }
                    },
                    children: [
                        {
                            path: 'list',
                            name: 'list',
                            props: true,
                            component: () => import('../views/index/project/list/index.vue')
                        }
                    ]
                }
            ]
        },
        {
            path: '/authentication/:operation?',
            name: 'authentication',
            props: true,
            component: () => import('../views/authentication/index.vue')
        }
    ]
})

export default router
