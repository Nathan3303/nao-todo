import { describe, expect, it, vi } from 'vite-plus/test'
import type { DesktopUpdateStatus } from '@nao-todo/shared'
import { canTransition, createUpdateStateMachine } from '../state'

/**
 * T736 · 状态机（设计稿 §5 九态 · 单一可订阅）
 *
 * @description 三条硬规则：① `ready` 不可被检查结果覆盖（P5，已下载成果不能被一次检查抹掉）；
 *              ② `failed` 之后仍能再检查 / 再下载（AC11，按钮不得永久禁用）；
 *              ③ `unsupported` 是**前置 gate**（AC4b）：出向白名单为空，⛔ 不参与
 *                 checking / available 流转。
 */

const base: DesktopUpdateStatus = {
    state: 'idle',
    currentVersion: '1.20.3',
    installMode: 'in-place',
    updateAvailable: false
}

const withState = (state: DesktopUpdateStatus['state']): DesktopUpdateStatus => ({
    ...base,
    state,
    updateAvailable: state === 'available' || state === 'downloading' || state === 'ready'
})

describe('状态机（AC1 / AC6 / AC11）', () => {
    it('九态齐全且 `get` 返回当前快照', () => {
        for (const state of [
            'unsupported',
            'idle',
            'checking',
            'available',
            'downloading',
            'ready',
            'up-to-date',
            'just-updated',
            'failed'
        ] as const) {
            const machine = createUpdateStateMachine(withState(state))
            expect(machine.get().state).toBe(state)
        }
    })

    it('正常主路径迁移：idle → checking → available → downloading → ready', () => {
        const machine = createUpdateStateMachine(withState('idle'))
        for (const next of ['checking', 'available', 'downloading', 'ready'] as const) {
            expect(machine.set(withState(next)).state).toBe(next)
        }
    })

    it('P5：ready 期检查结果被拒绝（不得覆盖已下载成果）', () => {
        const machine = createUpdateStateMachine(withState('ready'))
        expect(machine.set(withState('checking')).state).toBe('ready')
        expect(machine.set(withState('available')).state).toBe('ready')
        expect(machine.set(withState('up-to-date')).state).toBe('ready')
    })

    it('AC11：failed 之后仍可再检查 / 再下载（不永久禁用）', () => {
        const machine = createUpdateStateMachine(withState('failed'))
        expect(machine.set(withState('checking')).state).toBe('checking')
        expect(machine.set(withState('failed')).state).toBe('failed')
        expect(machine.set(withState('downloading')).state).toBe('downloading')
    })

    it('AC4b：unsupported 是前置 gate ⇒ 拒绝一切出向迁移（且不通知订阅者）', () => {
        const machine = createUpdateStateMachine(withState('unsupported'))
        const seen = vi.fn()
        machine.subscribe(seen)
        for (const next of [
            'checking',
            'available',
            'downloading',
            'ready',
            'up-to-date',
            'just-updated',
            'failed',
            'idle'
        ] as const) {
            expect(machine.set(withState(next)).state).toBe('unsupported')
            expect(canTransition('unsupported', next)).toBe(false)
        }
        expect(seen).not.toHaveBeenCalled()
    })

    it('非法迁移被拒绝且不通知订阅者', () => {
        const machine = createUpdateStateMachine(withState('idle'))
        const seen = vi.fn()
        machine.subscribe(seen)
        expect(machine.set(withState('ready')).state).toBe('idle')
        expect(seen).not.toHaveBeenCalled()
        expect(canTransition('idle', 'ready')).toBe(false)
    })

    it('订阅可收到每次变更，取消后不再收到', () => {
        const machine = createUpdateStateMachine(withState('idle'))
        const seen: string[] = []
        const unsubscribe = machine.subscribe((status) => seen.push(status.state))
        machine.set(withState('checking'))
        machine.set(withState('available'))
        unsubscribe()
        machine.set(withState('downloading'))
        expect(seen).toEqual(['checking', 'available'])
    })

    it('单个订阅者抛错不得阻断其它订阅者（推播 + 本地日志并存）', () => {
        const machine = createUpdateStateMachine(withState('idle'))
        const healthy = vi.fn()
        machine.subscribe(() => {
            throw new Error('订阅者炸了')
        })
        machine.subscribe(healthy)
        expect(() => machine.set(withState('checking'))).not.toThrow()
        expect(healthy).toHaveBeenCalledTimes(1)
    })
})