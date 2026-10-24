// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'
import { NueMessage } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import { collectDueReminders, type TaskReminderEvent } from '@nao-todo/shared/reminder'
import { ARCHIVED_READONLY_ERROR } from '../../../../archive-gate'
import useTaskReminder from '../use-task-reminder'

/**
 * T531 · 弹窗「完成」+ 清单名 / 原定时间（AC7 / AC8 · 红基线）
 *
 * 契约（RD 按此实现，`packages/presentation/task/components/dialogs/reminder/`）：
 *
 * - props 增 `getProjectName?: (projectId: string) => string | null | undefined`（装配层注入，
 *   弹窗**不引 router / 仓储**）与 `now?: () => number`（测试注入时钟）；
 * - composable 返回值增：
 *   - `complete(): Promise<void>` —— 点击「完成」：写任务状态 `state: 'done'`，成功 ⇒ 出队；
 *     失败 ⇒ `NueMessage.error` 提示 + **留在队列**（当前项不变）；
 *   - `completing: Ref<boolean>` —— 防重入（进行中再次点击不得重复写）；
 *   - `currentProjectName: ComputedRef<string>` —— 清单名；解析不到 ⇒ 回退 i18n「清单」文案
 *     （不空白、不露 `projectId`）；
 *   - `currentRemindAtText: ComputedRef<string>` —— 原定提醒时刻（本地墙钟 `HH:mm`）；
 *     事件缺 `remindAt` ⇒ 空串（不渲染该行、不抛）；
 *   - `isLateReminder: ComputedRef<boolean>` / `remindAtLabel: ComputedRef<string>` ——
 *     补弹（触发时刻早于当前 ≥1 分钟）时标注「原定 …」（PRD AC8 / 架构 §5.2）。
 * - 「完成」替代原「跳过本次」（用户 2026-10-24 裁定：跳过与确认等价，已废弃）。
 * - **C5（T530 终签）三类结果**：① 成功 ⇒ 完成 + 出队；② 失败（本地写失败 / 网络）⇒
 *   提示 + **保留队列**；③ 只读（已归档 / 已删除 / 已放弃 / 已被别处完成）⇒ **不写 + 静默出队**
 *   （沿用 T193 只读口径，守卫已本地化提示）。分类真源 = 既有 `isArchivedReadOnlyError`。
 * - **AC13（幂等 / 只读）**：连续点两次只落一次终态、不报错、不重复出队。
 *
 * @see docs/prds/2026-10-24-reminder-settings.md §七 AC7/AC8
 */

const NOW = new Date(2026, 9, 24, 8, 30, 0, 0).getTime()
const isoAt = (ms: number): string => new Date(ms).toISOString()

const makeEvent = (patch: Partial<TaskReminderEvent> = {}): TaskReminderEvent => ({
    taskId: 't1',
    taskName: '买菜',
    projectId: 'p1',
    remindAt: isoAt(NOW - 60_000),
    ...patch
})

type ApiOptions = {
    update?: ReturnType<typeof vi.fn>
    getProjectName?: (projectId: string) => string | null | undefined
    now?: () => number
}

const makeApi = (options: ApiOptions = {}) => {
    const update = options.update ?? vi.fn(async () => null)
    const api = useTaskReminder({
        dialogManager: {} as never,
        taskUseCase: { update, snooze: vi.fn(async () => null) } as never,
        getProjectName: options.getProjectName,
        now: options.now ?? (() => NOW)
    })
    return { api, update }
}

beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
})

