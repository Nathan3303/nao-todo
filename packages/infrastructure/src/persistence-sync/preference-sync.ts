/**
 * 偏好同步（TASK-26 / M6 + M7；ADR-r2 §D-1 / §D-1b / §D-2 / §D-3 / §D-4）
 * @description 偏好/设置面**本地优先 + 独立偏好队列回传**（两端同构）：
 *              - 本地写成功 ⇒ `markPreferenceDirty` 入队 + ~2s 防抖推送；
 *              - 设置面（内建清单偏好 / 侧边栏宽度 / 日历偏好）⇒ **推送时装配全量快照** `PUT /user/config`；
 *              - 普通清单偏好 ⇒ 从本地行解密后 `POST /projects/:id/preference`（**按行**）；
 *              - 冲突 = **LWW，服务端时间为权威**（客户端时间戳**仅**用于 UI / 队列合并顺序，**不作判据**）；
 *              - **不入 `syncQueue`**、**不产生业务 `markDirty`**、**不计入 `syncStatus.pendingCount`**（PS-1/PS-10）；
 *              - 失败三分类与退避**复用** `sync-retry`（SHELL-06 C-38/C-39），触发源复用既有注册（不新增机制）。
 * @see docs/adr/2026-09-23-local-preference-sync.md（§D-1b / §D-4 / PS-1 / PS-8 / PS-10）
 */
import { getRequesterImpl, type Requester } from '@nao-todo/shared/requester'
import { defaultBuiltInProjects } from '../built-in/project/default'
import { projectPreferenceRecordToEntity } from '../persistence-local/converters/preference'
import { localDatabase } from '../persistence-local/db/local-database'
import { localSession } from '../persistence-local/session/local-session'
import { getJWTFromLocalStorage } from '../persistence-go/utils'
import {
    duePreferenceItems,
    enqueuePreference,
    loadPreferenceQueue,
    markPreferenceItemFailed,
    removePreferenceItem,
    type PreferenceQueueItem
} from './preference-queue'
import { classifyPushFailure, type SyncErrorClass } from './sync-retry'

/** 偏好推送防抖窗口（ms；ADR §D-4「防抖 ~2s」） */
export const PREFERENCE_PUSH_DEBOUNCE_MS = 2000

/** `UserConfig.preferences` 快照版本（服务端哑存储，不解析） */
export const USER_CONFIG_PREFERENCES_VERSION = 1 as const

/** 设置面「上次成功同步到的服务端版本」localStorage 键后缀（ADR §D-3） */
export const SETTINGS_SYNCED_AT_SUFFIX = 'SETTINGS_SYNCED_AT'

/** 侧边栏宽度 localStorage 键（`useAsideWidth` 默认键） */
export const ASIDE_WIDTH_KEY = 'ASIDE_WIDTH'
/** 日历周起始 localStorage 键（PS-6：用户级） */
export const CALENDAR_WEEKSTART_KEY = 'CALENDAR_WEEKSTART'
/** 日历番茄徽标 localStorage 键 */
export const CALENDAR_POMODORO_BADGE_KEY = 'CALENDAR_POMODORO_BADGE'
/** 日历日缩放 localStorage 键 */
export const CALENDAR_DAY_ZOOM_KEY = 'CALENDAR_DAY_ZOOM'

/** 服务端用户配置成功码（GET/PUT） */
const USER_CONFIG_GET_CODE = 10110
const USER_CONFIG_UPDATE_CODE = 10120
/** 服务端普通清单偏好保存成功码 */
const PROJECT_PREFERENCE_SAVE_CODE = 20090

/** 可注入的最小存储面（默认 `localStorage`；测试可传内存实现） */
export interface PreferenceStorage {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
    key(index: number): string | null
    readonly length: number
}

/** 设置面全量快照（`UserConfig.preferences` 内容；服务端不解析） */
export interface UserConfigPreferencesSnapshot {
    version: typeof USER_CONFIG_PREFERENCES_VERSION
    builtInProjectPreferences: Record<string, unknown>
    asideWidth: string | null
    calendar: {
        weekStart: string | null
        pomodoroBadge: string | null
        dayZoom: string | null
    }
}

