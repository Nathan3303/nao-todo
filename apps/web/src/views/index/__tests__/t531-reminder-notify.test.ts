// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import { DEFAULT_REMINDER_SETTINGS } from '@nao-todo/shared/reminder'
import type { ReminderSettings, TaskReminderEvent } from '@nao-todo/shared/reminder'
import { createClaimLedger, createReminderEngine } from '@nao-todo/shared/reminder'
import type { ReminderTask } from '@nao-todo/shared/reminder'
import { t } from '@nao-todo/shared/locales'
import { createReminderNotify } from '../reminder-notify'

/**
 * T531 · 通知/弹窗装配适配层（AC2 通知开关 / AC3 声音 / AC8 正文 / AC10 永不抛 · 红基线）
 *
 * 契约（RD 按此实现，`apps/web/src/views/index/reminder-notify.ts`）：
 * 现状 `notify` 是 `index-view.ts` 里的内联回调（弹窗 + `sendNotification`），无法单测 ⇒
 * 抽出薄适配层（零新依赖，仅把内联逻辑搬出来）：
 *
 * ```ts
 * export type ReminderNotifyDeps = {
 *     openDialog(event: TaskReminderEvent): void
 *     send(title: string, body: string, options: { silent?: boolean; onClick?: () => void }): unknown
 *     readSettings(): ReminderSettings                  // 本地身份级单键读取，永不抛（适配层兜底）
 *     resolveProjectName?(projectId: string): string | null | undefined
 *     onOpenTask?(taskId: string): void
 * }
 * export const createReminderNotify: (deps: ReminderNotifyDeps) => (event: TaskReminderEvent) => void
 * ```
 *
 * 口径（PRD §五 R5/R6 · §七 AC2/AC3/AC8/AC10）：
 * - **应用内弹窗恒开**（通知开关只关系统通知）；先开弹窗、再发通知（通知失败不影响弹窗）；
 * - `silent = !settings.sound`；标题 = 动作语义「任务提醒」，正文 = `任务名 · 清单名`
 *   （清单名解析不到 ⇒ 只有任务名，不留悬空分隔符）；
 * - 点击系统通知 ⇒ `onOpenTask(taskId)`（聚焦交给 `sendNotification` 自身）；
 * - **永不抛**：`readSettings` / `send` / `resolveProjectName` 任一抛错都降级，
 *   保证引擎侧 `notify` 不 reject（否则 claim 已落、consume 未执行 ⇒ 该条永久丢）。
 * - **C2（T530 终签）**：降级必须在通知适配层**内部**完成（try/catch + 「未送达」标记），
 *   **禁止**让异常冒到引擎走「notify 抛错 ⇒ 不 consume」分支；正确终态是
 *   「弹窗正常 + 该条不丢不重复 + 引擎仍完成 consume」。
 *
 * @see docs/prds/2026-10-24-reminder-settings.md §七 AC2/AC3/AC8/AC10
 */

const event: TaskReminderEvent = {
    taskId: 't1',
    taskName: '买菜',
    description: '别忘了买鸡蛋',
    projectId: 'p1',
    remindAt: new Date(2026, 9, 24, 22, 10).toISOString()
}

type SetupOptions = {
    settings?: ReminderSettings
    settingsThrows?: boolean
    sendThrows?: boolean
    sendResult?: boolean
    projectName?: string | null
    projectNameThrows?: boolean
}

const setup = (options: SetupOptions = {}) => {
    const openDialog = vi.fn()
    const send = vi.fn(() => {
        if (options.sendThrows) throw new TypeError('Illegal constructor')
        return options.sendResult ?? true
    })
    const readSettings = vi.fn(() => {
        if (options.settingsThrows) throw new Error('storage unavailable')
        return options.settings ?? DEFAULT_REMINDER_SETTINGS
    })
    const resolveProjectName = vi.fn(() => {
        if (options.projectNameThrows) throw new Error('project store broken')
        return options.projectName ?? null
    })
    const onOpenTask = vi.fn()

    const notify = createReminderNotify({
        openDialog,
        send,
        readSettings,
        resolveProjectName,
        onOpenTask
    })

    return { notify, openDialog, send, readSettings, resolveProjectName, onOpenTask }
}

