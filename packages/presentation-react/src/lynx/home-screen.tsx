import { Button } from '@lynx-js/lynx-ui'
import { useSignOut } from '../hooks/use-auth-submit'
import { useAuthStore } from '../hooks/use-auth-store'
import { useI18n } from '../hooks/use-i18n'
import type { AuthStoreCore } from '../logic/auth-store-core'
import type { ComposedAuthUseCase } from '../logic/compose-auth-usecase'
import './home.css'

export type HomeScreenProps = {
    authUseCase: ComposedAuthUseCase
    store: AuthStoreCore
}

/**
 * 首页（登录成功落地页）
 * @description 欢迎信息 + 登出按钮，打通「登录 → 存 token → 登出 → 清空」闭环；
 *              登出经 useSignOut 触发（组件不直接调用 UseCase），
 *              成功后 store.clearAuthData 触发 isAuthenticated=false，App 层自动切回登录页。
 */
export const HomeScreen = ({ authUseCase, store }: HomeScreenProps) => {
    const { t } = useI18n()
    const { userToken } = useAuthStore(store)
    const { signOut } = useSignOut(authUseCase, userToken)

    return (
        <view className="home-screen">
            <view className="home-glow" />
            <view className="home-brand-mark">
                <text className="home-brand-mark-text">N</text>
            </view>
            <text className="home-title">{t('welcome.greeting', { name: 'NaoTodo' })}</text>
            <text className="home-message">{t('welcome.message')}</text>
            <Button
                className="home-signout"
                onClick={() => {
                    'background only'
                    signOut()
                }}
            >
                <text className="home-signout-text">{t('common.signOut')}</text>
            </Button>
        </view>
    )
}