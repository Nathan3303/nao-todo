import { useSyncExternalStore } from '@lynx-js/react'
import { Button } from '@lynx-js/lynx-ui'
import type { SupportedLocale } from '@nao-todo/shared/locales/types'
import type { UserViewObject } from '@nao-todo/domain-identity/src/application/viewobjects'
import { useI18n } from '../hooks/use-i18n'
import { useSignOut } from '../hooks/use-auth-submit'
import { useAuthStore } from '../hooks/use-auth-store'
import { useNav } from '../hooks/use-nav'
import { getAuthToken } from '../logic/auth-token-core'
import { navCore } from '../logic/nav-core'
import type { TaskApp } from '../hooks/use-task-app'
import { ScreenHeader } from './components/screen-header'
import { UserAvatar } from './components/user-avatar'
import './task-ui.css'
import './settings.css'

export type SettingsScreenProps = {
    app: TaskApp
}

/**
 * 设置屏幕
 * @description 用户信息卡 + 语言切换 + 退出登录（登出成功清空登录态，App 层自动回登录页）。
 */
export const SettingsScreen = ({ app }: SettingsScreenProps) => {
    const { t, locale, setLocale } = useI18n()
    useNav()
    const { userToken } = useAuthStore(app.authStore)
    const { signOut } = useSignOut(app.authUseCase, userToken)
    // 订阅 profile（AuthStoreCore 快照读取）
    const profile = useSyncExternalStore<UserViewObject | undefined>(
        app.authStore.subscribe,
        app.authStore.getUserProfile
    )

    const nickname = profile?.nickname || 'NaoTodo'
    const email = profile?.email ?? ''

    return (
        <view className="ts-screen">
            <view className="ts-glow" />
            <ScreenHeader
                title={t('nav.settings')}
                left="back"
                onLeftClick={() => navCore.back()}
            />

            <scroll-view className="ts-scroll" scroll-orientation="vertical">
                <view className="st-body">
                    {/* 用户信息 */}
                    <view className="ts-card st-profile">
                        <UserAvatar
                            avatar={profile?.avatar ?? ''}
                            nickname={nickname}
                            token={getAuthToken()}
                            size={96}
                        />
                        <view className="st-profile-info">
                            <text className="st-nickname">{nickname}</text>
                            {email !== '' ? <text className="st-email">{email}</text> : null}
                        </view>
                    </view>

                    {/* 语言 */}
                    <view className="ts-card">
                        <text className="ts-field-label">{t('settings.language')}</text>
                        <view className="ts-chips">
                            {(['zh-CN', 'en-US'] as SupportedLocale[]).map((item) => (
                                <Button
                                    key={item}
                                    className={`ts-chip${locale === item ? ' ui-active' : ''}`}
                                    onClick={() => setLocale(item)}
                                >
                                    <text className="ts-chip-text">
                                        {item === 'zh-CN'
                                            ? t('settings.languageZhCN')
                                            : t('settings.languageEnUS')}
                                    </text>
                                </Button>
                            ))}
                        </view>
                    </view>

                    {/* 退出登录 */}
                    <Button
                        className="st-signout"
                        onClick={() => {
                            'background only'
                            signOut()
                        }}
                    >
                        <text className="st-signout-text">{t('mobile.settings.signOut')}</text>
                    </Button>
                </view>
            </scroll-view>
        </view>
    )
}