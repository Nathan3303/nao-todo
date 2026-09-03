import { Button, Input, KeyboardAwareTrigger } from '@lynx-js/lynx-ui'
import { useAuthSubmit } from '../hooks/use-auth-submit'
import { useI18n } from '../hooks/use-i18n'
import { validateSignUpForm } from '../logic/auth-form-core'
import type { ComposedAuthUseCase } from '../logic/compose-auth-usecase'
import { AuthScreen } from './components/auth-screen'
import './auth.css'

export type RegisterScreenProps = {
    authUseCase: ComposedAuthUseCase
    /** 切回登录，email 用于回填登录表单 */
    onSwitchToSignIn: (email?: string) => void
}

/**
 * 注册屏幕
 * @description 邮箱/昵称/密码/确认密码表单（lynx-ui Input 受控），提交编排收敛于 useAuthSubmit，
 *              组件经 hook 触发，不直接调用 UseCase（DDD 红线）；
 *              注册成功后切回登录并回填邮箱。
 */
export const RegisterScreen = ({ authUseCase, onSwitchToSignIn }: RegisterScreenProps) => {
    const { t } = useI18n()
    const { values, setField, error, loading, submit } = useAuthSubmit(
        authUseCase,
        { email: '', password: '', confirmPassword: '', nickname: '' },
        validateSignUpForm,
        (uc, v) =>
            uc.signUp({
                email: v.email,
                password: v.password,
                confirmPassword: v.confirmPassword,
                nickname: v.nickname
            })
    )

    const handleSubmit = () => {
        'background only'
        void submit()
            .then((ok) => {
                if (ok) onSwitchToSignIn(values.email)
            })
            .catch((error) => console.error(error))
    }

    return (
        <AuthScreen
            activeTab="signup"
            onSwitchTab={(tab) => {
                if (tab === 'signin') onSwitchToSignIn()
            }}
        >
            <text className="auth-title">{t('auth.signUp.title')}</text>
            <text className="auth-subtitle">{t('auth.signUp.subtitle')}</text>

            <KeyboardAwareTrigger offset={0}>
                <view className="auth-field">
                    <Input
                        className="auth-input"
                        type="email"
                        value={values.email}
                        placeholder={t('auth.signUp.emailPlaceholder')}
                        onInput={(value) => setField('email', value)}
                    />
                </view>
            </KeyboardAwareTrigger>

            <KeyboardAwareTrigger offset={0}>
                <view className="auth-field">
                    <Input
                        className="auth-input"
                        type="text"
                        value={values.nickname}
                        placeholder={t('auth.signUp.nickname')}
                        onInput={(value) => setField('nickname', value)}
                    />
                </view>
            </KeyboardAwareTrigger>

            <KeyboardAwareTrigger offset={0}>
                <view className="auth-field">
                    <Input
                        className="auth-input"
                        type="password"
                        value={values.password}
                        placeholder={t('auth.signUp.passwordPlaceholder')}
                        onInput={(value) => setField('password', value)}
                    />
                </view>
            </KeyboardAwareTrigger>

            <KeyboardAwareTrigger offset={0}>
                <view className="auth-field">
                    <Input
                        className="auth-input"
                        type="password"
                        value={values.confirmPassword}
                        placeholder={t('auth.signUp.confirmPassword')}
                        onInput={(value) => setField('confirmPassword', value)}
                    />
                </view>
            </KeyboardAwareTrigger>

            {error !== null ? <text className="auth-error">{error}</text> : null}

            <Button className="auth-submit" disabled={loading} onClick={handleSubmit}>
                <text className="auth-submit-text">
                    {loading ? t('common.loading') : t('auth.signUp.submit')}
                </text>
            </Button>
        </AuthScreen>
    )
}