import { describe, expect, it } from 'vite-plus/test'
import { compareVersions, isNewerVersion, parseVersion } from '../version'

/**
 * T736 · 版本比较（AC6 判定表 · PRD §五）
 *
 * @description 只有**严格大于**才算有新版本；相等/更旧/无法解析都不得提示「立即更新」。
 */

describe('版本比较（AC6 判定表）', () => {
    it('三段任一位置更大 ⇒ 有新版本', () => {
        expect(isNewerVersion('1.21.0', '1.20.3')).toBe(true)
        expect(isNewerVersion('1.20.4', '1.20.3')).toBe(true)
        expect(isNewerVersion('2.0.0', '1.99.99')).toBe(true)
    })

    it('相等 ⇒ 不是新版本（AC6：不得出现「立即更新」）', () => {
        expect(isNewerVersion('1.20.3', '1.20.3')).toBe(false)
        expect(compareVersions('1.20.3', '1.20.3')).toBe(0)
    })

    it('远端更旧 ⇒ 不是新版本（回滚重发也不误报）', () => {
        expect(isNewerVersion('1.20.2', '1.20.3')).toBe(false)
        expect(isNewerVersion('0.9.9', '1.0.0')).toBe(false)
    })

    it('数字按数值比较而非字典序（1.10.0 > 1.9.0）', () => {
        expect(isNewerVersion('1.10.0', '1.9.0')).toBe(true)
    })

    it('容忍前缀 v / V 与首尾空白（Release tag 惯例）', () => {
        expect(parseVersion('v1.21.0')).toEqual({ major: 1, minor: 21, patch: 0 })
        expect(isNewerVersion(' V2.0.0 ', '1.20.3')).toBe(true)
    })

    it('无法解析 ⇒ null / false（⛔ 不得把解析失败当成有更新）', () => {
        expect(parseVersion('latest')).toBeNull()
        expect(parseVersion('1.2')).toBeNull()
        expect(parseVersion(undefined)).toBeNull()
        expect(compareVersions('1.2', '1.0.0')).toBeNull()
        expect(isNewerVersion('', '1.20.3')).toBe(false)
        expect(isNewerVersion('1.20.3', 'oops')).toBe(false)
    })
})