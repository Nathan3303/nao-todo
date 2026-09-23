import { t } from '@nao-todo/shared/locales'
import { NueMessage } from 'nue-ui'
import { isReadOnly } from './read-only-state'

/**
 * 阶段一统一写闸门（C-59 / AC10）
 * @description 离线（只读）时，**统一**在用例装配层拦截写方法：不改仓储、不逐个改 UI 入口。
 *              写方法清单见 `write-methods.ts`（依据 `docs/reports/2026-09-23-DEF-PROBE-P1-offline-probes.md`
 *              §3.3，唯一真源；清单会随排查增补，**禁在本模块引硬计数**）。
 *
 *              拦截语义：
 *              - 返回形态与原方法一致（`'error'` = `GoError` 直返；`'tuple'` = `[null, GoError]`），
 *                使既有调用方（handler / adapter / composable）无需改动即可收到「离线只读」错误；
 *              - 同时弹**可见提示**（`NueMessage.warning`），覆盖调用方静默丢弃返回值的入口（DEF-17）；
 *              - 不调用原方法 ⇒ 仓储零写入 ⇒ **不产生 `markDirty`**（C-59）。
 *
 *              离线只读错误码为稳定字符串（`OFFLINE_READONLY`），调用方**不得**依赖文案判定。
 * @see docs/adr/2026-09-23-web-offline-local-first-and-security-posture.md（C-59）
 */

/** 离线只读错误码（稳定标识；不随文案变化） */
export const OFFLINE_READONLY_ERROR = 'OFFLINE_READONLY'

/** 写方法返回形态：`'error'` = `GoError` 直返；`'tuple'` = `[null, GoError]` */
export type WriteReturnShape = 'error' | 'tuple'

/** 写方法清单（方法名 → 返回形态） */
export type WriteMethodMap = Record<string, WriteReturnShape>

/** 可见提示节流窗口（ms）：连续写操作只提示一次，避免刷屏 */
const NOTICE_THROTTLE_MS = 1200

let lastNoticeAt = 0

/** 弹出「离线只读」可见提示（节流；供 UI 主动提示复用） */
export const notifyReadOnly = (): void => {
    const now = Date.now()
    if (now - lastNoticeAt < NOTICE_THROTTLE_MS) return
    lastNoticeAt = now
    NueMessage.warn(t('offline.readOnlyHint'))
}

/** 重置提示节流（**仅测试**） */
export const resetWriteGateForTest = (): void => {
    lastNoticeAt = 0
}

/** 构造只读错误返回值（按原方法形态） */
const readOnlyResult = (shape: WriteReturnShape): unknown =>
    shape === 'tuple' ? [null, OFFLINE_READONLY_ERROR] : OFFLINE_READONLY_ERROR

/**
 * 以只读闸门包装用例实例
 * @description 仅拦截 `writeMethods` 列出的方法；其余方法原样透传（含所有读方法）。
 *              返回 Proxy，类型与入参一致，调用方无感。
 * @param useCase 用例实例
 * @param writeMethods 写方法清单（方法名 → 返回形态）
 */
export const withReadOnlyGuard = <T extends object>(
    useCase: T,
    writeMethods: WriteMethodMap
): T => {
    const writeShapes = new Map(Object.entries(writeMethods))

    return new Proxy(useCase, {
        get(target, property) {
            const value = Reflect.get(target, property, target) as unknown
            if (typeof value !== 'function') return value

            const shape = writeShapes.get(String(property))
            if (shape === undefined) return (value as (...args: unknown[]) => unknown).bind(target)

            return (...args: unknown[]): unknown => {
                if (!isReadOnly()) {
                    return (value as (...args: unknown[]) => unknown).apply(target, args)
                }
                notifyReadOnly()
                return Promise.resolve(readOnlyResult(shape))
            }
        }
    })
}