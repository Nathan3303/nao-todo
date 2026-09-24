import { t } from '../locales/i18n'
import type { GoError } from '../types'
import { unwrapError as unwrapErrorRaw } from './unwrap-go-error'

/**
 * 用户可读错误文本（AC11 专用 UI 文案）
 *
 * @description 与纯实现 `unwrapError`（`./unwrap-go-error`，领域/分类器专用）**分文件**：
 *              本模块依赖 i18n（`t()`），只供**展示层**使用，从而不把 vue-i18n 拖进
 *              `domain-*` 的子路径导入（领域侧继续直接引用纯实现）。
 *
 *              `userId` 硬失败（C-55 / AC11）：本地仓储经 `String(err)` 上抛
 *              ⇒ 文本形如 `MissingUserIdError: ...`。此处按 `Error.name` 契约识别
 *              （`MissingUserIdError` 为 infrastructure 侧唯一产出点），替换为**可理解**的
 *              可见文案；**硬失败语义不变**（错误仍上抛/返回，绝不兜底成空串成功）。
 *
 * @see docs/prds/2026-09-23-web-offline-stage1.md（AC11）
 */

/** 硬失败错误名（infrastructure `MissingUserIdError`；按名契约识别，避免跨层依赖） */
export const MISSING_USER_ID_ERROR_NAME = 'MissingUserIdError'

/** 是否 `userId` 硬失败（`Error` 实例或经 `String(err)` 后的字符串形态） */
export const isMissingUserIdError = (err: unknown): boolean =>
    (err instanceof Error && err.name === MISSING_USER_ID_ERROR_NAME) ||
    (typeof err === 'string' && err.startsWith(`${MISSING_USER_ID_ERROR_NAME}:`))

/**
 * 用户可读错误文本（含 `userId` 硬失败映射）；数组形态递归处理
 * @param err Go 风格错误（字符串 / Error / 数组 / null）
 */
export function unwrapError(err: GoError): string {
    if (Array.isArray(err)) {
        let errString = ''
        err.forEach((item: Error | string, idx) => {
            errString += unwrapError(item)
            if (idx !== err.length - 1) errString += '; '
        })
        return errString
    }
    if (isMissingUserIdError(err)) return t('common.sessionRequired')
    return unwrapErrorRaw(err)
}

/** 用户可读错误文本（多错误拼接） */
export function unwrapErrors(...errs: GoError[]): string {
    return errs.map((err) => unwrapError(err)).join('; ')
}