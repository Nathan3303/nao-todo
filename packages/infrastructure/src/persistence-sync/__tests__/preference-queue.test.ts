// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { localDatabase } from '../../persistence-local/db/local-database'
import { localSession } from '../../persistence-local/session/local-session'
import { syncTracker } from '../sync-tracker'
import {
    clearPreferenceQueue,
    duePreferenceItems,
    enqueuePreference,
    loadPreferenceQueue,
    markPreferenceItemFailed,
    preferenceQueueId,
    removePreferenceItem
} from '../preference-queue'

/**
 * TASK-26 / M6 —— 偏好队列（独立于业务同步引擎）
 *
 * **验收判据**（ADR-r2 §D-1b / PS-1 / PS-10 / qa PSYNC-INV-01）：
 * - 存储 = `meta` 单记录 `${userId}:preference-queue`（不 bump Dexie version、不加索引）；
 * - 队列项**按单位去重**（`userConfig` 每用户一条 / `projectPreference` 按 `projectId` 一条）；
 * - **不入 `syncQueue`**、**不产生业务 `markDirty`**、**不计入 `pendingCount`**；
 * - 失败分类同 SHELL-06（业务 ⇒ 指数退避；网络 ⇒ 暂停不计数；凭证 ⇒ 标记）。
 */

const USER_ID = 'u-1'

beforeEach(async () => {
    await localDatabase.meta.clear()
    await localDatabase.syncQueue.clear()
    localSession.setCurrentUserId(USER_ID)
})

describe('偏好队列 - 存储与去重（M6）', () => {
    it('存储为 meta 单记录 `${userId}:preference-queue`', async () => {
        await enqueuePreference(USER_ID, { kind: 'userConfig' })
        const record = await localDatabase.meta.get(preferenceQueueId(USER_ID))
        expect(record?.preferenceQueue).toHaveLength(1)
    })

    it('projectPreference 按 projectId 去重（多次改合并为最新）', async () => {
        await enqueuePreference(USER_ID, { kind: 'projectPreference', projectId: 'p-1' })
        await enqueuePreference(USER_ID, { kind: 'projectPreference', projectId: 'p-1' })
        await enqueuePreference(USER_ID, { kind: 'projectPreference', projectId: 'p-2' })

        const items = await loadPreferenceQueue(USER_ID)
        expect(items).toHaveLength(2)
        expect(
            items.map((item) => item.projectId).sort((a, b) => String(a).localeCompare(String(b)))
        ).toEqual(['p-1', 'p-2'])
    })

    it('userConfig 每用户仅一条', async () => {
        await enqueuePreference(USER_ID, { kind: 'userConfig' })
        await enqueuePreference(USER_ID, { kind: 'userConfig' })
        expect(await loadPreferenceQueue(USER_ID)).toHaveLength(1)
    })

    it('出队 / 清空', async () => {
        await enqueuePreference(USER_ID, { kind: 'projectPreference', projectId: 'p-1' })
        await removePreferenceItem(USER_ID, { kind: 'projectPreference', projectId: 'p-1' })
        expect(await loadPreferenceQueue(USER_ID)).toHaveLength(0)

        await enqueuePreference(USER_ID, { kind: 'userConfig' })
        await clearPreferenceQueue(USER_ID)
        expect(await loadPreferenceQueue(USER_ID)).toHaveLength(0)
    })
})

describe('偏好队列 - 不入业务同步引擎（PS-1 / PS-10 / INV-01）', () => {
    it('偏好入队不写 syncQueue、不 markDirty、countDirty 恒 0', async () => {
        const markDirty = vi.spyOn(syncTracker, 'markDirty')
        await enqueuePreference(USER_ID, { kind: 'userConfig' })
        await enqueuePreference(USER_ID, { kind: 'projectPreference', projectId: 'p-1' })

        expect(await localDatabase.syncQueue.count()).toBe(0)
        expect(await syncTracker.countDirty(USER_ID)).toBe(0)
        expect(markDirty).not.toHaveBeenCalled()
        markDirty.mockRestore()
    })
})

describe('偏好队列 - 失败分类与退避（SHELL-06 C-38/C-39）', () => {
    it('业务类失败 ⇒ 指数退避（attempts+1 + nextAttemptAt）', async () => {
        await enqueuePreference(USER_ID, { kind: 'userConfig' })
        const item = (await loadPreferenceQueue(USER_ID))[0]!
        const nowMs = Date.parse('2026-01-01T00:00:00.000Z')

        await markPreferenceItemFailed(USER_ID, item, 'business', nowMs)

        const [failed] = await loadPreferenceQueue(USER_ID)
        expect(failed?.attempts).toBe(1)
        expect(failed?.lastErrorClass).toBe('business')
        expect(Date.parse(failed?.nextAttemptAt ?? '')).toBe(nowMs + 5000)
        // 退避未到期 ⇒ 不可推送
        expect(duePreferenceItems(await loadPreferenceQueue(USER_ID), nowMs)).toHaveLength(0)
        expect(duePreferenceItems(await loadPreferenceQueue(USER_ID), nowMs + 5000)).toHaveLength(1)
    })

    it('网络类失败 ⇒ 暂停不计数（attempts 不变）', async () => {
        await enqueuePreference(USER_ID, { kind: 'userConfig' })
        const item = (await loadPreferenceQueue(USER_ID))[0]!
        await markPreferenceItemFailed(USER_ID, item, 'network', Date.now())

        const [failed] = await loadPreferenceQueue(USER_ID)
        expect(failed?.attempts).toBeUndefined()
        expect(failed?.nextAttemptAt).toBeUndefined()
        expect(failed?.lastErrorClass).toBe('network')
    })

    it('凭证类失败 ⇒ 标记分类（不静默吞）', async () => {
        await enqueuePreference(USER_ID, { kind: 'projectPreference', projectId: 'p-1' })
        const item = (await loadPreferenceQueue(USER_ID))[0]!
        await markPreferenceItemFailed(USER_ID, item, 'credential', Date.now())
        const [failed] = await loadPreferenceQueue(USER_ID)
        expect(failed?.lastErrorClass).toBe('credential')
    })
})