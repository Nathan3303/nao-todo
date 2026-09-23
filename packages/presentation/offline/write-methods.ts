import type { WriteMethodMap } from './write-gate'

/**
 * 阶段一「离线必须禁写」的写方法清单（唯一真源：探针报告 §3.3）
 * @description 以 `docs/reports/2026-09-23-DEF-PROBE-P1-offline-probes.md` §3.3 的写入口清单为唯一真源，
 *              映射到用例方法（`'error'` = `GoError` 直返；`'tuple'` = `[null, GoError]`）。
 *              清单会随排查增补（已发生一次：24 → 25）⇒ **禁在本文件/文档内引硬计数**。
 *              仅列**异步**写方法；读方法与同步方法不得列入（否则会破坏读路径/返回类型）。
 *              ⚠️ **偏好/设置面显式例外**（TASK-26 / PS-2a，ADR-r2 §D-1 / §10）：
 *              `saveProjectPreference` / `updateUserConfig` **已移出**本清单；内建 `savePreference`
 *              **不得列入** —— 偏好面允许离线本地写（本地优先 + 独立偏好队列回传）。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-59 / §10.10）
 */

/** 任务用例写方法（#1–#13 / #16–#18 / #25） */
export const TASK_WRITE_METHODS: WriteMethodMap = {
    create: 'tuple',
    update: 'error',
    delete: 'error',
    restore: 'error',
    batchUpdate: 'tuple',
    resort: 'error',
    copy: 'tuple',
    snooze: 'error'
}

/** 任务检查项用例写方法（#14） */
export const TASK_CHECK_ITEM_WRITE_METHODS: WriteMethodMap = {
    create: 'tuple',
    update: 'error',
    delete: 'tuple',
    resort: 'error'
}

/** 任务评论用例写方法（#15） */
export const TASK_COMMENT_WRITE_METHODS: WriteMethodMap = {
    create: 'tuple',
    update: 'error',
    delete: 'tuple'
}

/** 清单用例写方法（#22） */
export const PROJECT_WRITE_METHODS: WriteMethodMap = {
    createProject: 'tuple',
    update: 'error',
    delete: 'error',
    restore: 'error',
    archive: 'error',
    unarchive: 'error',
    resort: 'error'
}

/** 标签用例写方法（#21） */
export const TAG_WRITE_METHODS: WriteMethodMap = {
    create: 'tuple',
    update: 'error',
    delete: 'error',
    resort: 'error',
    savePreference: 'error'
}

/** 番茄用例写方法（#20） */
export const POMODORO_WRITE_METHODS: WriteMethodMap = {
    create: 'tuple',
    update: 'error'
}

/** 番茄记录用例写方法（#19） */
export const POMODORO_RECORD_WRITE_METHODS: WriteMethodMap = {
    createRecord: 'tuple'
}

/** 用户用例写方法（#23 / #24；`signOut` 不在此列 ⇒ 离线仍可登出） */
export const USER_WRITE_METHODS: WriteMethodMap = {
    updateNickname: 'error',
    updatePassword: 'error',
    updateAvatarFile: 'tuple',
    deactive: 'error',
    restore: 'error',
    signOutSession: 'error',
    signOutOtherSessions: 'error'
}