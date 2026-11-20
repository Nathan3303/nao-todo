/**
 * 更新检查缓存 + 结果历史（AC8 · 可观测 NFR）
 *
 * @description 走「**传入目录的 fs 面**」（同 `app-settings.ts` 范式）：用例用真 temp dir 断言，
 *              ⛔ 不碰 `app.getPath`、不碰 `localStorage`（渲染层不做二次持久化）。
 *              落 `userData/nao-desktop-update.json`，原子写（tmp + rename，防断电写坏）；
 *              文件损坏/字段缺失回默认值且**不抛错**（启动期崩在这里等于应用打不开）。
 *              内容分两块：
 *              - `check`：上次检查结论（版本 / 是否有更新 / 体积 / 已下载待重启版本）；
 *              - `history`：最近若干次检查 / 下载 / 安装结果（报障用，⛔ 不含本机路径）。
 * @see docs/prds/2026-11-20-desktop-self-update.md（AC8 / §六 可观测）
 * @see docs/adr/2026-11-20-desktop-self-update.md（可测性前置 ⑤）
 */
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DesktopUpdateFailureReason } from '@nao-todo/shared'

/** 缓存文件名（`userData` 下） */
export const UPDATE_STORE_FILE = 'nao-desktop-update.json'

/** 静默检查间隔（24h）；边界按「已过时长 < 24h 才算新鲜」计 ⇒ `24:00:00.000` 已过期 */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

/** 结果历史保留条数 */
export const UPDATE_HISTORY_LIMIT = 20

export interface UpdateCheckRecord {
    /** 上次检查时刻（epoch ms） */
    lastCheckAt: number
    /** 远端版本 */
    latestVersion: string
    /** 上次检查结论（⛔ 失败不落盘：失败是瞬时态，重启后仍显示上次成功结论） */
    result: 'available' | 'up-to-date'
    /** 更新包体积（字节，未知缺省） */
    sizeBytes?: number
    /** 已下载待重启的版本（用户点「立即重启更新」或「稍后」后保留；下次启动据此判 just-updated） */
    readyVersion?: string
}

export interface UpdateHistoryEntry {
    /** 发生时刻（epoch ms） */
    at: number
    kind: 'check' | 'download' | 'install'
    ok: boolean
    /** 失败原因（仅失败时有） */
    reason?: DesktopUpdateFailureReason
    /** 相关版本（有则记） */
    version?: string
}

interface UpdateStoreFile {
    check?: UpdateCheckRecord
    history?: UpdateHistoryEntry[]
}

export interface UpdateStore {
    /** 读取上次检查结论（无记录/损坏 ⇒ `null`） */
    readCheck(): UpdateCheckRecord | null
    /** 局部写入检查结论（保留 history；返回值 = 写入后的完整记录） */
    writeCheck(patch: Partial<UpdateCheckRecord>): UpdateCheckRecord
    /** 追加一条结果历史（超过上限丢最旧） */
    appendHistory(entry: UpdateHistoryEntry): void
    /** 读取结果历史（旧 → 新） */
    readHistory(): UpdateHistoryEntry[]
}

const storePath = (dir: string): string => join(dir, UPDATE_STORE_FILE)

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const asNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined

const asString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.length > 0 ? value : undefined

/** 收窄检查记录（字段类型不对 ⇒ 视为缺失，绝不把字符串当版本） */
const readCheckRecord = (value: unknown): UpdateCheckRecord | null => {
    if (!isObject(value)) return null
    const lastCheckAt = asNumber(value.lastCheckAt)
    const latestVersion = asString(value.latestVersion)
    const result =
        value.result === 'available' || value.result === 'up-to-date' ? value.result : null
    if (lastCheckAt === undefined || !latestVersion || !result) return null
    const record: UpdateCheckRecord = { lastCheckAt, latestVersion, result }
    const sizeBytes = asNumber(value.sizeBytes)
    if (sizeBytes !== undefined) record.sizeBytes = sizeBytes
    const readyVersion = asString(value.readyVersion)
    if (readyVersion) record.readyVersion = readyVersion
    return record
}

const readHistoryEntry = (value: unknown): UpdateHistoryEntry | null => {
    if (!isObject(value)) return null
    const at = asNumber(value.at)
    const kind = value.kind
    if (at === undefined || (kind !== 'check' && kind !== 'download' && kind !== 'install')) {
        return null
    }
    const entry: UpdateHistoryEntry = { at, kind, ok: value.ok === true }
    const reason = asString(value.reason)
    if (reason) entry.reason = reason as DesktopUpdateFailureReason
    const version = asString(value.version)
    if (version) entry.version = version
    return entry
}

/** 读取整份文件（损坏/缺失 ⇒ 空对象，不抛错） */
const readFile = (dir: string): UpdateStoreFile => {
    const path = storePath(dir)
    if (!existsSync(path)) return {}
    try {
        const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
        if (!isObject(parsed)) return {}
        const check = readCheckRecord(parsed.check)
        const history = Array.isArray(parsed.history)
            ? parsed.history
                  .map((item) => readHistoryEntry(item))
                  .filter((item): item is UpdateHistoryEntry => item !== null)
            : []
        const file: UpdateStoreFile = {}
        if (check) file.check = check
        if (history.length > 0) file.history = history
        return file
    } catch {
        // 损坏（非法 JSON / 读不到）⇒ 回默认值，下次写入自愈
        return {}
    }
}

/** 原子写整份文件 */
const writeFile = (dir: string, file: UpdateStoreFile): void => {
    const path = storePath(dir)
    const tmp = `${path}.tmp`
    mkdirSync(dir, { recursive: true })
    writeFileSync(tmp, `${JSON.stringify(file, null, 4)}\n`, 'utf8')
    try {
        renameSync(tmp, path)
    } catch (error) {
        try {
            // 兜底清理 tmp，避免目录里留下 `.tmp`（用例断言目录只应有正式文件）
            unlinkSync(tmp)
        } catch {
            /* tmp 可能已被移走 */
        }
        throw error
    }
}

/**
 * 上次检查是否仍在 24h 窗口内
 * @param record 上次检查结论（`null` ⇒ 从未检查，不新鲜）
 * @param now 当前时刻（epoch ms）
 * @description 边界：`23:59:59.999` 新鲜（0 请求）· `24:00:00.000` 已过期（1 请求，AC8）
 */
export const isCheckFresh = (record: UpdateCheckRecord | null, now: number): boolean =>
    record !== null && now - record.lastCheckAt < UPDATE_CHECK_INTERVAL_MS

/**
 * 创建缓存/历史读写面
 * @param dir 数据目录（`userData`；用例传 temp dir）
 */
export const createUpdateStore = (dir: string): UpdateStore => ({
    readCheck: () => readFile(dir).check ?? null,
    writeCheck: (patch) => {
        const file = readFile(dir)
        const next: UpdateCheckRecord = {
            lastCheckAt: 0,
            latestVersion: '',
            result: 'up-to-date',
            ...file.check,
            ...patch
        }
        writeFile(dir, { ...file, check: next })
        return next
    },
    appendHistory: (entry) => {
        const file = readFile(dir)
        const history = [...(file.history ?? []), entry].slice(-UPDATE_HISTORY_LIMIT)
        writeFile(dir, { ...file, history })
    },
    readHistory: () => readFile(dir).history ?? []
})