describe('T531 · AC2 通知开关只关系统通知', () => {
    it('AC2 notify=true ⇒ 应用内弹窗 + 系统通知各 1 次', () => {
        const { notify, openDialog, send } = setup()

        notify(event)

        expect(openDialog).toHaveBeenCalledTimes(1)
        expect(openDialog).toHaveBeenCalledWith(event)
        expect(send).toHaveBeenCalledTimes(1)
    })

    it('AC2 notify=false ⇒ **无系统通知**，应用内弹窗照常（引擎判定与去重不受影响）', () => {
        const { notify, openDialog, send } = setup({
            settings: { ...DEFAULT_REMINDER_SETTINGS, notify: false }
        })

        notify(event)

        expect(openDialog).toHaveBeenCalledTimes(1)
        expect(send).not.toHaveBeenCalled()
    })

    it('AC2 弹窗先于通知（通知失败不影响弹窗已展示的事实）', () => {
        const order: string[] = []
        const notify = createReminderNotify({
            openDialog: () => order.push('dialog'),
            send: () => order.push('notify'),
            readSettings: () => DEFAULT_REMINDER_SETTINGS
        })

        notify(event)

        expect(order).toEqual(['dialog', 'notify'])
    })
})

describe('T531 · AC3 声音开关映射 silent', () => {
    it('AC3 sound=false ⇒ silent: true', () => {
        const { notify, send } = setup({
            settings: { ...DEFAULT_REMINDER_SETTINGS, sound: false }
        })

        notify(event)

        expect(send.mock.calls[0]?.[2]).toMatchObject({ silent: true })
    })

    it('AC3 sound=true ⇒ silent: false（系统通知自带声音）', () => {
        const { notify, send } = setup()

        notify(event)

        expect(send.mock.calls[0]?.[2]).toMatchObject({ silent: false })
    })
})

describe('T531 · AC8 通知正文（任务名 · 清单名）', () => {
    it('AC8 标题 = 动作语义、正文 = `任务名 · 清单名`', () => {
        const { notify, send } = setup({ projectName: '工作' })

        notify(event)

        expect(send.mock.calls[0]?.[0]).toBe(t('task.reminder.title'))
        expect(send.mock.calls[0]?.[1]).toBe('买菜 · 工作')
    })

    it('AC8 清单名解析不到（返回 null）⇒ 只用任务名、不留悬空分隔符', () => {
        const { notify, send } = setup({ projectName: null })

        notify(event)

        expect(send.mock.calls[0]?.[1]).toBe('买菜')
    })

    it('AC8 清单名解析抛错 ⇒ 降级为任务名，不抛', () => {
        const { notify, send } = setup({ projectNameThrows: true })

        expect(() => notify(event)).not.toThrow()
        expect(send.mock.calls[0]?.[1]).toBe('买菜')
    })

    it('AC8 未注入 resolveProjectName ⇒ 只用任务名（装配缺失时防御）', () => {
        const send = vi.fn(() => true)
        const notify = createReminderNotify({
            openDialog: () => undefined,
            send,
            readSettings: () => DEFAULT_REMINDER_SETTINGS
        })

        expect(() => notify(event)).not.toThrow()
        expect(send.mock.calls[0]?.[1]).toBe('买菜')
    })

    it('AC8 点击系统通知 ⇒ onOpenTask(taskId)（聚焦由 sendNotification 负责）', () => {
        const { notify, send, onOpenTask } = setup()

        notify(event)
        const options = send.mock.calls[0]?.[2] as { onClick?: () => void }
        options.onClick?.()

        expect(onOpenTask).toHaveBeenCalledTimes(1)
        expect(onOpenTask).toHaveBeenCalledWith('t1')
    })

    it('AC8 未注入 onOpenTask ⇒ 点击不抛错', () => {
        const send = vi.fn(() => true)
        const notify = createReminderNotify({
            openDialog: () => undefined,
            send,
            readSettings: () => DEFAULT_REMINDER_SETTINGS
        })

        notify(event)
        const options = send.mock.calls[0]?.[2] as { onClick?: () => void }

        expect(() => options.onClick?.()).not.toThrow()
    })
})

