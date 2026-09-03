import { useMemo } from 'react'
import { getSafeAreaRpx } from '../logic/safe-area-core'

/**
 * 安全区 hook
 * @description 返回顶部/底部安全区（rpx），供各屏幕头部占位与悬浮按钮避让。
 *              getSafeAreaRpx 内部有缓存，hook 仅做一次性读取。
 * @returns { top, bottom } 单位 rpx
 */
export const useSafeArea = (): { top: number; bottom: number } => {
    return useMemo(() => getSafeAreaRpx(), [])
}