// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent } from 'vue'
import type { App } from 'vue'
import { LAST_VISITED_ROUTE_KEY } from '@/router'
import {
    grantOfflineEntry,
    isOfflineEntryGranted,
    revokeOfflineEntry
} from '@/views/auth/offline-entry'
import AppRoot from './AppRoot.vue'

/**
 * AppRoot 离线进入编排断言（SHELL-03 附录 B-1 / C-24/C-25）
 * @description 跳转唯一点 = AppRoot：`grantOfflineEntry()` → **await replace 完成** → 才挂 `<App/>`；
 *              登出显式 `replace('/auth/signin')`；10041 会话失效清离线授权。
 */

const mocks = vi.hoisted(() => ({
    replace: vi.fn(),
    lock: vi.fn(),
    clearSession: vi.fn(),
    wipeUserData: vi.fn(async () => undefined),
    sessionExpiredListener: null as null | (() => void)
}))

// 注：不 mock 'vue-router'。AppRoot 经 @/router-access 取 router；测试环境无 router 注入 ⇒
// 真实 useRouter() 返回 undefined（等价 H6 双实例现场），由 app 级 $router 降级完成导航。
vi.mock('@/router', () => ({
    LAST_VISITED_ROUTE_KEY: 'LAST_VISITED_ROUTE',
    SECTION_LAST_ROUTE_MAP: { tasks: 'LAST_TASKS_ROUTE', calendar: 'LAST_CALENDAR_ROUTE' }
}))

vi.mock('@/App.vue', () => ({
    default: defineComponent({ name: 'App', template: '<div id="app-stub" />' })
}))

vi.mock('./hooks/use-local-reminder', () => ({
    useLocalReminder: () => ({ start: vi.fn(), stop: vi.fn(), rescan: vi.fn() })
}))

vi.mock('./hooks/usecases/use-task-reminder', () => ({
    useTaskReminder: () => ({})
}))

vi.mock('@nao-todo/presentation/task', () => ({
    TaskReminderDialog: defineComponent({ name: 'TaskReminderDialog', render: () => null }),
    useStoreInvalidationHub: vi.fn()
}))

vi.mock('@nao-todo/infrastructure', () => ({
    // SHELL-06：装配层回传触发注册（测试桩；返回卸载函数）
    registerBackfillTriggers: () => () => {},
    cryptoService: { lock: mocks.lock, isUnlocked: true },
    deletionService: {
        checkAndCleanExpired: vi.fn(),
        resumePendingWipe: vi.fn(async () => false),
        wipeUserData: mocks.wipeUserData
    },
    initSnowflakeEpoch: vi.fn(),
    localSession: {
        clear: mocks.clearSession,
        getCurrentUserId: () => 'u-1',
        setCurrentUserId: vi.fn()
    },
    readCachedNickname: () => null,
    resolveUserIdFromStoredJwt: () => 'u-1',
    syncService: {
        start: vi.fn(),
        schedulePush: vi.fn(),
        setSessionExpiredListener: (listener: () => void) => {
            mocks.sessionExpiredListener = listener
        }
    },
    syncTracker: { setDirtyListener: vi.fn(), countDirty: async () => 0 }
}))

// T122：生产侧已改窄子路径导入 ⇒ 同步注册同名深路径 mock（转发上方 barrel mock，语义不变）
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/crypto/crypto-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/session/local-session',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-local/deletion/deletion-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/observability/structured-log',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/backfill-triggers',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/sync-service',
    async () => import('@nao-todo/infrastructure')
)
vi.mock(
    '@nao-todo/infrastructure/src/persistence-sync/sync-tracker',
    async () => import('@nao-todo/infrastructure')
)
// TASK-26 / M6：偏好同步接线（本文件只锁离线进入编排；偏好模块单独单测覆盖）
vi.mock('@nao-todo/infrastructure/src/persistence-sync/preference-sync', () => ({
    flushPreferenceQueue: vi.fn(async () => ({ pushed: 0, failed: 0 })),
    pullAndMergeUserConfig: vi.fn(async () => {})
}))

