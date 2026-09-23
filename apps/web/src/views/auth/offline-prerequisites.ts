import {
    BUSINESS_TABLES,
    localDatabase,
    localSession,
    resolveUserIdFromStoredJwt
} from '@nao-todo/infrastructure'

/**
 * 离线进入预检（C-62 新判据，替代 SHELL-05 C-29 条件④）
 * @description 仅校验本地事实，**不得**用 `navigator.onLine` 或昵称缓存：
 *              JWT 可解析 + 本地会话一致 + **本地镜像存在**。
 *              （`offlineEntryGranted` 由用户点击「离线进入」时授予，不在预检内。）
 *              条件④原为 `cryptoService.isUnlocked`（= `dek !== null`，退役解锁门后恒假 ⇒ DEF-16）；
 *              现改「本地镜像存在」⇒ 门退役后离线进入恢复**正向可达**（AC15）。
 *              不满足时由调用方给出显式文案 + 动作，并把**原因码**（无 PII）归入结构化日志。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-62）
 */

/** 预检失败原因码（稳定枚举；`locked` 已随条件④删除，改为 `mirror-missing`） */
export type OfflinePrerequisiteReason = 'jwt-unresolvable' | 'session-mismatch' | 'mirror-missing'

export type OfflinePrerequisites = { ok: true } | { ok: false; reason: OfflinePrerequisiteReason }

export type OfflinePrerequisiteInput = {
    jwtUserId: string | null
    sessionUserId: string | null
    /** 本地镜像存在（C-62 条件③；由 `hasLocalMirror` 探测） */
    hasLocalMirror: boolean
}

/** 纯函数：三条件判定（可单测；首个不满足即返回） */
export const evaluateOfflinePrerequisites = (
    input: OfflinePrerequisiteInput
): OfflinePrerequisites => {
    if (!input.jwtUserId) return { ok: false, reason: 'jwt-unresolvable' }
    if (input.sessionUserId !== input.jwtUserId) return { ok: false, reason: 'session-mismatch' }
    if (!input.hasLocalMirror) return { ok: false, reason: 'mirror-missing' }
    return { ok: true }
}

/**
 * 本地镜像存在探测（C-62 条件③）
 * @description 冷启动（含离线）可判定的**持久化**事实（内存态 `syncStatus.mirrorPulledAt` 冷启动归零，
 *              不可用于离线进入），判定顺序：
 *              ① 同步游标落盘（曾成功拉取，含空账户：空表亦写游标）；
 *              ② 任一业务表存在该用户记录（含迁移直写 / 未同步的本地数据）。
 * @param userId 用户 ID；空值硬失败（C-55：不得退化为空用户读写）
 */
export const hasLocalMirror = async (userId: string): Promise<boolean> => {
    if (!userId) return false
    if ((await localDatabase.syncCursor.where('userId').equals(userId).count()) > 0) return true
    for (const table of BUSINESS_TABLES) {
        if ((await localDatabase.table(table).where('userId').equals(userId).count()) > 0) {
            return true
        }
    }
    return false
}

/** 读取真实本地依赖并预检（门侧调用；镜像探测为异步 ⇒ 本函数异步） */
export const checkOfflineEntryPrerequisites = async (): Promise<OfflinePrerequisites> => {
    const jwtUserId = resolveUserIdFromStoredJwt()
    const sessionUserId = localSession.getCurrentUserId()
    const hasMirror = jwtUserId !== null ? await hasLocalMirror(jwtUserId) : false
    return evaluateOfflinePrerequisites({ jwtUserId, sessionUserId, hasLocalMirror: hasMirror })
}