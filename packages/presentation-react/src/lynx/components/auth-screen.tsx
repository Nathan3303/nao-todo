import type { ReactNode } from 'react'
import { KeyboardAwareResponder, KeyboardAwareRoot } from '@lynx-js/lynx-ui'
import { AuthTabs } from './auth-tabs'
import type { AuthTab } from './auth-tabs'

export type AuthScreenProps = {
    activeTab: AuthTab
    onSwitchTab: (tab: AuthTab) => void
    children: ReactNode
}

/**
 * 认证屏幕骨架
 * @description 共享的品牌区、氛围背景、表单卡片与登录/注册 tabs；
 *              键盘避让（KeyboardAwareRoot/Responder）包裹内容，输入字段由各屏幕用 Trigger 包裹。
 */
export const AuthScreen = ({ activeTab, onSwitchTab, children }: AuthScreenProps) => {
    return (
        <view className="auth-screen">
            <KeyboardAwareRoot>
                <KeyboardAwareResponder className="auth-screen-inner">
                    <view className="auth-glow" />
                    <view className="auth-brand">
                        <view className="auth-brand-mark">
                            <text className="auth-brand-mark-text">N</text>
                        </view>
                        <text className="auth-brand-name">NaoTodo</text>
                    </view>
                    <view className="auth-card">
                        <AuthTabs active={activeTab} onChange={onSwitchTab} />
                        {children}
                    </view>
                </KeyboardAwareResponder>
            </KeyboardAwareRoot>
        </view>
    )
}