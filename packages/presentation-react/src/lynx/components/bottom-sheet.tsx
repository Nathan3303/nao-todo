import type { ReactNode } from '@lynx-js/react'
import './bottom-sheet.css'

export type BottomSheetProps = {
    /** 受控显示 */
    show: boolean
    /** 关闭（遮罩点击） */
    onClose: () => void
    children: ReactNode
}

/**
 * 自绘底部弹层（替代 lynx-ui-sheet，规避 LynxExplorer 上 snap/layout 测量兼容问题）
 * @description 与侧边栏 drawer 同模式（自绘 fixed overlay + transform 动画，已验证可用）：
 *              遮罩淡入 + 面板从底部滑入；点击遮罩关闭。
 */
export const BottomSheet = ({ show, onClose, children }: BottomSheetProps) => {
    if (!show) return null

    return (
        <view className="bs-root">
            <view className="bs-backdrop" bindtap={onClose} />
            <view className="bs-panel">{children}</view>
        </view>
    )
}

export default BottomSheet