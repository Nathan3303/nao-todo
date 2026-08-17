import { useState } from '@lynx-js/react'
import { I18nProvider, useAuthApp } from '@nao-todo/presentation-react'
import { LoginScreen, RegisterScreen, HomeScreen } from '@nao-todo/presentation-react/src/lynx'
import { useLynxRequester } from '@nao-todo/shared/requester/lynx'

import './App.css'

/**
 * API 基础地址
 * @description 默认指向线上测试服务器（与 web 生产环境一致：apps/web/.env.production）。
 *              本地调试后端时改为开发机局域网 IP（如 http://192.168.x.x:3302/api），
 *              需满足：后端监听 0.0.0.0:3302、防火墙放行 3302、手机与开发机同网段。
 */
const API_BASE_URL = 'https://todobe.nathanao.space/api'

function AppInner() {
    // 页面状态：登录/注册 tab 切换；注册成功回填邮箱（纯 UI 状态）
    const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin')
    const [initialEmail, setInitialEmail] = useState<string | undefined>(undefined)

    // 依赖注入唯一入口：装配与业务编排（checkIn 恢复、凭证失效清空登录态）均在 useAuthApp 内，
    // 本层仅提供请求器工厂（配置职责），只消费返回值并做页面切换（Views 层职责）
    const { isAuthenticated, authUseCase, store } = useAuthApp({
        createRequester: (onAuthExpired) => useLynxRequester(API_BASE_URL, onAuthExpired)
    })

    if (isAuthenticated) {
        // 登录成功落地页：欢迎信息 + 登出（登出后 store 状态变化自动切回登录页）
        return <HomeScreen authUseCase={authUseCase} store={store} />
    }

    return (
        <view>
            {authTab === 'signin' ? (
                <LoginScreen
                    authUseCase={authUseCase}
                    onSwitchToRegister={() => setAuthTab('signup')}
                    initialEmail={initialEmail}
                />
            ) : (
                <RegisterScreen
                    authUseCase={authUseCase}
                    onSwitchToSignIn={(email) => {
                        setInitialEmail(email)
                        setAuthTab('signin')
                    }}
                />
            )}
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