// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import { NueMessage } from 'nue-ui'
import { messages } from '@nao-todo/shared/locales/messages'
import { OFFLINE_READONLY_ERROR } from '../../offline/write-gate'

/**
 * T178b 用例先行 · 红基线（清单归档 —— 面8 归档态只读守卫，行为级）
 *
 * 真源：`docs/adr/2026-09-24-project-archive.md` §15.3（`T175b` 冻结命名）：
 *   - 新文件 **`packages/presentation/task/archive-gate.ts`**（**不复用** `offline/write-gate.ts`
 *     ⇒ 不混淆离线语义；仅复用其类型 `WriteMethodMap` / `WriteReturnShape`）；
 *   - 错误码 **`ARCHIVED_READONLY_ERROR = 'ARCHIVED_READONLY'`**；
 *   - 守卫 **`withArchivedReadOnlyGuard(useCase, writeMethods, { allow?, isArchivedTarget })`**：
 *     判据 = `isArchivedTarget(method, args)` 为真；**`allow` 默认 `['unarchive']`（唯一例外）**；
 *     命中 ⇒ 按原方法形态返回 `ARCHIVED_READONLY`（`'error'` / `'tuple'`）+ 可见提示；
 *     非归档目标 ⇒ 原样执行；读方法 ⇒ 透传。
 *
 * ⚠️ 红基线：`archive-gate.ts` 尚未落地 ⇒ 本文件应 **红**。不改任何实现文件。
 *    （模块缺席由「glob 加载 + 显式失败」承载，保证 `vp check` 类型 0 error ⇒ 红只落在断言。）
 */

const ARCHIVE_GATE_PATH = '/packages/presentation/task/archive-gate.ts'
const archiveGateModules = import.meta.glob('/packages/presentation/task/archive-gate.ts')

type WriteShape = 'error' | 'tuple'

/** ADR §15.3 冻结的守卫形态（实现落地前以窄类型承接） */
type ArchiveGateModule = {
    ARCHIVED_READONLY_ERROR: string
    withArchivedReadOnlyGuard: <T extends object>(
        useCase: T,
        writeMethods: Record<string, WriteShape>,
        options: {
            allow?: readonly string[]
            isArchivedTarget: (method: string, args: unknown[]) => Promise<boolean>
        }
    ) => T
}

const loadArchiveGate = async (): Promise<ArchiveGateModule> => {
    const loader = archiveGateModules[ARCHIVE_GATE_PATH]
    expect(
        loader,
        `ADR §15.3 要求新增 ${ARCHIVE_GATE_PATH}（导出 ARCHIVED_READONLY_ERROR + withArchivedReadOnlyGuard）`
    ).toBeTypeOf('function')
    return (await loader!()) as unknown as ArchiveGateModule
}

type FakeUseCase = {
    update: (id: string, patch?: unknown) => Promise<unknown>
    create: (name: string) => Promise<[unknown, unknown]>
    unarchive: (id: string) => Promise<unknown>
    get: (id: string) => Promise<unknown>
}

const WRITE_METHODS: Record<string, WriteShape> = {
    update: 'error',
    create: 'tuple',
    unarchive: 'error'
}

const makeUseCase = () => {
    const spies = {
        update: vi.fn(async () => null as unknown),
        create: vi.fn(async () => [{ id: 'created' }, null] as [unknown, unknown]),
        unarchive: vi.fn(async () => null as unknown),
        get: vi.fn(async () => ({ id: 'read-task' }) as unknown)
    }
    return { useCase: spies as unknown as FakeUseCase, spies }
}

/** 判据替身：仅 `archived-1` 视为归档目标 */
const makeIsArchivedTarget = () =>
    vi.fn(async (_method: string, args: unknown[]) => args[0] === 'archived-1')

const dict = (locale: 'zh-CN' | 'en-US'): Record<string, string> =>
    messages[locale] as unknown as Record<string, string>

