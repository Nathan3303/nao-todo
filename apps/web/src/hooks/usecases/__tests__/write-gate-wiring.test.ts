// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
    OFFLINE_READONLY_ERROR,
    resetReadOnlyForTest,
    setOffline
} from '@nao-todo/presentation/offline'
import { useCaseBinding as desktopBinding } from '@nao-todo/desktopapp/src/renderer/src/hooks/usecases/binding'
import { useCaseBinding as webBinding } from '../binding'

/**
 * 闸门落点断言（C-59 / AC10 / ADR-r5）
 * @description arch 5 点验收第 1 条：**注入点仅 web**，desktop `hooks/usecases/**` 逐字不变，
 *              且有**负向断言**（desktop 闸门恒不生效）。
 *              - web binding 提供 `decorateUseCase`（套 `withReadOnlyGuard`）；
 *              - desktop binding **不提供** ⇒ 共享工厂 `useCaseBinding.decorateUseCase?.(...) ?? useCase`
 *                原样返回用例 ⇒ 桌面写路径（在线/离线）逐字不变。
 */

const fakeUseCase = () => ({
    delete: vi.fn(async (_id: string) => null),
    list: vi.fn(async () => [[], null])
})

beforeEach(() => {
    resetReadOnlyForTest()
})

afterEach(() => {
    resetReadOnlyForTest()
    vi.doUnmock('@/hooks/usecases/binding')
    vi.resetModules()
})

describe('闸门注入点 - web-only（ADR-r5）', () => {
    it('web binding 提供 decorateUseCase；离线时写方法被拦截、原方法零调用', async () => {
        expect(typeof webBinding.decorateUseCase).toBe('function')

        const useCase = fakeUseCase()
        const guarded = webBinding.decorateUseCase!(useCase, 'task')

        setOffline(true)
        await expect(guarded.delete('t-1')).resolves.toBe(OFFLINE_READONLY_ERROR)
        expect(useCase.delete).not.toHaveBeenCalled()

        setOffline(false)
        await expect(guarded.delete('t-1')).resolves.toBeNull()
        expect(useCase.delete).toHaveBeenCalledTimes(1)
    })

    it('负向：desktop binding **不提供** decorateUseCase（闸门恒不生效）', () => {
        expect(desktopBinding.decorateUseCase).toBeUndefined()
    })

    it('负向（行为）：desktop 形态 binding（无 decorateUseCase）⇒ 共享工厂原样返回用例，离线写仍透传', async () => {
        vi.resetModules()
        const remove = vi.fn(async () => null)
        vi.doMock('@/hooks/usecases/binding', () => ({
            useCaseBinding: {
                createTaskRepository: () => ({ remove })
                // 无 decorateUseCase —— desktop 形态
            }
        }))

        setOffline(true)
        const { useTaskUseCase } = await import('../use-task-usecase')
        const useCase = useTaskUseCase({ updateTask: vi.fn() } as never)

        await useCase.delete('t-1')
        // 离线仍透传到仓储（不产生 OFFLINE_READONLY 拦截）
        expect(remove).toHaveBeenCalledWith('t-1')
    })
})