const UnlockGateStub = defineComponent({
    name: 'UnlockGate',
    emits: ['unlocked'],
    template: '<div class="unlock-stub" />'
})
const InitialSyncGateStub = defineComponent({
    name: 'InitialSyncGate',
    emits: ['synced', 'offline', 'signOut'],
    template: '<div class="sync-gate-stub" />'
})

let wrapper: VueWrapper | null = null

/** 已知可导航路由表（resolve 替身用；其他一律视为失效 deep link） */
const NAVIGABLE_TARGETS = ['/tasks', '/calendar', '/tasks/all', '/tasks/all/table']

const fakeResolve = (target: string) => ({
    matched: NAVIGABLE_TARGETS.includes(target) ? [{}] : [],
    fullPath: target
})

/**
 * app 级 $router 注入插件（等价 `app.use(router)` 写入 globalProperties，C-37② 降级层入口）
 * @description VTU 的 `global.mocks` 不写 appContext.globalProperties，故用插件模拟真实安装路径。
 */
const routerFallbackPlugin = {
    install(app: App) {
        ;(app.config.globalProperties as { $router?: unknown }).$router = {
            replace: mocks.replace,
            resolve: fakeResolve
        }
    }
}

/** 挂载 AppRoot；通过 app 级 $router 提供导航 */
const mountRoot = (): VueWrapper => {
    wrapper = mount(AppRoot, {
        global: {
            plugins: [createPinia(), routerFallbackPlugin],
            stubs: {
                'unlock-gate': UnlockGateStub,
                'initial-sync-gate': InitialSyncGateStub,
                'sync-status-bar': true,
                'task-reminder-dialog': true
            }
        }
    })
    return wrapper
}

/** 进入初始同步门（先让解锁门放行） */
const reachSyncGate = async (
    root: VueWrapper
): Promise<InstanceType<typeof InitialSyncGateStub>> => {
    // C-61：先等 AppRoot 启动收敛点完成、解锁门挂载
    await flushPromises()
    root.findComponent(UnlockGateStub).vm.$emit('unlocked')
    await flushPromises()
    return root.findComponent(InitialSyncGateStub).vm as InstanceType<typeof InitialSyncGateStub>
}

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    revokeOfflineEntry()
    mocks.replace.mockResolvedValue(undefined)
    // 自检在 setup 期输出降级告警：静默即可（C-37① 可观测）
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.restoreAllMocks()
})

