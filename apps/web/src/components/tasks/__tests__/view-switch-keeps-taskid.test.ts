// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import tasksRoutes from '@/views/index/tasks/routes'

/**
 * T474b：tasks 视图切换（表格/列表/看板）**保留 `taskId`** ⇒ 详情面板不被重置。
 *
 * 背景（T474 审计实测）：三处 `switchViewType` 走「同名 `replace`，只传 `viewType`」，
 * vue-router **不会**补齐缺失的可选参数 ⇒ `taskId` 被丢弃 ⇒ 面板关闭。
 * 修法：切换时透传当前 `taskId`（`undefined` 时路由自动省略该段）。
 *
 * ⚠️ 与 `closeDetails`（`task-details.ts:135` 同名 `push` `taskId: undefined`）**共存**：
 * 显式 `undefined` ⇒ 参数被移除（关闭生效）；透传当前值 ⇒ 保留（切换生效）。
 */

const Dummy = { template: '<div><router-view /></div>' }

/** 递归替换组件为桩，避免加载真实视图链 */
const stubTree = (route: RouteRecordRaw): RouteRecordRaw =>
    ({
        ...route,
        component: Dummy,
        ...(route.components
            ? {
                  components: Object.fromEntries(
                      Object.keys(route.components).map((k) => [k, Dummy])
                  )
              }
            : {}),
        ...(route.children ? { children: route.children.map(stubTree) } : {})
    }) as RouteRecordRaw

const buildRouter = () =>
    createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/', name: 'index', component: Dummy, children: [stubTree(tasksRoutes)] }]
    })

/** 与产品 `switchViewType`（T474b 后）同形的导航目标 */
const switchTarget = (router: ReturnType<typeof buildRouter>, name: string, viewType: string) => ({
    name,
    params: { viewType, taskId: router.currentRoute.value.params.taskId }
})

describe('T474b tasks 视图切换保留 taskId（详情面板不消失）', () => {
    it('带详情切列表 / 看板 ⇒ taskId 保留', async () => {
        const router = buildRouter()
        await router.push('/tasks/all/table/t1')
        expect(router.currentRoute.value.params.taskId).toBe('t1')

        await router.replace(switchTarget(router, 'tasks-built-in-project-main', 'list'))
        expect(router.currentRoute.value.params.taskId).toBe('t1')
        expect(router.currentRoute.value.fullPath).toBe('/tasks/all/list/t1')

        await router.replace(switchTarget(router, 'tasks-built-in-project-main', 'kanban'))
        expect(router.currentRoute.value.params.taskId).toBe('t1')
        expect(router.currentRoute.value.fullPath).toBe('/tasks/all/kanban/t1')
    })

    it('无详情切视图 ⇒ 不产生多余参数段', async () => {
        const router = buildRouter()
        await router.push('/tasks/all/table')
        await router.replace(switchTarget(router, 'tasks-built-in-project-main', 'list'))
        expect(router.currentRoute.value.params.taskId).toBeUndefined()
        expect(router.currentRoute.value.fullPath).toBe('/tasks/all/list')
    })

    it('关闭详情（closeDetails 形状：同名 push taskId=undefined）⇒ 参数被清理（共存性）', async () => {
        const router = buildRouter()
        await router.push('/tasks/all/table/t1')
        expect(router.currentRoute.value.params.taskId).toBe('t1')

        // 产品 closeDetails 形状（packages/presentation/task/.../task-details.ts:135）
        await router.push({
            name: router.currentRoute.value.name,
            params: { taskId: undefined }
        })

        expect(router.currentRoute.value.params.taskId).toBeUndefined()
        expect(router.currentRoute.value.fullPath).toBe('/tasks/all/table')
    })
})

describe('T474b 源级：三处 switchViewType 均透传 taskId', () => {
    const SOURCES: Record<string, string> = {
        'built-in-project': Object.values(
            import.meta.glob(
                '/apps/web/src/components/tasks/built-in-project/built-in-project.ts',
                { query: '?raw', import: 'default', eager: true }
            ) as Record<string, string>
        ).join('\n'),
        project: Object.values(
            import.meta.glob('/apps/web/src/components/tasks/project/project.ts', {
                query: '?raw',
                import: 'default',
                eager: true
            }) as Record<string, string>
        ).join('\n'),
        tag: Object.values(
            import.meta.glob('/apps/web/src/components/tasks/tag/tag.ts', {
                query: '?raw',
                import: 'default',
                eager: true
            }) as Record<string, string>
        ).join('\n')
    }

    for (const [name, source] of Object.entries(SOURCES)) {
        it(`${name}：切换导航携带当前 taskId`, () => {
            expect(source).not.toBe('')
            expect(source).toContain('taskId: router.currentRoute.value.params.taskId')
        })
    }
})