/** 内建清单 id 列表（客户端概念，单一真源 = `defaultBuiltInProjects`） */
const builtInProjectIds = (): string[] => defaultBuiltInProjects.map((project) => project.id)

/** 安全读存储（不可用/异常 ⇒ null） */
const readStorage = (storage: PreferenceStorage, key: string): string | null => {
    try {
        return storage.getItem(key)
    } catch {
        return null
    }
}

/** 安全写存储（异常静默降级，不阻断） */
const writeStorage = (storage: PreferenceStorage, key: string, value: string | null): void => {
    try {
        if (value === null) storage.removeItem(key)
        else storage.setItem(key, value)
    } catch {
        /* 隐私模式/配额：静默降级 */
    }
}

/** 读取内建清单偏好（email 前缀优先；无 email ⇒ 扫描已知内建 id 后缀兜底） */
const readBuiltInProjectPreferences = (
    storage: PreferenceStorage,
    email: string | null
): Record<string, unknown> => {
    const ids = builtInProjectIds()
    const result: Record<string, unknown> = {}
    const parse = (raw: string | null): unknown => {
        if (!raw) return undefined
        try {
            return JSON.parse(raw)
        } catch {
            return undefined
        }
    }
    if (email) {
        for (const id of ids) {
            const value = parse(readStorage(storage, `${email}/${id}`))
            if (value !== undefined) result[id] = value
        }
        return result
    }
    let length = 0
    try {
        length = storage.length
    } catch {
        return result
    }
    for (let i = 0; i < length; i += 1) {
        const key = storage.key(i)
        if (!key) continue
        const slash = key.lastIndexOf('/')
        if (slash < 0) continue
        const id = key.slice(slash + 1)
        if (!ids.includes(id)) continue
        const value = parse(readStorage(storage, key))
        if (value !== undefined) result[id] = value
    }
    return result
}

/**
 * 装配设置面全量快照（**推送时**从本地存储读取，非增量）
 * @param storage 存储面（默认 `localStorage`）
 * @param email 内建偏好键前缀（`${email}/${builtInId}`；null ⇒ 扫描兜底）
 */
export const buildUserConfigSnapshot = (
    storage: PreferenceStorage = localStorage,
    email: string | null = null
): UserConfigPreferencesSnapshot => ({
    version: USER_CONFIG_PREFERENCES_VERSION,
    builtInProjectPreferences: readBuiltInProjectPreferences(storage, email),
    asideWidth: readStorage(storage, ASIDE_WIDTH_KEY),
    calendar: {
        weekStart: readStorage(storage, CALENDAR_WEEKSTART_KEY),
        pomodoroBadge: readStorage(storage, CALENDAR_POMODORO_BADGE_KEY),
        dayZoom: readStorage(storage, CALENDAR_DAY_ZOOM_KEY)
    }
})

/** 快照是否有可回传内容（空快照不产生无意义推送） */
export const isSnapshotEmpty = (snapshot: UserConfigPreferencesSnapshot): boolean =>
    Object.keys(snapshot.builtInProjectPreferences).length === 0 &&
    snapshot.asideWidth === null &&
    snapshot.calendar.weekStart === null &&
    snapshot.calendar.pomodoroBadge === null &&
    snapshot.calendar.dayZoom === null

/** 应用服务端快照到本地存储（远端胜分支；仅覆盖快照中出现的字段） */
export const applyUserConfigSnapshot = (
    snapshot: Partial<UserConfigPreferencesSnapshot> | null | undefined,
    storage: PreferenceStorage = localStorage,
    email: string | null = null
): void => {
    if (!snapshot) return
    const builtIn = snapshot.builtInProjectPreferences ?? {}
    if (email) {
        for (const [id, value] of Object.entries(builtIn)) {
            if (!builtInProjectIds().includes(id)) continue
            writeStorage(storage, `${email}/${id}`, JSON.stringify(value))
        }
    }
    if ('asideWidth' in snapshot)
        writeStorage(storage, ASIDE_WIDTH_KEY, snapshot.asideWidth ?? null)
    if (snapshot.calendar) {
        writeStorage(storage, CALENDAR_WEEKSTART_KEY, snapshot.calendar.weekStart ?? null)
        writeStorage(storage, CALENDAR_POMODORO_BADGE_KEY, snapshot.calendar.pomodoroBadge ?? null)
        writeStorage(storage, CALENDAR_DAY_ZOOM_KEY, snapshot.calendar.dayZoom ?? null)
    }
}

