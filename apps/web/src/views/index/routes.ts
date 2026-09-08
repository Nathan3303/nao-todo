import tasksRoutes from './tasks/routes'
import calendarRoutes from './calendar/routes'
import pomodoroRoutes from './pomodoro/routes'
import searchRoutes from './search/routes'

export default {
    path: '/',
    name: 'index',
    component: () => import('./index.vue'),
    children: [
        tasksRoutes,
        calendarRoutes,
        pomodoroRoutes,
        searchRoutes,
        // SHELL-01 /settings 页面下线兜底：旧深链/书签/残留 LAST_VISITED_ROUTE 重定向任务页（不白屏）
        {
            path: 'settings/:pathMatch(.*)*',
            name: 'settings-legacy-fallback',
            redirect: '/tasks'
        }
    ]
}