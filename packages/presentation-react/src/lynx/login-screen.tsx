import { Button, Input, KeyboardAwareTrigger } from '@lynx-js/lynx-ui'
import { useAuthSubmit } from '../hooks/use-auth-submit'
import { useI18n } from '../hooks/use-i18n'
import { validateSignInForm } from '../logic/auth-form-core'
import type { ComposedAuthUseCase } from '../logic/compose-auth-usecase'
import { AuthScreen } from './components/auth-screen'
import './auth.css'

export type LoginScreenProps = {
    authUseCase: ComposedAuthUseCase
    onSwitchToRegister: () => void
    /** 注册成功回填的邮箱 */
    initialEmail?: string
}

/**
 * 登录屏幕
 * @description 邮箱/密码表单（lynx-ui Input 受控），提交编排收敛于 useAuthSubmit，
 *              组件经 hook 触发，不直接调用 UseCase（DDD 红线）；
 *              成功时 AuthStoreCore 状态更新由 App 层响应切换页面。
 */
export const LoginScreen = ({
    authUseCase,
    onSwitchToRegister,
    initialEmail
}: LoginScreenProps) => {
    const { t } = useI18n()
    const { values, setField, error, loading, submit } = useAuthSubmit(
        authUseCase,
        { email: initialEmail ?? '', password: '' },
        validateSignInForm,
        (uc, v) => uc.signIn({ email: v.email, password: v.password })
    )

    const handleSubmit = () => {
        'background only'
        void submit().catch((error) => console.error(error))
    }

    return (
        <AuthScreen
            activeTab="signin"
            onSwitchTab={(tab) => {
                if (tab === 'signup') onSwitchToRegister()
            }}
        >
            <text className="auth-title">{t('auth.signIn.title')}</text>
            <text className="auth-subtitle">{t('auth.signIn.subtitle')}</text>

            <KeyboardAwareTrigger offset={0}>
                <view className="auth-field">
                    <Input
                        className="auth-input"
                        type="email"
                        value={values.email}
                        placeholder={t('auth.signIn.emailPlaceholder')}
                        onInput={(value) => setField('email', value)}
                    />
                </view>
            </KeyboardAwareTrigger>

            <KeyboardAwareTrigger offset={0}>
                <view className="auth-field">
                    <Input
                        className="auth-input"
                        type="password"
                        value={values.password}
                        placeholder={t('auth.signIn.passwordPlaceholder')}
                        onInput={(value) => setField('password', value)}
                    />
                </view>
            </KeyboardAwareTrigger>

            {error !== null ? <text className="auth-error">{error}</text> : null}

            <Button className="auth-submit" disabled={loading} onClick={handleSubmit}>
                <text className="auth-submit-text">
                    {loading ? t('common.loading') : t('auth.signIn.submit')}
                </text>
            </Button>
        </AuthScreen>
    )
}