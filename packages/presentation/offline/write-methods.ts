import type { WriteMethodMap } from './write-gate'

/**
 * web 离线写闸门清单 —— **阶段二 2A M6 收敛后仅保留身份域（`user`）**
 * @description 阶段一「离线必须禁写」的写方法清单（唯一真源：探针报告 §3.3）在阶段二 2A **按域退役**：
 *              **业务 7 域**（task / task-check-item / task-comment / project / tag / pomodoro /
 *              pomodoro-record）**已全部切本地优先**（本地仓储 + `syncQueue` 回传，ADR
 *              `2026-09-24-stage2-both-ends-local-first` §5 M4/M5）⇒ 离线写合法，**不得**再列入闸门。
 *              本文件**只保留身份域 `user`**（W5 不切、仍远端直连）⇒ 离线身份写仍被拦截。
 *              `signOut` 不在清单内 ⇒ 离线仍可登出（登出/清库/迁移**从不**受闸门约束，见探针 §3.3）。
 *              ⚠️ **偏好/设置面为显式例外**（TASK-26 / PS-1a / PS-1b）：内建 `savePreference`
 *              **不得列入**（偏好面允许离线本地写）；`TAG_WRITE_METHODS.savePreference`（死条目）
 *              随 W3 标签域切本地一并删除。
 * @see docs/adr/2026-09-24-stage2-both-ends-local-first.md（§5 M6 / §2.6 W5）
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-59 阶段一 / C-66）
 */

/**
 * 用户用例写方法（#23 / #24；`signOut` 不在此列 ⇒ 离线仍可登出）
 * @description 身份域 `user`（W5）**不切本地优先**，写路径仍远端直连 ⇒ 离线必须拦截。
 */
export const USER_WRITE_METHODS: WriteMethodMap = {
    updateNickname: 'error',
    updatePassword: 'error',
    updateAvatarFile: 'tuple',
    deactive: 'error',
    restore: 'error',
    signOutSession: 'error',
    signOutOtherSessions: 'error'
}