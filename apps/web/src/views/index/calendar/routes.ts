import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw = {
    path: 'calendar',
    name: 'calendar',
    component: () => import('./entry.vue'),
    // D4/C4：父级用 beforeEnter（非 redirect）——redirect 会先于全局 beforeEach 解析成子路由名，
    //        令 LAST_CALENDAR_ROUTE 恢复失效（照抄 tasks 段范式）；父名 `calendar` 保持不变
    beforeEnter: (to) => {
        if (to.name !== 'calendar') return
        return { name: 'calendar-monthly' }
    },
    children: [
        {
            path: 'monthly/:taskId?',
            name: 'calendar-monthly',
            component: () => import('@/components/calendar/monthly/index.vue')
        },
        {
            path: 'weekly/:taskId?',
            name: 'calendar-weekly',
            component: () => import('@/components/calendar/weekly/index.vue')
        },
        {
            path: 'daily/:taskId?',
            name: 'calendar-day',
            component: () => import('@/components/calendar/daily/index.vue')
        }
    ]
}

export default routes