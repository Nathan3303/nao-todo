// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NueMessage } from 'nue-ui'
import {
    OFFLINE_READONLY_ERROR,
    resetWriteGateForTest,
    withReadOnlyGuard,
    type WriteMethodMap
} from '../write-gate'
import { resetReadOnlyForTest, setOffline, setOfflineEntryActive } from '../read-only-state'

/**
 * 阶段一统一写闸门断言（C-59 / AC10）
 * @description 覆盖：
 *              ① 离线 ⇒ 写方法被拦截、原方法**零调用**（⇒ 仓储零写入 ⇒ 不产生 `markDirty`）；
 *              ② 返回形态与原方法一致（`'error'` / `'tuple'`）⇒ 既有调用方无需改动；
 *              ③ 可见提示（`NueMessage.warning`）且**节流**；
 *              ④ 在线 ⇒ 原样透传（含读方法与 `signOut` 等非写方法）；
 *              ⑤ 离线进入 flag 与网络离线同口径（单一判定函数 `isReadOnly`）。
 */

const WRITE_METHODS: WriteMethodMap = {
    create: 'tuple',
    update: 'error',
    delete: 'error'
}

type FakeUseCase = {
    create: (name: string) => Promise<[unknown, unknown]>
    update: (id: string) => Promise<unknown>
    delete: (id: string) => Promise<unknown>
    list: () => Promise<[unknown, unknown]>
    signOut: () => Promise<unknown>
}

const makeUseCase = (): {
    useCase: FakeUseCase
    spies: Record<string, ReturnType<typeof vi.fn>>
} => {
    const spies = {
        create: vi.fn(async (name: string) => [{ id: name }, null]),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
        list: vi.fn(async () => [[], null]),
        signOut: vi.fn(async () => null)
    }
    return { useCase: spies as unknown as FakeUseCase, spies }
}

beforeEach(() => {
    resetReadOnlyForTest()
    resetWriteGateForTest()
    vi.restoreAllMocks()
})

afterEach(() => {
    resetReadOnlyForTest()
    resetWriteGateForTest()
})

describe('withReadOnlyGuard - C-59/AC10 离线统一禁写', () => {
    it('离线：写方法被拦截、原方法零调用，返回形态与原方法一致（error / tuple）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const { useCase, spies } = makeUseCase()
        const guarded = withReadOnlyGuard(useCase, WRITE_METHODS)

        setOffline(true)

        await expect(guarded.update('t-1')).resolves.toBe(OFFLINE_READONLY_ERROR)
        await expect(guarded.delete('t-1')).resolves.toBe(OFFLINE_READONLY_ERROR)
        await expect(guarded.create('t-1')).resolves.toEqual([null, OFFLINE_READONLY_ERROR])

        // 原方法零调用 ⇒ 仓储零写入 ⇒ 不产生 markDirty
        expect(spies.update).not.toHaveBeenCalled()
        expect(spies.delete).not.toHaveBeenCalled()
        expect(spies.create).not.toHaveBeenCalled()
        // 可见提示
        expect(warn).toHaveBeenCalledTimes(1)
        expect(String(warn.mock.calls[0]?.[0])).toContain('离线')
    })

    it('离线：读方法与未列入的写方法（signOut）原样透传', async () => {
        const { useCase, spies } = makeUseCase()
        const guarded = withReadOnlyGuard(useCase, WRITE_METHODS)
        setOffline(true)

        await expect(guarded.list()).resolves.toEqual([[], null])
        await expect(guarded.signOut()).resolves.toBeNull()
        expect(spies.list).toHaveBeenCalledTimes(1)
        expect(spies.signOut).toHaveBeenCalledTimes(1)
    })

    it('在线：写方法原样透传，不提示', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const { useCase, spies } = makeUseCase()
        const guarded = withReadOnlyGuard(useCase, WRITE_METHODS)

        setOffline(false)

        await expect(guarded.update('t-1')).resolves.toBeNull()
        await expect(guarded.create('t-1')).resolves.toEqual([{ id: 't-1' }, null])
        expect(spies.update).toHaveBeenCalledTimes(1)
        expect(spies.create).toHaveBeenCalledTimes(1)
        expect(warn).not.toHaveBeenCalled()
    })

    it('会话级离线进入 flag 与网络离线同口径（单一判定函数）', async () => {
        const { useCase, spies } = makeUseCase()
        const guarded = withReadOnlyGuard(useCase, WRITE_METHODS)

        setOfflineEntryActive(true)
        await expect(guarded.update('t-1')).resolves.toBe(OFFLINE_READONLY_ERROR)
        expect(spies.update).not.toHaveBeenCalled()
    })

    it('可见提示节流：连续写操作只提示一次（reset 后恢复）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const { useCase } = makeUseCase()
        const guarded = withReadOnlyGuard(useCase, WRITE_METHODS)
        setOffline(true)

        await guarded.update('t-1')
        await guarded.update('t-2')
        expect(warn).toHaveBeenCalledTimes(1)

        resetWriteGateForTest()
        await guarded.update('t-3')
        expect(warn).toHaveBeenCalledTimes(2)
    })
})