/**
 * LWW 判据（**仅服务端时间**；PS-8）
 * @description `server.updatedAt > SETTINGS_SYNCED_AT` ⇒ 远端更新（应用远端）；
 *              否则（相等/更旧/不可解析）⇒ 视为未变（本地脏则推送）。
 *              客户端时间戳**不参与**本判定。
 */
export const isRemoteNewer = (
    serverUpdatedAt: string | null | undefined,
    syncedAt: string | null | undefined
): boolean => {
    const server = Date.parse(String(serverUpdatedAt ?? ''))
    if (!Number.isFinite(server)) return false
    const synced = Date.parse(String(syncedAt ?? ''))
    if (!Number.isFinite(synced)) return true
    return server > synced
}

/** 设置面「上次同步到的服务端版本」存储键（按用户隔离） */
const settingsSyncedAtKey = (userId: string): string => `${userId}:${SETTINGS_SYNCED_AT_SUFFIX}`

/** 读取上次同步到的服务端版本 */
export const readSettingsSyncedAt = (
    userId: string,
    storage: PreferenceStorage = localStorage
): string | null => (userId ? readStorage(storage, settingsSyncedAtKey(userId)) : null)

/** 写入上次同步到的服务端版本（清库随 localStorage 身份级键一并清除） */
export const writeSettingsSyncedAt = (
    userId: string,
    value: string,
    storage: PreferenceStorage = localStorage
): void => {
    if (!userId) return
    writeStorage(storage, settingsSyncedAtKey(userId), value)
}

