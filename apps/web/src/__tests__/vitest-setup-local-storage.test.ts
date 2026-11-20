// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { ensureLocalStorage } from '../../../../vitest.setup'

/**
 * 全局 setup（`vitest.setup.ts`）判据：只在 localStorage 不可用时注入内存实现。
 * 背景：Node ≥ 26 暴露 `globalThis.localStorage` 访问器 ⇒ vitest 的 jsdom 环境不再注入它。
 */

describe('vitest.setup.ts - localStorage 兜底', () => {
    it('jsdom 已注入时不覆盖（返回 false，仍是原实现且可读写）', () => {
        const injected = globalThis.localStorage
        expect(typeof injected?.setItem).toBe('function')

        expect(ensureLocalStorage()).toBe(false)
        expect(globalThis.localStorage).toBe(injected)

        globalThis.localStorage.setItem('setup-probe', '1')
        expect(globalThis.localStorage.getItem('setup-probe')).toBe('1')
        globalThis.localStorage.removeItem('setup-probe')
    })

    it('缺失时注入内存实现（可读写，二次调用不再改动）', () => {
        const scope = {} as typeof globalThis
        expect(scope.localStorage).toBeUndefined()

        expect(ensureLocalStorage(scope)).toBe(true)

        const storage = scope.localStorage
        storage.setItem('a', '1')
        storage.setItem('b', '2')
        expect(storage.getItem('a')).toBe('1')
        expect(storage.length).toBe(2)
        expect(storage.key(1)).toBe('b')
        expect(storage.key(9)).toBeNull()
        storage.removeItem('a')
        expect(storage.getItem('a')).toBeNull()
        expect(storage.length).toBe(1)

        expect(ensureLocalStorage(scope)).toBe(false)
        expect(scope.localStorage).toBe(storage)
    })

    it('访问器抛错（Node 26 无 --localstorage-file 变体）时同样注入', () => {
        const scope = Object.defineProperty({}, 'localStorage', {
            configurable: true,
            get() {
                throw new Error('localStorage is not available')
            }
        }) as typeof globalThis

        expect(ensureLocalStorage(scope)).toBe(true)

        scope.localStorage.setItem('k', 'v')
        expect(scope.localStorage.getItem('k')).toBe('v')
    })
})