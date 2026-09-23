import { describe, expect, it } from 'vite-plus/test'
import {
    POMODORO_RECORD_WRITE_METHODS,
    POMODORO_WRITE_METHODS,
    PROJECT_WRITE_METHODS,
    TAG_WRITE_METHODS,
    TASK_CHECK_ITEM_WRITE_METHODS,
    TASK_COMMENT_WRITE_METHODS,
    TASK_WRITE_METHODS,
    USER_WRITE_METHODS
} from '../write-methods'

/**
 * 写清单防误伤断言（C-59 / AC10 / arch 5 点第 5 条）
 * @description `signOut` / 登出清库 / 迁移 三条路径**不得**被只读闸门拦截
 *              （否则用户无法登出/迁移）。清单唯一真源 = 探针报告 §3.3（**不引硬计数**）。
 */

const ALL_METHODS = Object.assign(
    {},
    TASK_WRITE_METHODS,
    TASK_CHECK_ITEM_WRITE_METHODS,
    TASK_COMMENT_WRITE_METHODS,
    PROJECT_WRITE_METHODS,
    TAG_WRITE_METHODS,
    POMODORO_WRITE_METHODS,
    POMODORO_RECORD_WRITE_METHODS,
    USER_WRITE_METHODS
)

describe('write-methods - 防误伤（登出/清库/迁移不拦）', () => {
    it.each(['signOut', 'signIn', 'checkIn', 'signUp', 'wipeUserData', 'runPlaintextMigration'])(
        '写清单不含 %s',
        (method) => {
            expect(ALL_METHODS[method]).toBeUndefined()
        }
    )

    it('清单非空且返回形态仅 error/tuple', () => {
        const shapes = Object.values(ALL_METHODS)
        expect(shapes.length).toBeGreaterThan(0)
        for (const shape of shapes) {
            expect(['error', 'tuple']).toContain(shape)
        }
    })
})