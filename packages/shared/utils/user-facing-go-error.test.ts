import { describe, expect, it } from 'vite-plus/test'
import { t } from '../locales/i18n'
import { unwrapError as unwrapErrorRaw } from './unwrap-go-error'
import {
    isMissingUserIdError,
    unwrapError,
    unwrapErrors,
    MISSING_USER_ID_ERROR_NAME
} from './user-facing-go-error'

/**
 * AC11：`userId` 硬失败的用户可读文案
 * @description 纯实现（`unwrap-go-error`，领域/分类器用）保持原样；展示层的 `unwrapError`
 *              按 `Error.name` 契约把 `MissingUserIdError` 映射为 `t('common.sessionRequired')`，
 *              但仍**返回错误文本**（硬失败语义不变，不兜底成空串成功）。
 */

/** 构造一个 `name` 为硬失败名的 Error（模拟 infrastructure 侧产出） */
const missingUserIdError = (): Error =>
    Object.assign(new Error('本地会话缺少 userId：拒绝库操作（C-55 硬失败）'), {
        name: MISSING_USER_ID_ERROR_NAME
    })

describe('user-facing unwrapError - AC11 专用文案', () => {
    it('Error 实例形态 ⇒ 映射为可读文案，不含内部名称', () => {
        const message = unwrapError(missingUserIdError())
        expect(message).toBe(t('common.sessionRequired'))
        expect(message).not.toContain(MISSING_USER_ID_ERROR_NAME)
    })

    it('String(err) 形态（本地仓储 catch 后上抛）⇒ 同样映射', () => {
        const message = unwrapError(String(missingUserIdError()))
        expect(message).toBe(t('common.sessionRequired'))
    })

    it('数组形态 ⇒ 逐项映射（硬失败项可读、其余原样）', () => {
        const message = unwrapError([String(missingUserIdError()), '网络错误'] as never)
        expect(message).toBe(`${t('common.sessionRequired')}; 网络错误`)
    })

    it('unwrapErrors ⇒ 多错误拼接，硬失败项可读', () => {
        expect(unwrapErrors(String(missingUserIdError()))).toBe(t('common.sessionRequired'))
    })

    it('非硬失败错误 ⇒ 原样透出（不误伤）', () => {
        expect(unwrapError(new Error('网络错误'))).toBe('网络错误')
        expect(unwrapError('业务失败')).toBe('业务失败')
        expect(unwrapError(null)).toBe('noError')
    })

    it('纯实现 unwrapErrorRaw 保持原样（领域/分类器不依赖 i18n）', () => {
        const raw = unwrapErrorRaw(String(missingUserIdError()))
        expect(raw).toContain(MISSING_USER_ID_ERROR_NAME)
        expect(raw).not.toBe(t('common.sessionRequired'))
    })

    it('isMissingUserIdError：仅识别硬失败名 / 前缀', () => {
        expect(isMissingUserIdError(missingUserIdError())).toBe(true)
        expect(isMissingUserIdError(`${MISSING_USER_ID_ERROR_NAME}: xxx`)).toBe(true)
        expect(isMissingUserIdError(new Error('MissingUserIdError'))).toBe(false)
        expect(isMissingUserIdError('其他错误')).toBe(false)
        expect(isMissingUserIdError(null)).toBe(false)
    })
})