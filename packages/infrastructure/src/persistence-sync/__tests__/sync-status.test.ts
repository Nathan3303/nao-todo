import { describe, expect, it } from 'vite-plus/test'
import { SyncStatus } from '../sync-status'

/**
 * SyncStatus 运行（run）级语义
 * @description SHELL-03 ADR D-2（R1/R2/R3）+ C-07/C-11：仅 beginRun 清空、仅 endRun 落定、
 *              保序去重、同阶段同文案只记一次、lastSyncAt 仅成功推进、计数运行结束时刷新。
 * @see docs/adr/2026-09-10-shell-03-offline-availability.md
 */
describe('SyncStatus 运行级语义', () => {
    it('仅 beginRun 清空错误；noteRunError 运行内不清空且同阶段同文案只记一次', () => {
        const status = new SyncStatus()
        status.beginRun('pull')
        status.noteRunError('pull', '拉取失败：网络错误')
        status.noteRunError('pull', '拉取失败：网络错误')
        // 运行内不清空（R1）：尚不能从 state 读到，但累积已去重
        expect(status.endRun().errors).toEqual(['拉取失败：网络错误'])

        // 新运行开始：清空累积（R2）
        status.beginRun('push')
        expect(status.get().errors).toEqual([])
        expect(status.get().errorCount).toBe(0)
        expect(status.get().lastError).toBeNull()
        const clean = status.endRun()
        expect(clean.errors).toEqual([])
        expect(clean.ok).toBe(true)
    })

    it('endRun 落定：首个错误 + errors + errorCount + phase（无错误 phase=null）', () => {
        const status = new SyncStatus()
        status.beginRun('pull')
        status.noteRunError('push', '推送失败：网络错误')
        status.noteRunError('pull', '拉取失败：网络错误')
        const result = status.endRun()
        expect(result.ok).toBe(false)
        // 按执行序首个错误 = 先上报的（push 先上报，故 phase=push；lastError 取该条）
        expect(result.lastError).toBe('推送失败：网络错误')
        expect(result.phase).toBe('push')
        expect(result.errors).toEqual(['推送失败：网络错误', '拉取失败：网络错误'])
        const state = status.get()
        expect(state.syncing).toBe(false)
        expect(state.errorCount).toBe(2)
    })

    it('C-11：仅无错误运行推进 lastSyncAt（失败不推进、也不覆盖上次成功时间）', () => {
        const status = new SyncStatus()
        status.beginRun('pull')
        status.noteRunError('pull', '拉取失败：网络错误')
        status.endRun()
        expect(status.get().lastSyncAt).toBeNull()

        status.beginRun('pull')
        const ok = status.endRun()
        expect(ok.ok).toBe(true)
        expect(ok.phase).toBeNull()
        const successAt = status.get().lastSyncAt
        expect(successAt).toBeTruthy()

        status.beginRun('push')
        status.noteRunError('push', '推送失败：网络错误')
        status.endRun()
        expect(status.get().lastSyncAt).toBe(successAt)
    })

    it('endRun 可选写入运行结束计数；get() 返回 errors 副本（外部改不动内部）', () => {
        const status = new SyncStatus()
        status.beginRun('push')
        status.noteRunError('push', '推送失败：部分数据未确认')
        status.endRun({ pendingCount: 3, failedCount: 2 })
        const state = status.get()
        expect(state.pendingCount).toBe(3)
        expect(state.failedCount).toBe(2)
        state.errors.push('外部篡改')
        expect(status.get().errors).toEqual(['推送失败：部分数据未确认'])
    })

    it('syncing 生命周期：beginRun=true，endRun=false', () => {
        const status = new SyncStatus()
        expect(status.get().syncing).toBe(false)
        status.beginRun('pull')
        expect(status.get().syncing).toBe(true)
        status.endRun()
        expect(status.get().syncing).toBe(false)
    })
})