/** 从 JWT payload 解析当前用户 email（内建偏好键前缀；失败 ⇒ null） */
export const resolveEmailFromStoredJwt = (): string | null => {
    try {
        const jwt = getJWTFromLocalStorage() ?? ''
        const payload = jwt.split('.')[1]
        if (!payload) return null
        let base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
        while (base64.length % 4) base64 += '='
        const text = atob(base64)
        const match = text.match(/["'](?:Payload|payload|email)["']\s*:\s*"([^"]+)"/)
        return match?.[1] ?? null
    } catch {
        return null
    }
}

/** 偏好推送结果（可观测；AC3-04 / AC4） */
export interface PreferencePushResult {
    /** 成功出队数 */
    pushed: number
    /** 失败保留数 */
    failed: number
}

/** 推送上下文（可注入，便于单测） */
export interface PreferenceSyncContext {
    requester?: Requester
    storage?: PreferenceStorage
    email?: string | null
    nowMs?: number
    /** 会话失效回调（凭证类失败；不静默吞） */
    onSessionExpired?: () => void
}

const resolveContext = (context: PreferenceSyncContext) => ({
    requester: context.requester ?? getRequesterImpl(),
    storage: context.storage ?? (typeof localStorage === 'undefined' ? null : localStorage),
    email: context.email ?? resolveEmailFromStoredJwt(),
    nowMs: context.nowMs ?? Date.now()
})

const authHeaders = (): Record<string, string> => {
    try {
        return { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
    } catch {
        return {}
    }
}

/** 失败分类（网络/业务/凭证），复用 SHELL-06 口径（C-38） */
const classifyError = (err: unknown): ReturnType<typeof classifyPushFailure> => {
    const response = (err as { response?: { status?: number } })?.response
    const code = (err as { code?: unknown })?.code
    return classifyPushFailure({ httpStatus: response?.status, normalizedCode: code })
}

/** 解析响应业务码（归一化网络错误在顶层携带字符串 code） */
const readResponse = (response: unknown): { code?: unknown; data?: unknown; network: boolean } => {
    const raw = (response ?? {}) as { code?: unknown; data?: unknown }
    if (typeof raw.code === 'string') return { code: raw.code, network: true }
    const data = raw.data as { code?: unknown; data?: unknown } | undefined
    return { code: data?.code, data: data?.data, network: false }
}

/** 单次推送结果 */
type PushOutcome = { ok: boolean; errorClass?: SyncErrorClass; serverUpdatedAt?: string }

/** 推送单个 `userConfig` 项（装配全量快照） */
const pushUserConfig = async (
    requester: Requester,
    storage: PreferenceStorage | null,
    email: string | null
): Promise<PushOutcome> => {
    const snapshot = buildUserConfigSnapshot(storage ?? (localStorage as PreferenceStorage), email)
    try {
        const response = await requester.put(
            '/user/config',
            { preferences: snapshot },
            { headers: authHeaders() }
        )
        const { code, data, network } = readResponse(response)
        if (network) return { ok: false, errorClass: 'network' }
        if (code === 10041) return { ok: false, errorClass: 'credential' }
        if (code !== USER_CONFIG_UPDATE_CODE) return { ok: false, errorClass: 'business' }
        const serverUpdatedAt = (data as { updatedAt?: string } | undefined)?.updatedAt
        return { ok: true, serverUpdatedAt }
    } catch (err) {
        return { ok: false, errorClass: classifyError(err) }
    }
}

/** 推送单个 `projectPreference` 项（从本地行解密后按行回传） */
const pushProjectPreference = async (
    requester: Requester,
    projectId: string
): Promise<PushOutcome> => {
    try {
        const record = await localDatabase.projectPreferences
            .where('projectId')
            .equals(projectId)
            .first()
        if (!record) return { ok: true } // 本地行已不存在：视为已同步，出队
        const entity = await projectPreferenceRecordToEntity(record)
        const response = await requester.post(
            `/projects/${projectId}/preference`,
            {
                viewType: entity.viewType,
                getTasksOptions: entity.getTasksOptions.unmarshal(),
                columns: entity.columns.unmarshal()
            },
            { headers: authHeaders() }
        )
        const { code, network } = readResponse(response)
        if (network) return { ok: false, errorClass: 'network' }
        if (code === 10041) return { ok: false, errorClass: 'credential' }
        if (code !== PROJECT_PREFERENCE_SAVE_CODE) return { ok: false, errorClass: 'business' }
        return { ok: true }
    } catch (err) {
        return { ok: false, errorClass: classifyError(err) }
    }
}

/**
 * 推送偏好队列（到期项；失败按三分类处理）
 * @description 网络类 ⇒ 暂停不计数；业务类 ⇒ 指数退避；凭证类 ⇒ 会话失效回调。
 *              **不触碰** `syncQueue` / `markDirty` / `pendingCount`。
 */
export const pushPreferenceQueue = async (
    context: PreferenceSyncContext = {}
): Promise<PreferencePushResult> => {
    try {
        const userId = localSession.getCurrentUserId()
        if (!userId) return { pushed: 0, failed: 0 }
        const { requester, storage, email, nowMs } = resolveContext(context)
        const items = duePreferenceItems(await loadPreferenceQueue(userId), nowMs)
        let pushed = 0
        let failed = 0
        for (const item of items) {
            const outcome: PushOutcome =
                item.kind === 'userConfig'
                    ? await pushUserConfig(requester, storage, email)
                    : await pushProjectPreference(requester, item.projectId ?? '')
            if (outcome.ok) {
                await removePreferenceItem(userId, item)
                if (item.kind === 'userConfig' && outcome.serverUpdatedAt) {
                    writeSettingsSyncedAt(userId, outcome.serverUpdatedAt, storage ?? localStorage)
                }
                pushed += 1
                continue
            }
            failed += 1
            const errorClass = outcome.errorClass ?? 'business'
            if (errorClass === 'credential') {
                await markPreferenceItemFailed(userId, item, errorClass, nowMs)
                context.onSessionExpired?.()
                continue
            }
            await markPreferenceItemFailed(userId, item, errorClass, nowMs)
        }
        return { pushed, failed }
    } catch {
        /* 存储不可用（隐私模式/库未就绪）：静默降级，不阻断使用（PS-9） */
        return { pushed: 0, failed: 0 }
    }
}

/**
 * 启动/登录拉取 + LWW 合并设置面（非阻塞；失败静默降级 + 可见计数由调用方承接）
 * @description 服务端更新 ⇒ 应用远端并记录 `SETTINGS_SYNCED_AT`；否则本地脏 ⇒ 由队列推送。
 *              服务端无 `preferences`（首次）⇒ 以本地为准（本地有内容则入队回传）。
 */
export const pullAndMergeUserConfig = async (
    context: PreferenceSyncContext = {}
): Promise<void> => {
    const userId = localSession.getCurrentUserId()
    if (!userId) return
    const { requester, storage, email } = resolveContext(context)
    try {
        const response = await requester.get('/user/config', { headers: authHeaders() })
        const { code, data, network } = readResponse(response)
        if (network) return
        if (code === 10041) {
            context.onSessionExpired?.()
            return
        }
        if (code !== USER_CONFIG_GET_CODE) return
        const payload = (data ?? {}) as {
            updatedAt?: string
            preferences?: Partial<UserConfigPreferencesSnapshot> | null
        }
        const remotePreferences = payload.preferences
        // 服务端未设置时返回空对象 `{}`（T130）⇒ 视为「无远端偏好」，以本地为准
        const hasRemotePreferences =
            !!remotePreferences &&
            typeof remotePreferences === 'object' &&
            Object.keys(remotePreferences).length > 0
        if (
            hasRemotePreferences &&
            isRemoteNewer(payload.updatedAt, readSettingsSyncedAt(userId, storage ?? localStorage))
        ) {
            applyUserConfigSnapshot(remotePreferences, storage ?? localStorage, email)
            if (payload.updatedAt)
                writeSettingsSyncedAt(userId, payload.updatedAt, storage ?? localStorage)
            return
        }
        // 远端未更新（或无 preferences）：本地有内容 ⇒ 入队回传（以本地为准）
        if (!hasRemotePreferences) {
            const snapshot = buildUserConfigSnapshot(storage ?? localStorage, email)
            if (!isSnapshotEmpty(snapshot)) await enqueuePreference(userId, { kind: 'userConfig' })
        }
    } catch {
        /* 服务端不可达：本地照常读写，静默降级（可见计数由状态面承接） */
    }
}

/* —— 触发源（复用既有注册：启动 / online / 前台恢复 / 定时；不新增机制） —— */

let pushTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 入队偏好变更并调度防抖推送
 * @description 本地写成功**之后**调用；`userConfig` 每用户一条、`projectPreference` 按 `projectId` 一条。
 */
export const markPreferenceDirty = async (
    kind: PreferenceQueueItem['kind'],
    projectId?: string
): Promise<void> => {
    try {
        const userId = localSession.getCurrentUserId()
        if (!userId) return
        await enqueuePreference(
            userId,
            kind === 'projectPreference' ? { kind, projectId } : { kind }
        )
        schedulePreferencePush()
    } catch {
        /* 偏好入队/调度失败不得阻断本地写（local-first / PS-9：失败静默降级、不阻断） */
    }
}

/** 防抖推送（~2s；连续写合并为一次） */
export const schedulePreferencePush = (): void => {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
        pushTimer = null
        void pushPreferenceQueue()
    }, PREFERENCE_PUSH_DEBOUNCE_MS)
}

/** 立即冲刷（`online` / 前台恢复 / 启动 / 定时触发；不新增触发机制） */
export const flushPreferenceQueue = async (): Promise<PreferencePushResult> => pushPreferenceQueue()

/** 取消待发防抖定时器（登出/卸载；**仅测试**亦可调用） */
export const cancelPreferencePush = (): void => {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = null
}