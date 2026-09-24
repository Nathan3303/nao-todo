// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
    OFFLINE_READONLY_ERROR,
    resetReadOnlyForTest,
    setOffline
} from '@nao-todo/presentation/offline'
import { LocalPomodoroRecordRepoImpl } from '@nao-todo/infrastructure/src/persistence-local/repos/pomodoro-record-repo-impl'
import { LocalPomodoroRepoImpl } from '@nao-todo/infrastructure/src/persistence-local/repos/pomodoro-repo-impl'
import { LocalProjectRepoImpl } from '@nao-todo/infrastructure/src/persistence-local/repos/project-repo-impl'
import { LocalTagRepoImpl } from '@nao-todo/infrastructure/src/persistence-local/repos/tag-repo-impl'
import { LocalTaskCheckItemRepoImpl } from '@nao-todo/infrastructure/src/persistence-local/repos/task-check-item-repo-impl'
import { LocalTaskCommentRepoImpl } from '@nao-todo/infrastructure/src/persistence-local/repos/task-comment-repo-impl'
import { LocalTaskRepoImpl } from '@nao-todo/infrastructure/src/persistence-local/repos/task-repo-impl'
import { useCaseBinding as desktopBinding } from '@nao-todo/desktopapp/src/renderer/src/hooks/usecases/binding'
import { useCaseBinding as webBinding } from '../binding'

/**
 * 闸门落点断言（C-59 / AC10 / ADR-r5）+ 阶段二 2A W1–W4 接线断言
 * @description arch 5 点验收第 1 条：**离线闸门注入点仅 web**，desktop `hooks/usecases/**`
 *              对它**零引用**；
 *              - web binding 提供 `decorateUseCase`（未切本地优先的域套 `withReadOnlyGuard`）；
 *              - **业务 7 域（W1 任务 / W2 子实体 / W3 容器 / W4 番茄）全部切本地优先
 *                ⇒ 这些域不套离线闸门**（ADR §5 M5）；**阶段二 2A M6 收敛后 web 离线闸门作用域仅身份域（W5）**，
 *                身份域不切、仍受闸门约束；
 *              - **P3（ADR `2026-09-24-project-archive.md` §15.3）：任务域两端均套「归档只读守卫」**
 *                （web 在此叠加，desktop 同 binding 同逻辑）⇒ 任务域 `decorateUseCase` 返回 Proxy；
 *                离线闸门语义不变（离线写仍透传）。
 *              - **绑定级断言（ADR §2.5 正向）**：web 已切域仓储 = 本地仓储。
 */

