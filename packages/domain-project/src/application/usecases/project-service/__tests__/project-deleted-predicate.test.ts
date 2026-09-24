import { describe, expect, it } from 'vite-plus/test'
import { ProjectEntity, isProjectDeleted } from '@nao-todo/domain-project'
import { projectEntityToViewObject } from '../converters'

const STAMP = '2026-09-24T10:00:00.000Z'

const makeEntity = (deletedAt: string | null, deactivedAt: string | null) =>
    new ProjectEntity(
        'p-1',
        STAMP,
        STAMP,
        deletedAt,
        '清单',
        'more2',
        null,
        null,
        deactivedAt,
        1000
    )

/**
 * T179 · PA-1 已删除判据单一真源
 * @description 真源：ADR r1 §2。客户端「已删除」= `deletedAt` ∪ `deactivedAt`
 *   任一非空（本地真删除写 `deletedAt`、服务端删除写 `deactivedAt`）；
 *   单一真源 = `isProjectDeleted`（`ProjectEntity.isDeleted` 与 converter 均经此）。
 */
describe('PA-1 已删除判据 —— isProjectDeleted 真值表', () => {
    const truthTable: Array<[string, string | null, string | null, boolean]> = [
        ['deletedAt 空 · deactivedAt 空 ⇒ 未删除', null, null, false],
        ['deletedAt 非空 · deactivedAt 空 ⇒ 已删除（本地真删除墓碑）', STAMP, null, true],
        ['deletedAt 空 · deactivedAt 非空 ⇒ 已删除（服务端删除/停用）', null, STAMP, true],
        ['deletedAt 非空 · deactivedAt 非空 ⇒ 已删除', STAMP, STAMP, true]
    ]

    it.each(truthTable)('%s', (_case, deletedAt, deactivedAt, expected) => {
        expect(isProjectDeleted({ deletedAt, deactivedAt })).toBe(expected)
        // 实体 getter 与谓词同源（覆盖 Entity 的墓碑口径）
        expect(makeEntity(deletedAt, deactivedAt).isDeleted).toBe(expected)
    })

    it('空串视为不存在（远程未删记录 deletedAt / deactivedAt 可能为 ""）', () => {
        expect(isProjectDeleted({ deletedAt: '', deactivedAt: '' })).toBe(false)
        expect(isProjectDeleted({ deletedAt: '', deactivedAt: STAMP })).toBe(true)
        expect(makeEntity('', '').isDeleted).toBe(false)
    })

    it('未删除的实体不得因缺失字段被误判（undefined 不等价于「当前时间」）', () => {
        expect(isProjectDeleted({ deletedAt: undefined, deactivedAt: undefined })).toBe(false)
    })

    it('projectEntityToViewObject.isDeleted 与谓词同源（converter 经单一真源）', () => {
        expect(projectEntityToViewObject(makeEntity(STAMP, null)).isDeleted).toBe(true)
        expect(projectEntityToViewObject(makeEntity(null, STAMP)).isDeleted).toBe(true)
        expect(projectEntityToViewObject(makeEntity(null, null)).isDeleted).toBe(false)
    })
})