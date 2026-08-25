import { useState } from '@lynx-js/react'
import {
    I18nProvider,
    setAppConfig,
    useNav,
    useTaskApp,
    getAuthToken
} from '@nao-todo/presentation-react'
import {
    AppSidebar,
    LoginScreen,
    ProjectManageScreen,
    RegisterScreen,
    SettingsScreen,
    TagManageScreen,
    TaskCreateScreen,
    TaskDetailScreen,
    TaskListScreen
} from '@nao-todo/presentation-react/src/lynx'
import { useLynxRequester } from '@nao-todo/shared/requester/lynx'
import type { TaskApp } from '@nao-todo/presentation-react/src/hooks/use-task-app'

import './App.css'

/**
 * API 基础地址
 * @description 默认指向线上测试服务器（与 web 生产环境一致：apps/web/.env.production）。
 *              本地调试后端时改为开发机局域网 IP（如 http://192.168.x.x:3302/api），
 *              需满足：后端监听 0.0.0.0:3302、防火墙放行 3302、手机与开发机同网段。
 */
const API_BASE_URL = 'https://todobe.nathanao.space/api'

// 全局配置（头像相对路径拼接等）
setAppConfig({ apiBaseURL: API_BASE_URL })

/**
 * 已登录路由分发
 * @description navCore 驱动的两级路由：子页（详情/创建/管理）入栈，页面（列表/设置）替换；
 *              侧边栏状态由 App 层持有（抽屉悬浮于任意屏幕之上）。
 */
function TaskRouter({ app, onOpenSidebar }: { app: TaskApp; onOpenSidebar: () => void }) {
    const route = useNav()
    switch (route.screen) {
        case 'task-list':
            return <TaskListScreen app={app} onOpenSidebar={onOpenSidebar} />
        case 'task-detail':
            return <TaskDetailScreen app={app} />
        case 'task-create':
            return <TaskCreateScreen app={app} />
        case 'project-manage':
            return <ProjectManageScreen app={app} />
        case 'tag-manage':
            return <TagManageScreen app={app} />
        case 'settings':
            return <SettingsScreen app={app} />
        default:
            return <TaskListScreen app={app} onOpenSidebar={onOpenSidebar} />
    }
}

function AppInner() {
    // 页面状态：登录/注册 tab 切换；注册成功回填邮箱（纯 UI 状态）
    const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin')
    const [initialEmail, setInitialEmail] = useState<string | undefined>(undefined)
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // 依赖注入唯一入口：任务应用组合根（认证/用户/任务/项目/标签/内建清单全量装配），
    // 凭证失效回调清空登录态并回登录页；请求器实时读取 token 注入 Authorization 头
    const app = useTaskApp({
        createRequester: (onAuthExpired) =>
            useLynxRequester(API_BASE_URL, onAuthExpired, getAuthToken)
    })

    if (!app.isAuthenticated) {
        // 登录态消失（首次启动/登出/凭证失效）：回登录页
        return (
            <view>
                {authTab === 'signin' ? (
                    <LoginScreen
                        authUseCase={app.authUseCase}
                        onSwitchToRegister={() => setAuthTab('signup')}
                        initialEmail={initialEmail}
                    />
                ) : (
                    <RegisterScreen
                        authUseCase={app.authUseCase}
                        onSwitchToSignIn={(email) => {
                            setInitialEmail(email)
                            setAuthTab('signin')
                        }}
                    />
                )}
            </view>
        )
    }

    return (
        <view className="app-shell">
            <TaskRouter app={app} onOpenSidebar={() => setSidebarOpen(true)} />
            <AppSidebar app={app} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </view>
    )
}

export function App() {
    return (
        <I18nProvider>
            <AppInner />
        </I18nProvider>
    )
}