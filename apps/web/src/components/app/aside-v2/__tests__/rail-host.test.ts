// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import {
    bindRailBottomHost,
    railBottomHost,
    railBottomHostVariant,
    unbindRailBottomHost
} from '../rail-host'

/**
 * T521 注入点注册表：两变体共用单一宿主 + 元素令牌解绑
 * @description 变体切换时 Vue 的新旧子树卸载/挂载次序不定 ⇒ 旧宿主迟到的解绑不得抢走新宿主
 *              （否则同步状态在切换瞬间整体消失）。见 PRD 不变量 2。
 */
afterEach(() => {
    unbindRailBottomHost()
})

describe('rail-host：变体感知的单一宿主', () => {
    it('绑定记录变体；无宿主时变体为 null', () => {
        const rail = document.createElement('div')
        const drawer = document.createElement('div')

        bindRailBottomHost(rail)
        expect(railBottomHost.value).toBe(rail)
        expect(railBottomHostVariant.value).toBe('rail')

        bindRailBottomHost(drawer, 'drawer')
        expect(railBottomHost.value).toBe(drawer)
        expect(railBottomHostVariant.value).toBe('drawer')

        unbindRailBottomHost()
        expect(railBottomHost.value).toBeNull()
        expect(railBottomHostVariant.value).toBeNull()
    })

    it('迟到的旧宿主解绑不清掉新宿主', () => {
        const rail = document.createElement('div')
        const drawer = document.createElement('div')

        bindRailBottomHost(rail, 'rail')
        bindRailBottomHost(drawer, 'drawer')
        // 旧变体卸载晚于新变体挂载
        unbindRailBottomHost(rail)

        expect(railBottomHost.value).toBe(drawer)
        expect(railBottomHostVariant.value).toBe('drawer')

        // 当前宿主自身的解绑照常生效
        unbindRailBottomHost(drawer)
        expect(railBottomHost.value).toBeNull()
    })
})