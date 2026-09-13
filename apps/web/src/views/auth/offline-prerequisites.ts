import { cryptoService, localSession, resolveUserIdFromStoredJwt } from '@nao-todo/infrastructure'

/**
 * 离线进入四条件预检（SHELL-05 T6 / C-29，承接 SHELL-03 C-23）
 * @description 仅校验本地事实，**不得**用 `navigator.onLine` 或昵称缓存：
 *              JWT 可解析 + 本地会话一致 + 本地保险库已解锁。
 *              （`offlineEntryGranted` 由用户点击「离线进入」时授予，不在预检内。）
 *              不满足时由调用方给出显式文案 + 动作，并把**原因码**（无 PII）归入结构化日志。
 */

/** 预检失败原因码（稳定枚举；用户可读文案不下沉到判据细节） */
export type OfflinePrerequisiteReason = 'jwt-unresolvable' | 'session-mismatch' | 'locked'

export type OfflinePrerequisites = { ok: true } | { ok: false; reason: OfflinePrerequisiteReason }

export type OfflinePrerequisiteInput = {
    jwtUserId: string | null
    sessionUserId: string | null
    isUnlocked: boolean
}

/** 纯函数：四条件判定（可单测） */
export const evaluateOfflinePrerequisites = (
    input: OfflinePrerequisiteInput
): OfflinePrerequisites => {
    if (!input.jwtUserId) return { ok: false, reason: 'jwt-unresolvable' }
    if (input.sessionUserId !== input.jwtUserId) return { ok: false, reason: 'session-mismatch' }
    if (!input.isUnlocked) return { ok: false, reason: 'locked' }
    return { ok: true }
}

/** 读取真实本地依赖并预检（门侧调用） */
export const checkOfflineEntryPrerequisites = (): OfflinePrerequisites =>
    evaluateOfflinePrerequisites({
        jwtUserId: resolveUserIdFromStoredJwt(),
        sessionUserId: localSession.getCurrentUserId(),
        isUnlocked: cryptoService.isUnlocked === true
    })