describe('T178b · 面8 withArchivedReadOnlyGuard（ADR §15.3，行为级）', () => {
    it('自检：glob 可解析既有模块（防「模式不匹配 ⇒ 恒红」假象）', () => {
        const existing = import.meta.glob('/packages/presentation/task/handlers/task.ts')
        expect(Object.keys(existing)).toContain('/packages/presentation/task/handlers/task.ts')
    })

    it('归档目标写用例 ⇒ ARCHIVED_READONLY（原方法零调用）+ 可见提示 + 不复用离线错误码', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const gate = await loadArchiveGate()
        const { useCase, spies } = makeUseCase()
        const guarded = gate.withArchivedReadOnlyGuard(useCase, WRITE_METHODS, {
            isArchivedTarget: makeIsArchivedTarget()
        })

        await expect(guarded.update('archived-1')).resolves.toBe(gate.ARCHIVED_READONLY_ERROR)

        expect(gate.ARCHIVED_READONLY_ERROR).toBe('ARCHIVED_READONLY')
        expect(gate.ARCHIVED_READONLY_ERROR).not.toBe(OFFLINE_READONLY_ERROR)
        expect(spies.update).not.toHaveBeenCalled()
        expect(warn).toHaveBeenCalled()
    })

    it("返回形态与原方法一致：'tuple' ⇒ [null, ARCHIVED_READONLY]", async () => {
        const gate = await loadArchiveGate()
        const { useCase, spies } = makeUseCase()
        const guarded = gate.withArchivedReadOnlyGuard(useCase, WRITE_METHODS, {
            isArchivedTarget: makeIsArchivedTarget()
        })

        await expect(guarded.create('新任务')).resolves.toEqual([
            null,
            gate.ARCHIVED_READONLY_ERROR
        ])
        expect(spies.create).not.toHaveBeenCalled()
    })

    it("allow 默认 ['unarchive'] ⇒ unarchive 是唯一例外（放行原方法）", async () => {
        const gate = await loadArchiveGate()
        const { useCase, spies } = makeUseCase()
        const guarded = gate.withArchivedReadOnlyGuard(useCase, WRITE_METHODS, {
            isArchivedTarget: makeIsArchivedTarget()
        })

        await expect(guarded.unarchive('archived-1')).resolves.toBeNull()
        expect(spies.unarchive).toHaveBeenCalledWith('archived-1')
        // 同一判据下 update 仍被拦截
        await expect(guarded.update('archived-1')).resolves.toBe(gate.ARCHIVED_READONLY_ERROR)
    })

    it('options.allow 可显式覆盖例外集（allow=[update] ⇒ unarchive 转为拦截）', async () => {
        const gate = await loadArchiveGate()
        const { useCase, spies } = makeUseCase()
        const guarded = gate.withArchivedReadOnlyGuard(useCase, WRITE_METHODS, {
            allow: ['update'],
            isArchivedTarget: makeIsArchivedTarget()
        })

        await expect(guarded.update('archived-1')).resolves.toBeNull()
        await expect(guarded.unarchive('archived-1')).resolves.toBe(gate.ARCHIVED_READONLY_ERROR)
        expect(spies.update).toHaveBeenCalledTimes(1)
        expect(spies.unarchive).not.toHaveBeenCalled()
    })

    it('非归档目标 ⇒ 写方法正常执行（判据驱动，不误伤）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const gate = await loadArchiveGate()
        const { useCase, spies } = makeUseCase()
        const guarded = gate.withArchivedReadOnlyGuard(useCase, WRITE_METHODS, {
            isArchivedTarget: makeIsArchivedTarget()
        })

        await expect(guarded.update('active-1')).resolves.toBeNull()
        await expect(guarded.create('新任务')).resolves.toEqual([{ id: 'created' }, null])
        expect(spies.update).toHaveBeenCalledWith('active-1')
        expect(spies.create).toHaveBeenCalledWith('新任务')
        expect(warn).not.toHaveBeenCalled()
    })

    it('读方法在归档目标上照常透传', async () => {
        const gate = await loadArchiveGate()
        const { useCase, spies } = makeUseCase()
        const guarded = gate.withArchivedReadOnlyGuard(useCase, WRITE_METHODS, {
            isArchivedTarget: makeIsArchivedTarget()
        })

        await expect(guarded.get('archived-1')).resolves.toEqual({ id: 'read-task' })
        expect(spies.get).toHaveBeenCalledWith('archived-1')
    })
})

describe('T178b · 面8 i18n 只读提示键（ADR §15.3 冻结名）', () => {
    it('中/英均存在非空文案，且与离线只读提示区分：archive.readOnlyHint', () => {
        expect(dict('zh-CN')['archive.readOnlyHint'] ?? '').not.toBe('')
        expect(dict('en-US')['archive.readOnlyHint'] ?? '').not.toBe('')
        expect(dict('zh-CN')['archive.readOnlyHint']).not.toBe(
            dict('zh-CN')['offline.readOnlyHint']
        )
    })
})