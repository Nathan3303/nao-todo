import { Button } from '@lynx-js/lynx-ui'
import { useI18n } from '../../hooks/use-i18n'

/**
 * 认证 tab 类型
 */
export type AuthTab = 'signin' | 'signup'

export type AuthTabsProps = {
    active: AuthTab
    onChange: (tab: AuthTab) => void
}

/**
 * 登录/注册切换 tabs
 * @description 复用 lynx-ui Button（headless），active 态通过 .active class 高亮
 */
export const AuthTabs = ({ active, onChange }: AuthTabsProps) => {
    const { t } = useI18n()
    const isSignIn = active === 'signin'

    return (
        <view className="auth-tabs">
            <Button
                className={`auth-tab${isSignIn ? ' active' : ''}`}
                onClick={() => onChange('signin')}
            >
                <text className="auth-tab-text">{t('auth.signIn.submit')}</text>
            </Button>
            <Button
                className={`auth-tab${!isSignIn ? ' active' : ''}`}
                onClick={() => onChange('signup')}
            >
                <text className="auth-tab-text">{t('auth.signUp.submit')}</text>
            </Button>
        </view>
    )
}