describe('T531 · AC10 适配层永不抛（否则引擎 claim 已落、consume 未执行）', () => {
    it('AC10 send 抛错 ⇒ notify 不抛，弹窗照常', () => {
        const { notify, openDialog } = setup({ sendThrows: true })

        expect(() => notify(event)).not.toThrow()
        expect(openDialog).toHaveBeenCalledTimes(1)
    })

    it('AC10 send 返回 false（无 API / 未授权 / 构造抛错）⇒ 不抛、弹窗照常', () => {
        const { notify, openDialog, send } = setup({ sendResult: false })

        expect(() => notify(event)).not.toThrow()
        expect(send).toHaveBeenCalledTimes(1)
        expect(openDialog).toHaveBeenCalledTimes(1)
    })

    it('AC10 readSettings 抛错 ⇒ fail-open（按默认设置发通知），不抛', () => {
        const { notify, send } = setup({ settingsThrows: true })

        expect(() => notify(event)).not.toThrow()
        expect(send).toHaveBeenCalledTimes(1)
        expect(send.mock.calls[0]?.[2]).toMatchObject({ silent: false })
    })

    it('AC10 notify 同步返回（引擎可 await/不 await，均无需处理 rejection）', () => {
        const { notify } = setup({ sendThrows: true })

        expect(notify(event)).toBeUndefined()
    })
})

describe('T531 · C2 与引擎串联（降级不得冒到引擎）', () => {
    const NOW = new Date(2026, 9, 24, 8, 30).getTime()

    const makeTask = (remindAt: string): ReminderTask => ({
        id: 't1',
        name: '买菜',
        projectId: 'p1',
        remindAt,
        remindRepeat: 'daily',
        remindTime: '08:29',
        remindWeekdays: null,
        endAt: null,
        state: 'todo',
        deletedAt: null,
        archivedAt: null,
        givenUpAt: null,
        parentTaskId: null
    })

    it('C2 构造抛错被适配层吞掉 ⇒ 引擎仍完成 consume，该条不丢不重复', async () => {
        const firedAt = new Date(NOW - 60_000).toISOString()
        const task = makeTask(firedAt)
        const openDialog = vi.fn()
        const consumed: Array<string | null> = []

        const notify = createReminderNotify({
            openDialog,
            send: () => {
                throw new TypeError('Illegal constructor')
            },
            readSettings: () => DEFAULT_REMINDER_SETTINGS
        })

        const engine = createReminderEngine({
            listCandidates: async () => [task],
            now: () => NOW,
            ledger: createClaimLedger(),
            notify,
            consume: (taskId, nextRemindAt) => {
                consumed.push(nextRemindAt)
                if (taskId === task.id) task.remindAt = nextRemindAt
            }
        })

        engine.start()
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()

        // 应用内弹窗正常 + 引擎完成 consume（← C2 核心：异常未冒到引擎）
        expect(openDialog).toHaveBeenCalledTimes(1)
        expect(consumed).toHaveLength(1)
        expect(consumed[0]).not.toBeNull() // 重复提醒已推进

        // 再扫一轮：该条不重复（键已变且已在账本）
        await engine.rescan()
        await Promise.resolve()
        expect(openDialog).toHaveBeenCalledTimes(1)
        expect(consumed).toHaveLength(1)
    })

    it('C2 send 返回「未送达」标记（false）⇒ 同样不阻断引擎 consume', async () => {
        const firedAt = new Date(NOW - 60_000).toISOString()
        const task = makeTask(firedAt)
        const openDialog = vi.fn()
        const consume = vi.fn((taskId: string, next: string | null) => {
            if (taskId === task.id) task.remindAt = next
        })

        const notify = createReminderNotify({
            openDialog,
            send: () => false,
            readSettings: () => DEFAULT_REMINDER_SETTINGS
        })

        createReminderEngine({
            listCandidates: async () => [task],
            now: () => NOW,
            ledger: createClaimLedger(),
            notify,
            consume
        }).start()

        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()

        expect(openDialog).toHaveBeenCalledTimes(1)
        expect(consume).toHaveBeenCalledTimes(1)
    })
})