describe('AppRoot - SHELL-03 离线进入编排', () => {
    it('B-1：离线进入 ⇒ 授权 + replace(LAST_VISITED || /tasks) + **replace 完成后**才挂 <App/>', async () => {
        localStorage.setItem(LAST_VISITED_ROUTE_KEY, '/calendar')
        let releaseReplace: () => void = () => {}
        mocks.replace.mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    releaseReplace = () => resolve()
                })
        )
        const root = mountRoot()
        const gate = await reachSyncGate(root)

        gate.$emit('offline')
        await flushPromises()

        expect(isOfflineEntryGranted()).toBe(true)
        expect(mocks.replace).toHaveBeenCalledWith('/calendar')
        // 顺序硬要求：replace 未完成前不得挂 <App/>（否则会短暂挂载 checkin 并触发其失败分支）
        expect(root.find('#app-stub').exists()).toBe(false)

        releaseReplace()
        await flushPromises()
        expect(root.find('#app-stub').exists()).toBe(true)
    })

    it('B-1：无 LAST_VISITED_ROUTE 时目标为 /tasks', async () => {
        const root = mountRoot()
        const gate = await reachSyncGate(root)
        gate.$emit('offline')
        await flushPromises()
        expect(mocks.replace).toHaveBeenCalledWith('/tasks')
    })

    it('C-25：同步成功不清路由、但清离线授权', async () => {
        grantOfflineEntry()
        const root = mountRoot()
        const gate = await reachSyncGate(root)
        gate.$emit('synced')
        await flushPromises()
        expect(mocks.replace).not.toHaveBeenCalled()
        expect(isOfflineEntryGranted()).toBe(false)
        expect(root.find('#app-stub').exists()).toBe(true)
    })

    it('B-1/C-25：登出 ⇒ 清离线授权 + 清库 + 显式 replace(/auth/signin)', async () => {
        grantOfflineEntry()
        const root = mountRoot()
        const gate = await reachSyncGate(root)
        gate.$emit('signOut')
        await flushPromises()
        expect(isOfflineEntryGranted()).toBe(false)
        expect(mocks.wipeUserData).toHaveBeenCalledWith('u-1')
        expect(mocks.replace).toHaveBeenCalledWith('/auth/signin')
    })

    it('C-25：10041 会话失效 ⇒ 清离线授权 + 清认证 + 跳 signin', async () => {
        grantOfflineEntry()
        mountRoot()
        expect(mocks.sessionExpiredListener).toBeTruthy()
        mocks.sessionExpiredListener?.()
        await flushPromises()
        expect(isOfflineEntryGranted()).toBe(false)
        expect(mocks.clearSession).toHaveBeenCalled()
        expect(mocks.lock).toHaveBeenCalled()
        expect(mocks.replace).toHaveBeenCalledWith('/auth/signin')
    })

    it('C-37②：useRouter() 返回 undefined ⇒ 经 app 级 $router 降级仍完成离线进入终态', async () => {
        // H6 现场：composable 取不到 router（双实例）→ 必须降级且告警，不得 TypeError 卡门
        localStorage.setItem(LAST_VISITED_ROUTE_KEY, '/calendar')

        const root = mountRoot()
        const gate = await reachSyncGate(root)
        gate.$emit('offline')
        await flushPromises()

        expect(mocks.replace).toHaveBeenCalledWith('/calendar')
        expect(root.find('#app-stub').exists()).toBe(true)
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('[SHELL-05]'),
            expect.objectContaining({ source: 'router-injection:global' })
        )
    })

    it('C-26：离线进入导航 reject ⇒ 结构化打点 + finally 仍进壳（不卡门）', async () => {
        localStorage.setItem(LAST_VISITED_ROUTE_KEY, '/calendar')
        mocks.replace.mockRejectedValueOnce(new Error('navigation failed'))

        const root = mountRoot()
        const gate = await reachSyncGate(root)
        gate.$emit('offline')
        await flushPromises()

        // 失败仍进入终态（永不卡门）；授权先于跳转仍生效
        expect(root.find('#app-stub').exists()).toBe(true)
        expect(isOfflineEntryGranted()).toBe(true)
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('[SHELL-05]'),
            expect.objectContaining({ source: 'app-root:offline-navigation' })
        )
    })

    it('C-26：登出导航 reject ⇒ 打点 + finally 仍进壳', async () => {
        grantOfflineEntry()
        mocks.replace.mockRejectedValueOnce(new Error('navigation failed'))

        const root = mountRoot()
        const gate = await reachSyncGate(root)
        gate.$emit('signOut')
        await flushPromises()

        expect(root.find('#app-stub').exists()).toBe(true)
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('[SHELL-05]'),
            expect.objectContaining({ source: 'app-root:signout-navigation' })
        )
    })

    it('C-28：LAST_VISITED 失效 ⇒ 清理该键并回落 SECTION_LAST（/tasks）', async () => {
        localStorage.setItem(LAST_VISITED_ROUTE_KEY, '/gone/deep')
        localStorage.setItem('LAST_TASKS_ROUTE', '/tasks')

        const root = mountRoot()
        const gate = await reachSyncGate(root)
        gate.$emit('offline')
        await flushPromises()

        expect(mocks.replace).toHaveBeenCalledWith('/tasks')
        expect(localStorage.getItem(LAST_VISITED_ROUTE_KEY)).toBeNull()
        expect(root.find('#app-stub').exists()).toBe(true)
    })
})