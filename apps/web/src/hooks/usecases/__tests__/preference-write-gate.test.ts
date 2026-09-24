// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { NueMessage } from 'nue-ui'
import {
    OFFLINE_READONLY_ERROR,
    USER_WRITE_METHODS,
    resetReadOnlyForTest,
    setOffline
} from '@nao-todo/presentation/offline'
import type { BuiltInProjectPreferenceViewObject } from '@nao-todo/domain-built-in-project'
import { useBuiltInProjectUseCase } from '../use-built-in-project-usecase'
import { useCaseBinding as webBinding } from '../binding'

/**
 * TASK-26 PS-2a —— 偏好写入口移出 web 离线写闸门（AC5 关键不变量 ⭐）
 *
 * **验收判据**（PM [T132] §一.3 / ADR r2 §D-1 / PS-2a）：
 * - `saveProjectPreference` / `updateUserConfig` **必须移出** web 离线写闸门清单；
 * - 离线调用**不被拦截**、**不返回** `OFFLINE_READONLY`、**不弹**只读提示；
 * - 内建 `savePreference` **本就不在**清单 ⇒ 保持不在；
 * - **业务数据面实质不变**（负向）：身份域写仍被拦截（C-59 作用域收窄，非放宽）。
 *
 * **阶段二 2A M6（ADR §5 M6）**：业务 7 域全部切本地优先 ⇒ 闸门表收敛为仅身份域 `user`；
 * 清单域（`project`）不再经 binding 套闸门，**离线写透传**（比原「不在清单」更强）。
 */

type ProjectFake = {
    saveProjectPreference: (projectId: string, viewObject: unknown) => Promise<unknown>
}
type UserFake = { updateUserConfig: (viewObject: unknown) => Promise<unknown> }
type UserWriteFake = { updateNickname: (viewObject: unknown) => Promise<unknown> }

beforeEach(() => {
    resetReadOnlyForTest()
})

afterEach(() => {
    resetReadOnlyForTest()
    vi.restoreAllMocks()
})

describe('PS-2a 偏好写入口移出离线写闸门', () => {
    it('静态清单：saveProjectPreference 不在身份域闸门表（业务域已整体不套闸门）', () => {
        expect(USER_WRITE_METHODS.saveProjectPreference).toBeUndefined()
    })

    it('静态清单：updateUserConfig 不在 USER_WRITE_METHODS', () => {
        expect(USER_WRITE_METHODS.updateUserConfig).toBeUndefined()
    })

    it('行为：离线调用 saveProjectPreference 透传（不拦截 / 不返回 OFFLINE_READONLY / 不弹提示）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const useCase: ProjectFake = { saveProjectPreference: vi.fn(async () => null) }
        // 阶段二 2A：清单域整体切本地 ⇒ binding 对 `project` 不套闸门，离线直接透传（非空转）
        const decorated = webBinding.decorateUseCase!(useCase, 'project')

        setOffline(true)
        await expect(decorated.saveProjectPreference('p-1', {})).resolves.toBeNull()
        expect(useCase.saveProjectPreference).toHaveBeenCalledTimes(1)
        expect(warn).not.toHaveBeenCalled()
    })

    it('行为：离线调用 updateUserConfig 透传（不拦截 / 不返回 OFFLINE_READONLY）', async () => {
        const useCase: UserFake = { updateUserConfig: vi.fn(async () => null) }
        const guarded = webBinding.decorateUseCase!(useCase, 'user')

        setOffline(true)
        await expect(guarded.updateUserConfig({ appearance: 'dark' })).resolves.toBeNull()
        expect(useCase.updateUserConfig).toHaveBeenCalledTimes(1)
    })
})

describe('PS-2a 负向：业务面闸门不因收窄而放宽（回归，预期绿）', () => {
    it('离线身份域写仍被拦截 + 稳定码 OFFLINE_READONLY + 原方法零调用', async () => {
        // 身份域 W5（ADR §2.6 明确不切、仍远端直连）；业务 7 域 W1–W4 已切 ⇒ 不再受闸门约束
        const useCase: UserWriteFake = { updateNickname: vi.fn(async () => null) }
        const guarded = webBinding.decorateUseCase!(useCase, 'user')

        setOffline(true)
        await expect(guarded.updateNickname({ nickname: 'n' })).resolves.toBe(
            OFFLINE_READONLY_ERROR
        )
        expect(useCase.updateNickname).not.toHaveBeenCalled()
    })
})

describe('PS-2a 内建 savePreference 不在闸门（现状已绿，防回归）', () => {
    it('离线调用内建 savePreference 仍写本地 localStorage', () => {
        localStorage.clear()
        const useCase = useBuiltInProjectUseCase({} as never)
        const pref: BuiltInProjectPreferenceViewObject = {
            projectId: 'all',
            userId: 'u@example.com',
            viewType: 'kanban',
            getTasksOptions: {},
            columns: {} as never
        }

        setOffline(true)
        const err = useCase.savePreference('u@example.com', 'all', pref)

        expect(err).toBeNull()
        expect(localStorage.getItem('u@example.com/all')).toBeTruthy()
    })
})