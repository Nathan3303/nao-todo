import { describe, expect, it } from 'vite-plus/test'
import * as writeMethodsModule from '../write-methods'
import { USER_WRITE_METHODS } from '../write-methods'

/**
 * 写清单防误伤断言（C-59 / AC10 / arch 5 点第 5 条）+ **阶段二 2A M6 收敛断言**
 * @description `signOut` / 登出清库 / 迁移 三条路径**不得**被只读闸门拦截
 *              （否则用户无法登出/迁移）。清单唯一真源 = 探针报告 §3.3（**不引硬计数**）。
 *
 *              **M6 收敛**（ADR §5 M6）：业务 7 域全部切本地优先 ⇒ 写闸门表**仅保留身份域 `user`**；
 *              业务域条目（含死条目 `TAG_WRITE_METHODS.savePreference`）必须**不再存在**。
 *              本文件是「闸门作用域只剩身份域」的表级守护点。
 */

describe('write-methods - M6 收敛：闸门表仅含身份域', () => {
    it('模块只导出身份域写方法表（业务 7 域的表已移除）', () => {
        const exportedMaps = Object.keys(writeMethodsModule).filter((name) =>
            name.endsWith('_WRITE_METHODS')
        )
        expect(exportedMaps).toEqual(['USER_WRITE_METHODS'])
    })

    it('身份域清单内容 = 用户用例写方法（updateNickname/updatePassword/updateAvatarFile/deactive/restore/signOut*）', () => {
        expect(USER_WRITE_METHODS).toEqual({
            updateNickname: 'error',
            updatePassword: 'error',
            updateAvatarFile: 'tuple',
            deactive: 'error',
            restore: 'error',
            signOutSession: 'error',
            signOutOtherSessions: 'error'
        })
    })

    it.each([
        'create',
        'update',
        'delete',
        'batchUpdate',
        'resort',
        'copy',
        'snooze',
        'createProject',
        'archive',
        'unarchive',
        'savePreference',
        'createRecord',
        'updateUserConfig'
    ])('业务 / 偏好写方法 %s 不在闸门表（离线透传）', (method) => {
        expect(USER_WRITE_METHODS[method]).toBeUndefined()
    })
})

describe('write-methods - 防误伤（登出/清库/迁移不拦）', () => {
    it.each(['signOut', 'signIn', 'checkIn', 'signUp', 'wipeUserData', 'runPlaintextMigration'])(
        '写清单不含 %s',
        (method) => {
            expect(USER_WRITE_METHODS[method]).toBeUndefined()
        }
    )

    it('清单非空且返回形态仅 error/tuple', () => {
        const shapes = Object.values(USER_WRITE_METHODS)
        expect(shapes.length).toBeGreaterThan(0)
        for (const shape of shapes) {
            expect(['error', 'tuple']).toContain(shape)
        }
    })
})