describe('T531 · AC7 弹窗「完成」三类结果（C5 重写）', () => {
    it('AC7① 成功 ⇒ 以 state=done 写任务并出队（当前项推进到下一条）', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const { api, update } = makeApi()

        api.enqueue(makeEvent())
        api.enqueue(makeEvent({ taskId: 't2' }))
        await api.complete()

        expect(update).toHaveBeenCalledTimes(1)
        expect(update).toHaveBeenCalledWith('t1', { state: 'done' })
        expect(api.queue.value).toHaveLength(1)
        expect(api.currentEvent.value?.taskId).toBe('t2')
        expect(api.completing.value).toBe(false)
        expect(error).not.toHaveBeenCalled()
    })

    it('AC7② 失败（本地写失败 / 网络）⇒ 提示 + **保留队列**（当前项不变）', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const { api } = makeApi({ update: vi.fn(async () => 'TASK_UPDATE_FAILED') })

        api.enqueue(makeEvent())
        await api.complete()

        expect(error).toHaveBeenCalledTimes(1)
        expect(api.queue.value).toHaveLength(1)
        expect(api.currentEvent.value?.taskId).toBe('t1')
        expect(api.completing.value).toBe(false)
    })

    it('AC7② 离线只读（本地写被闸门拦截）⇒ 视为「失败」：提示 + 保留队列', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const { api } = makeApi({
            update: vi.fn(async () => 'OFFLINE_READONLY: offline')
        })

        api.enqueue(makeEvent())
        await api.complete()

        expect(error).toHaveBeenCalledTimes(1)
        expect(api.queue.value).toHaveLength(1)
    })

    it('AC7③ 只读（任务已被归档 / 删除 / 放弃 / 别处完成）⇒ 不写、静默出队', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const { api } = makeApi({ update: vi.fn(async () => ARCHIVED_READONLY_ERROR) })

        api.enqueue(makeEvent())
        api.enqueue(makeEvent({ taskId: 't2' }))
        await api.complete()

        expect(error).not.toHaveBeenCalled() // 静默（T193 只读口径）
        expect(api.queue.value).toHaveLength(1) // 但**出队**（不再打扰用户）
        expect(api.currentEvent.value?.taskId).toBe('t2')
    })

    it('AC13 连续点两次「完成」⇒ 只落一次终态、不报错、不重复出队', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        let release: (value: null) => void = () => {}
        const pending = new Promise<null>((resolve) => {
            release = resolve
        })
        const update = vi.fn(() => pending)
        const { api } = makeApi({ update })

        api.enqueue(makeEvent())
        api.enqueue(makeEvent({ taskId: 't2' }))
        const first = api.complete()
        const second = api.complete()

        release(null)
        await Promise.all([first, second])

        expect(update).toHaveBeenCalledTimes(1) // 只落一次终态
        expect(api.queue.value).toHaveLength(1) // 只出队一次（t2 仍在队列）
        expect(api.currentEvent.value?.taskId).toBe('t2')
        expect(error).not.toHaveBeenCalled()
    })

    it('AC13 只读出队后再点「完成」⇒ 正常处理下一条（不卡死队列）', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const update = vi
            .fn()
            .mockResolvedValueOnce(ARCHIVED_READONLY_ERROR)
            .mockResolvedValueOnce(null)
        const { api } = makeApi({ update })

        api.enqueue(makeEvent())
        api.enqueue(makeEvent({ taskId: 't2' }))
        await api.complete()
        await api.complete()

        expect(error).not.toHaveBeenCalled()
        expect(update).toHaveBeenCalledTimes(2)
        expect(update).toHaveBeenLastCalledWith('t2', { state: 'done' })
        expect(api.queue.value).toHaveLength(0)
    })

    it('AC7 完成后任务被「已完成」过滤 ⇒ 后续重复提醒自然停止（不再派发）', () => {
        const doneTask = {
            id: 't1',
            name: '买菜',
            projectId: 'p1',
            remindAt: isoAt(NOW - 60_000),
            remindRepeat: 'daily',
            remindTime: '08:29',
            state: 'done',
            deletedAt: null,
            archivedAt: null,
            givenUpAt: null,
            parentTaskId: null,
            endAt: null
        }

        expect(collectDueReminders([doneTask], NOW, () => false)).toEqual([])
    })

    it('AC7 队列为空时点完成 ⇒ 不抛错、不写任务', async () => {
        const { api, update } = makeApi()

        await expect(api.complete()).resolves.toBeUndefined()
        expect(update).not.toHaveBeenCalled()
    })
})

describe('T531 · AC8 清单名与原定提醒时间', () => {
    it('AC8 清单名经注入解析（不引 store / 仓储）', () => {
        const getProjectName = vi.fn(() => '工作')
        const { api } = makeApi({ getProjectName })

        api.enqueue(makeEvent())

        expect(getProjectName).toHaveBeenCalledWith('p1')
        expect(api.currentProjectName.value).toBe('工作')
    })

    it('AC8 清单名解析不到 ⇒ 回退 i18n「清单」文案（不空白、不露 projectId）', () => {
        const { api } = makeApi({ getProjectName: () => null })

        api.enqueue(makeEvent())

        expect(api.currentProjectName.value).toBe(t('dialog.taskReminder.projectFallback'))
        expect(api.currentProjectName.value).not.toContain('p1')
        expect(api.currentProjectName.value.trim()).not.toBe('')
    })

    it('AC8 未注入 getProjectName / 解析抛错 ⇒ 同样回退，不抛', () => {
        const missing = makeApi()
        missing.api.enqueue(makeEvent())
        expect(() => missing.api.currentProjectName.value).not.toThrow()
        expect(missing.api.currentProjectName.value).toBe(t('dialog.taskReminder.projectFallback'))

        const throwing = makeApi({
            getProjectName: () => {
                throw new Error('store broken')
            }
        })
        throwing.api.enqueue(makeEvent())
        expect(() => throwing.api.currentProjectName.value).not.toThrow()
        expect(throwing.api.currentProjectName.value).toBe(t('dialog.taskReminder.projectFallback'))
    })

    it('AC8 原定提醒时刻按本地墙钟展示（HH:mm）', () => {
        const firedAt = new Date(2026, 9, 24, 7, 30, 0, 0).getTime()
        const { api } = makeApi()

        api.enqueue(makeEvent({ remindAt: isoAt(firedAt) }))

        expect(api.currentRemindAtText.value).toContain('07:30')
    })

    it('AC8 补弹（原定时刻远早于当前）⇒ 标注「原定 …」', () => {
        const firedAt = new Date(2026, 9, 24, 7, 30, 0, 0).getTime()
        const { api } = makeApi()

        api.enqueue(makeEvent({ remindAt: isoAt(firedAt) }))

        expect(api.isLateReminder.value).toBe(true)
        expect(api.remindAtLabel.value).toContain(t('dialog.taskReminder.original'))
        expect(api.remindAtLabel.value).toContain('07:30')
    })

    it('AC8 准时（刚到点，<1 分钟）⇒ 不加「原定」前缀', () => {
        const { api } = makeApi()

        api.enqueue(makeEvent({ remindAt: isoAt(NOW) }))

        expect(api.isLateReminder.value).toBe(false)
        expect(api.remindAtLabel.value).not.toContain(t('dialog.taskReminder.original'))
    })

    it('AC8 事件缺 remindAt（旧事件/脏数据）⇒ 时间行为空、不抛', () => {
        const { api } = makeApi()

        api.enqueue({
            taskId: 't1',
            taskName: '买菜',
            projectId: 'p1',
            remindAt: ''
        })

        expect(() => api.currentRemindAtText.value).not.toThrow()
        expect(api.currentRemindAtText.value).toBe('')
        expect(api.isLateReminder.value).toBe(false)
    })
})