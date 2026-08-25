import { Button } from '@lynx-js/lynx-ui'
import type { ReactNode } from 'react'
import { useSafeArea } from '../../hooks/use-safe-area'
import '../task-ui.css'

export type ScreenHeaderProps = {
    title: string
    /** 左侧按钮：menu（☰）/ back（‹）/ undefined（不显示） */
    left?: 'menu' | 'back'
    onLeftClick?: () => void
    /** 右侧自定义区域（预留：如筛选/更多） */
    right?: ReactNode
}

/**
 * 屏幕顶栏（含安全区适配）
 * @description 顶部插入刘海占位（高度 = 安全区 top，rpx），背景与顶栏同色融入；
 *              所有任务模块屏幕复用，消除重复 header 结构。
 */
export const ScreenHeader = ({ title, left, onLeftClick, right }: ScreenHeaderProps) => {
    const { top } = useSafeArea()

    return (
        <view>
            {top > 0 ? <view className="ts-safe-top" style={{ height: `${top}rpx` }} /> : null}
            <view className="ts-header">
                <view className="ts-header-left">
                    {left !== undefined ? (
                        <Button className="ts-header-btn" onClick={onLeftClick}>
                            <text className="ts-header-btn-text">
                                {left === 'menu' ? '☰' : '‹'}
                            </text>
                        </Button>
                    ) : null}
                    <text className="ts-header-title">{title}</text>
                </view>
                {right ?? null}
            </view>
        </view>
    )
}