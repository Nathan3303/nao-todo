// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Requester } from '@nao-todo/shared/requester'
import { getRequesterImpl } from '@nao-todo/shared/requester'
import { ProjectPreferenceEntity } from '@nao-todo/domain-project'
import { JsonStringValueObject } from '@nao-todo/shared/valueobjects/json-string'
import { cryptoService } from '../../persistence-local/crypto/crypto-service'
import { localDatabase } from '../../persistence-local/db/local-database'
import { projectPreferenceEntityToRecord } from '../../persistence-local/converters/preference'
import { localSession } from '../../persistence-local/session/local-session'
import {
    ASIDE_WIDTH_KEY,
    CALENDAR_POMODORO_BADGE_KEY,
    CALENDAR_WEEKSTART_KEY,
    applyUserConfigSnapshot,
    buildUserConfigSnapshot,
    cancelPreferencePush,
    isRemoteNewer,
    isSnapshotEmpty,
    pullAndMergeUserConfig,
    pushPreferenceQueue,
    readSettingsSyncedAt,
    schedulePreferencePush,
    writeSettingsSyncedAt
} from '../preference-sync'
import { enqueuePreference, loadPreferenceQueue } from '../preference-queue'

/**
 * TASK-26 / M6+M7 —— 偏好同步（快照装配 / LWW / 按行回传 / 防抖 / 不入 syncQueue）
 *
 * **验收判据**（ADR-r2 §D-1b / §D-2 / §D-3 / PS-8 / PS-10）：
 * - 设置面 ⇒ 推送时装配**全量快照** `PUT /user/config`；
 * - 普通清单偏好 ⇒ 按行 `POST /projects/:id/preference`（**复数**）；
 * - LWW 判据**仅服务端时间**（客户端时间戳不作判据）；
 * - 防抖 ~2s（连续写合并一次）；
 * - 回传**不写** `syncQueue`、不产生 `markDirty`。
 */

const USER_ID = 'u-1'
const EMAIL = 'u@example.com'

const makeRequester = (overrides: Partial<Requester> = {}): Requester =>
    ({
        _instance: null,
        name: 'AxiosRequester',
        baseURL: '',
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        ...overrides
    }) as unknown as Requester

const okPut = (updatedAt: string) =>
    vi.fn(async () => ({ data: { code: 10120, data: { updatedAt } } }))

beforeEach(async () => {
    localStorage.clear()
    await localDatabase.meta.clear()
    await localDatabase.syncQueue.clear()
    await localDatabase.projectPreferences.clear()
    cryptoService.lock()
    localSession.setCurrentUserId(USER_ID)
    await cryptoService.setup(USER_ID, 'pw')
})

afterEach(() => {
    cancelPreferencePush()
    vi.restoreAllMocks()
})

describe('快照装配（设置面）', () => {
    it('装配内建偏好 / 侧边栏宽度 / 日历偏好（versioned）', () => {
        localStorage.setItem(`${EMAIL}/all`, JSON.stringify({ viewType: 'kanban' }))
        localStorage.setItem(ASIDE_WIDTH_KEY, '300px')
        localStorage.setItem(CALENDAR_WEEKSTART_KEY, 'monday')
        localStorage.setItem(CALENDAR_POMODORO_BADGE_KEY, 'on')

        const snapshot = buildUserConfigSnapshot(localStorage, EMAIL)

        expect(snapshot.version).toBe(1)
        expect(snapshot.builtInProjectPreferences).toEqual({ all: { viewType: 'kanban' } })
        expect(snapshot.asideWidth).toBe('300px')
        expect(snapshot.calendar).toEqual({
            weekStart: 'monday',
            pomodoroBadge: 'on',
            dayZoom: null
        })
        expect(isSnapshotEmpty(snapshot)).toBe(false)
    })

    it('无 email 时扫描已知内建 id 后缀兜底', () => {
        localStorage.setItem(`someone@example.com/today`, JSON.stringify({ viewType: 'list' }))
        const snapshot = buildUserConfigSnapshot(localStorage, null)
        expect(snapshot.builtInProjectPreferences).toEqual({ today: { viewType: 'list' } })
    })

    it('应用远端快照写回本地存储', () => {
        applyUserConfigSnapshot(
            {
                builtInProjectPreferences: { all: { viewType: 'table' } },
                asideWidth: '260px',
                calendar: { weekStart: 'sunday', pomodoroBadge: null, dayZoom: null }
            },
            localStorage,
            EMAIL
        )
        expect(JSON.parse(localStorage.getItem(`${EMAIL}/all`)!)).toEqual({ viewType: 'table' })
        expect(localStorage.getItem(ASIDE_WIDTH_KEY)).toBe('260px')
        expect(localStorage.getItem(CALENDAR_WEEKSTART_KEY)).toBe('sunday')
        expect(localStorage.getItem(CALENDAR_POMODORO_BADGE_KEY)).toBeNull()
    })
})

