import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { localDatabase } from '../db/local-database'
import { LocalTaskRepoImpl } from '../repos/task-repo-impl'
import { makeTaskVO, setup } from './local-repos-test-helpers'

/**
 * `T620` AC12（仓储侧）—— `priority=low` 查询必须包含白名单外的**脏值**（PRD R-J / D1）
 *
 * @description 看板列内分页后，「低」列 = 一次 `priority=low` 的本地查询 ⇒ 本地仓储若保持
 *              **精确匹配**（`task-repo-impl.ts` 的 `priorities.includes(...)`），`null` / `''` /
 *              未知串会**从看板消失**（`t608-ac4` 回归）。D1 口径：含 `low` 时把 `prioritySNMap`
 *              白名单外的值也当 low（零服务端契约改动）。
 *
 * **这是一条「行为变化」双锁的第二半**：列表 / 表格视图按「低」筛选**也会**带出脏值
 * （发版说明必须写「⚠️ 请留意」）。第一半（看板「低」列可见脏值）见
 * `packages/presentation/task/components/kanban/__tests__/t620-ac12-dirty-priority.test.ts`。
 *
 * 状态（`T620` 红基线，2026-11-01 HEAD `29cbe4c0` 实测）：AC12① ⇒ **红**
 *   （仓储精确匹配 ⇒ `priority=low` 查不到 `null` / `''` / `unknown-x`）
 */

describe('T620 AC12（仓储）· priority=low 含脏值', () => {
    beforeEach(async () => {
        await setup()
    })

    const seedWithDirtyPriorities = async (repo: LocalTaskRepoImpl): Promise<void> => {
        await repo.create(makeTaskVO({ name: '低', priority: 'low' }))
        await repo.create(makeTaskVO({ name: '中', priority: 'medium' }))
        await repo.create(makeTaskVO({ name: '高', priority: 'high' }))
        // 空串：`CreateTaskValueObject.validate` 放行（falsy）
        await repo.create(makeTaskVO({ name: '空串', priority: '' }))
        // null：值对象校验同样放行（falsy），但 `makeTaskVO` 的 `??` 会把 null 兜成 medium ⇒ 构造后回填
        const nullPriorityVo = makeTaskVO({ name: '无值' })
        nullPriorityVo.priority = null as unknown as string
        await repo.create(nullPriorityVo)
        // 未知串：值对象校验会拒 ⇒ 先按合法值建，再把记录的明文 priority 改成脏值（存量数据形态）
        const [dirty] = await repo.create(makeTaskVO({ name: '未知串', priority: 'low' }))
        await localDatabase.tasks.update(dirty!.id, { priority: 'unknown-x' })
    }

    it("AC12① 按「低」筛选（priority=low）⇒ 带出 low + null / '' / 未知串", async () => {
        const repo = new LocalTaskRepoImpl()
        await seedWithDirtyPriorities(repo)

        const [result, err] = await repo.list('isDeleted=false&priority=low')
        expect(err).toBeNull()
        expect(
            result!.taskEntities.map((task) => task.name).sort(),
            '「低」筛选必须包含白名单外的脏值（看板「低」列与列表「低」筛选同一口径）'
        ).toEqual(['低', '无值', '未知串', '空串'].sort())
    })

    it('AC12② 只对 low 放开：medium / high 不被脏值污染', async () => {
        const repo = new LocalTaskRepoImpl()
        await seedWithDirtyPriorities(repo)

        const [mediumResult] = await repo.list('isDeleted=false&priority=medium')
        expect(mediumResult!.taskEntities.map((task) => task.name)).toEqual(['中'])

        const [highResult] = await repo.list('isDeleted=false&priority=high')
        expect(highResult!.taskEntities.map((task) => task.name)).toEqual(['高'])
    })

    it('AC12③ 读取不写库：查询脏值不会归一 / 改写原值', async () => {
        const repo = new LocalTaskRepoImpl()
        await seedWithDirtyPriorities(repo)

        await repo.list('isDeleted=false&priority=low')

        const records = await localDatabase.tasks.toArray()
        const dirtyRecords = records.filter((record) =>
            ['null', '', 'unknown-x'].includes(String(record.priority))
        )
        expect(
            dirtyRecords.map((record) => String(record.priority)).sort(),
            '脏值必须原样留在库里（读取归类 ≠ 写回归一）'
        ).toEqual(['', 'null', 'unknown-x'])
        expect(records, '库内任务数不变（查询不写库）').toHaveLength(6)
    })
})