import { useEffect, useRef, useState } from '@lynx-js/react'
import type { ReactNode } from '@lynx-js/react'
import './bottom-sheet.css'

export type BottomSheetProps = {
    /** 受控显示 */
    show: boolean
    /** 关闭（遮罩点击） */
    onClose: () => void
    children: ReactNode
}

/** 退出动画时长（ms，与 CSS bs-rise-out 0.28s 对齐） */
const EXIT_DURATION = 280

/**
 * 自绘底部弹层（替代 lynx-ui-sheet，规避 LynxExplorer 上 snap/layout 测量兼容问题）
 * @description 打开/收起均有动画：遮罩淡入淡出 + 面板上滑入场/下滑退场。
 *              关闭采用延迟卸载（先播退出动画，动画结束后卸载），与侧边栏同模式。
 */
export const BottomSheet = ({ show, onClose, children }: BottomSheetProps) => {
    const [mounted, setMounted] = useState(show)
    const [closing, setClosing] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (show) {
            if (timerRef.current !== null) clearTimeout(timerRef.current)
            setMounted(true)
            setClosing(false)
        } else if (mounted) {
            // 播退出动画后卸载
            setClosing(true)
            if (timerRef.current !== null) clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => {
                setMounted(false)
                setClosing(false)
            }, EXIT_DURATION)
        }
        return () => {
            if (timerRef.current !== null) clearTimeout(timerRef.current)
        }
    }, [show, mounted])

    if (!mounted) return null

    return (
        <view className={`bs-root${closing ? ' closing' : ''}`}>
            <view className="bs-backdrop" bindtap={onClose} />
            <view className="bs-panel">{children}</view>
        </view>
    )
}

export default BottomSheet