describe('LWW 判据 - 仅服务端时间（PS-8）', () => {
    it('服务端更新 ⇒ 远端胜；相等/更旧/不可解析 ⇒ 未变', () => {
        expect(isRemoteNewer('2026-01-02T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(true)
        expect(isRemoteNewer('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(false)
        expect(isRemoteNewer('2025-12-31T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(false)
        expect(isRemoteNewer('not-a-date', '2026-01-01T00:00:00.000Z')).toBe(false)
        // 从未同步过（无本地 syncedAt）+ 服务端有值 ⇒ 远端胜（换设备/本地被清恢复）
        expect(isRemoteNewer('2026-01-01T00:00:00.000Z', null)).toBe(true)
    })

    it('客户端时间戳不参与判定（仅服务端时间改变结论）', () => {
        const syncedAt = '2026-01-01T00:00:00.000Z'
        // 客户端时钟被伪造为未来/过去，均不影响结论
        const before = isRemoteNewer('2025-12-31T00:00:00.000Z', syncedAt)
        vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2099-01-01T00:00:00.000Z'))
        const after = isRemoteNewer('2025-12-31T00:00:00.000Z', syncedAt)
        expect(after).toBe(before)
        expect(after).toBe(false)
    })

    it('SETTINGS_SYNCED_AT 按用户隔离存取', () => {
        writeSettingsSyncedAt(USER_ID, '2026-01-01T00:00:00.000Z')
        expect(readSettingsSyncedAt(USER_ID)).toBe('2026-01-01T00:00:00.000Z')
        expect(readSettingsSyncedAt('other')).toBeNull()
    })
})

describe('回传 - 设置面全量快照', () => {
    it('PUT /user/config（装配全量快照）+ 出队 + 不写 syncQueue', async () => {
        localStorage.setItem(`${EMAIL}/all`, JSON.stringify({ viewType: 'kanban' }))
        await enqueuePreference(USER_ID, { kind: 'userConfig' })
        const put = okPut('2026-01-02T00:00:00.000Z')
        const requester = makeRequester({ put })

        const result = await pushPreferenceQueue({
            requester,
            storage: localStorage,
            email: EMAIL
        })

        expect(result).toEqual({ pushed: 1, failed: 0 })
        expect(put).toHaveBeenCalledTimes(1)
        const [url, body] = put.mock.calls[0] as unknown as [
            string,
            { preferences: { version: number } }
        ]
        expect(url).toBe('/user/config')
        expect(body.preferences.version).toBe(1)
        expect(
            (body.preferences as unknown as { builtInProjectPreferences: unknown })
                .builtInProjectPreferences
        ).toEqual({ all: { viewType: 'kanban' } })
        expect(await loadPreferenceQueue(USER_ID)).toHaveLength(0)
        expect(await localDatabase.syncQueue.count()).toBe(0)
        // 成功后记录服务端版本
        expect(readSettingsSyncedAt(USER_ID)).toBe('2026-01-02T00:00:00.000Z')
    })
})

describe('回传 - 普通清单偏好按行（复数路由）', () => {
    it('POST /projects/:id/preference（按行）+ 出队', async () => {
        const now = new Date().toISOString()
        await localDatabase.projectPreferences.put(
            await projectPreferenceEntityToRecord(
                new ProjectPreferenceEntity(
                    '',
                    now,
                    now,
                    null,
                    'p-1',
                    'kanban',
                    JsonStringValueObject.CreateByJsonString('{"state":"todo"}'),
                    JsonStringValueObject.CreateByJsonString('{}')
                ),
                USER_ID
            )
        )
        await enqueuePreference(USER_ID, { kind: 'projectPreference', projectId: 'p-1' })
        const post = vi.fn(async () => ({ data: { code: 20090, data: {} } }))
        const requester = makeRequester({ post })

        const result = await pushPreferenceQueue({ requester, storage: localStorage, email: EMAIL })

        expect(result).toEqual({ pushed: 1, failed: 0 })
        expect(post).toHaveBeenCalledTimes(1)
        const [url, body] = post.mock.calls[0] as unknown as [string, Record<string, unknown>]
        expect(url).toBe('/projects/p-1/preference')
        expect(url).not.toContain('/project/')
        expect(body).toEqual({
            viewType: 'kanban',
            getTasksOptions: '{"state":"todo"}',
            columns: '{}'
        })
        expect(await loadPreferenceQueue(USER_ID)).toHaveLength(0)
    })
})

describe('回传 - 失败分类（SHELL-06 同口径）', () => {
    it('网络类（5xx）⇒ 暂停不计数（attempts 不变、保留队列）', async () => {
        await enqueuePreference(USER_ID, { kind: 'userConfig' })
        const put = vi.fn(async () => {
            throw { response: { status: 503 } }
        })
        const result = await pushPreferenceQueue({
            requester: makeRequester({ put }),
            storage: localStorage,
            email: EMAIL
        })
        expect(result).toEqual({ pushed: 0, failed: 1 })
        const [item] = await loadPreferenceQueue(USER_ID)
        expect(item?.lastErrorClass).toBe('network')
        expect(item?.attempts).toBeUndefined()
    })

    it('业务类（4xx）⇒ 指数退避（attempts+1 + nextAttemptAt）', async () => {
        await enqueuePreference(USER_ID, { kind: 'userConfig' })
        const put = vi.fn(async () => {
            throw { response: { status: 400 } }
        })
        await pushPreferenceQueue({
            requester: makeRequester({ put }),
            storage: localStorage,
            email: EMAIL
        })
        const [item] = await loadPreferenceQueue(USER_ID)
        expect(item?.attempts).toBe(1)
        expect(item?.nextAttemptAt).toBeTruthy()
    })

    it('凭证类（401）⇒ 标记 + 会话失效回调（不静默吞）', async () => {
        await enqueuePreference(USER_ID, { kind: 'userConfig' })
        const onSessionExpired = vi.fn()
        const put = vi.fn(async () => {
            throw { response: { status: 401 } }
        })
        await pushPreferenceQueue({
            requester: makeRequester({ put }),
            storage: localStorage,
            email: EMAIL,
            onSessionExpired
        })
        expect(onSessionExpired).toHaveBeenCalledTimes(1)
        const [item] = await loadPreferenceQueue(USER_ID)
        expect(item?.lastErrorClass).toBe('credential')
    })
})

describe('启动拉取 + LWW 合并（D-4）', () => {
    it('服务端有更新快照 ⇒ 应用远端并记录 SETTINGS_SYNCED_AT', async () => {
        const get = vi.fn(async () => ({
            data: {
                code: 10110,
                data: {
                    updatedAt: '2026-02-01T00:00:00.000Z',
                    preferences: {
                        builtInProjectPreferences: { all: { viewType: 'list' } },
                        asideWidth: '240px',
                        calendar: { weekStart: 'monday', pomodoroBadge: null, dayZoom: null }
                    }
                }
            }
        }))
        await pullAndMergeUserConfig({
            requester: makeRequester({ get }),
            storage: localStorage,
            email: EMAIL
        })
        expect(JSON.parse(localStorage.getItem(`${EMAIL}/all`)!)).toEqual({ viewType: 'list' })
        expect(localStorage.getItem(ASIDE_WIDTH_KEY)).toBe('240px')
        expect(readSettingsSyncedAt(USER_ID)).toBe('2026-02-01T00:00:00.000Z')
    })

    it('服务端为空对象 `{}`（首次）⇒ 以本地为准并回传（入队 userConfig）', async () => {
        localStorage.setItem(`${EMAIL}/all`, JSON.stringify({ viewType: 'kanban' }))
        const get = vi.fn(async () => ({
            data: { code: 10110, data: { updatedAt: '2026-02-01T00:00:00.000Z', preferences: {} } }
        }))
        await pullAndMergeUserConfig({
            requester: makeRequester({ get }),
            storage: localStorage,
            email: EMAIL
        })
        const items = await loadPreferenceQueue(USER_ID)
        expect(items.map((item) => item.kind)).toContain('userConfig')
    })
})

describe('防抖（~2s，连续写合并一次）', () => {
    it('同一单位多次变更 ⇒ 防抖窗口内只推送一次', async () => {
        await enqueuePreference(USER_ID, { kind: 'userConfig' })
        const put = vi.spyOn(getRequesterImpl(), 'put')
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        try {
            schedulePreferencePush()
            schedulePreferencePush()
            await vi.advanceTimersByTimeAsync(2000)
            expect(put).toHaveBeenCalledTimes(1)
        } finally {
            vi.useRealTimers()
        }
    })
})