const fakeUseCase = () => ({
    delete: vi.fn(async (_id: string) => null),
    update: vi.fn(async (_id: string) => null),
    createRecord: vi.fn(async (_vo: unknown) => [null, null]),
    updateNickname: vi.fn(async (_vo: unknown) => null),
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
    it('表级（M6 收敛）：离线闸门作用域仅身份域 —— 任务域/项目域仅叠加归档守卫（P3/P3b），其余 5 业务域原样返回同一引用', () => {
        for (const kind of [
            'task-check-item',
            'task-comment',
            'tag',
            'pomodoro',
            'pomodoro-record'
        ] as const) {
            const useCase = fakeUseCase()
            // 引用相同 = 未套闸门（若某域被重新加回闸门表 ⇒ 返回 Proxy ⇒ 本断言转红）
            expect(webBinding.decorateUseCase!(useCase, kind)).toBe(useCase)
        }
        const userCase = fakeUseCase()
        expect(webBinding.decorateUseCase!(userCase, 'user')).not.toBe(userCase)
        // 任务域：仅叠加 P3 归档守卫（Proxy ⇒ 引用不同），离线闸门仍未套（下方 W1 行为断言）
        const taskCase = fakeUseCase()
        expect(webBinding.decorateUseCase!(taskCase, 'task')).not.toBe(taskCase)
        // 项目域（P3b / ADR §7.2）：仅叠加归档守卫（Proxy ⇒ 引用不同），离线闸门未套（下方 W3 行为断言）
        const projectCase = fakeUseCase()
        expect(webBinding.decorateUseCase!(projectCase, 'project')).not.toBe(projectCase)
    })

    it('web binding 提供 decorateUseCase；未切本地优先的域（身份域 W5）离线写被拦截、原方法零调用', async () => {
        expect(typeof webBinding.decorateUseCase).toBe('function')

        const useCase = fakeUseCase()
        // user 属 W5（身份域，ADR §2.6 明确不切）⇒ 仍受闸门约束；updateNickname 返回 error 形态
        const guarded = webBinding.decorateUseCase!(useCase, 'user')

        setOffline(true)
        await expect(guarded.updateNickname({ nickname: 'n' })).resolves.toBe(
            OFFLINE_READONLY_ERROR
        )
        expect(useCase.updateNickname).not.toHaveBeenCalled()

        setOffline(false)
        await expect(guarded.updateNickname({ nickname: 'n' })).resolves.toBeNull()
        expect(useCase.updateNickname).toHaveBeenCalledTimes(1)
    })

    it('W1 任务域已切本地优先 ⇒ 撤该域闸门（离线写透传、不返回 OFFLINE_READONLY）', async () => {
        const useCase = fakeUseCase()
        const decorated = webBinding.decorateUseCase!(useCase, 'task')

        setOffline(true)
        await expect(decorated.delete('t-1')).resolves.toBeNull()
        expect(useCase.delete).toHaveBeenCalledTimes(1)
    })

    it('W2 子实体域（检查项/评论）已切本地优先 ⇒ 撤闸门（离线写透传）', async () => {
        for (const kind of ['task-check-item', 'task-comment'] as const) {
            const useCase = fakeUseCase()
            const decorated = webBinding.decorateUseCase!(useCase, kind)

            setOffline(true)
            await expect(decorated.delete('e-1')).resolves.toBeNull()
            expect(useCase.delete).toHaveBeenCalledTimes(1)
        }
    })

    it('W3 容器域（清单/标签）已切本地优先 ⇒ 撤闸门（离线写透传）', async () => {
        for (const kind of ['project', 'tag'] as const) {
            const useCase = fakeUseCase()
            const decorated = webBinding.decorateUseCase!(useCase, kind)

            setOffline(true)
            await expect(decorated.delete('c-1')).resolves.toBeNull()
            expect(useCase.delete).toHaveBeenCalledTimes(1)
        }
    })

    it('W4 番茄域（番茄/番茄记录）已切本地优先 ⇒ 撤闸门（离线写透传）', async () => {
        // 用各域**代表性写方法**（pomodoro.update / pomodoro-record.createRecord）
        // ⇒ 若该域未从闸门豁免，离线必被拦截；透传即证明豁免生效（非空转）
        const pomodoro = fakeUseCase()
        const decoratedPomodoro = webBinding.decorateUseCase!(pomodoro, 'pomodoro')
        setOffline(true)
        await expect(decoratedPomodoro.update('p-1')).resolves.toBeNull()
        expect(pomodoro.update).toHaveBeenCalledTimes(1)

        const record = fakeUseCase()
        const decoratedRecord = webBinding.decorateUseCase!(record, 'pomodoro-record')
        await expect(decoratedRecord.createRecord({})).resolves.toEqual([null, null])
        expect(record.createRecord).toHaveBeenCalledTimes(1)
    })

    it('绑定级断言（ADR §2.5 正向）：web 已切域仓储 = 本地仓储', () => {
        expect(webBinding.createTaskRepository()).toBeInstanceOf(LocalTaskRepoImpl)
        expect(webBinding.createTaskCheckItemRepository()).toBeInstanceOf(
            LocalTaskCheckItemRepoImpl
        )
        expect(webBinding.createTaskCommentRepository()).toBeInstanceOf(LocalTaskCommentRepoImpl)
        expect(webBinding.createProjectRepository()).toBeInstanceOf(LocalProjectRepoImpl)
        expect(webBinding.createTagRepository()).toBeInstanceOf(LocalTagRepoImpl)
        expect(webBinding.createPomodoroRepository()).toBeInstanceOf(LocalPomodoroRepoImpl)
        expect(webBinding.createPomodoroRecordRepository()).toBeInstanceOf(
            LocalPomodoroRecordRepoImpl
        )
    })

    it('负向：desktop **不套离线只读闸门**（P3/P3b 后仅套归档守卫）⇒ 离线写仍透传；任务/项目域已注入归档守卫', async () => {
        expect(typeof desktopBinding.decorateUseCase).toBe('function')
        const useCase = fakeUseCase()
        const decorated = desktopBinding.decorateUseCase!(useCase, 'user')
        // 身份域在 desktop 无装饰 ⇒ 同一引用；离线写不被拦截
        expect(decorated).toBe(useCase)
        setOffline(true)
        await expect(decorated.updateNickname({ nickname: 'n' })).resolves.toBeNull()
        expect(useCase.updateNickname).toHaveBeenCalledTimes(1)
        // P3：任务域两端一致 ⇒ desktop 亦注入归档守卫（Proxy ⇒ 引用不同）
        const taskCase = fakeUseCase()
        expect(desktopBinding.decorateUseCase!(taskCase, 'task')).not.toBe(taskCase)
        // P3b：项目域亦两端一致 ⇒ desktop 注入项目归档守卫
        const projectCase = fakeUseCase()
        expect(desktopBinding.decorateUseCase!(projectCase, 'project')).not.toBe(projectCase)
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