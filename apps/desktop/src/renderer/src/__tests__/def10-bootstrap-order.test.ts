// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h, onMounted } from 'vue'
import AppRoot from '../AppRoot.vue'

/**
 * DEF-10 / AC14 回归线 —— 解锁门退役后注销到期清理仍触发（**顺序断言**）
 *
 * **验收判据**（PRD §7 AC14）：`G` 解锁门**已退役** ／ `W` 冷启动 ／ `T` 注销到期清理**仍触发**；
 * **顺序断言**：`checkAndCleanExpired` **早于** `InitialSyncGate.start()`。
 *
 * **现状缺陷**（ADR C-61 / DEF-10）：`deletionService.checkAndCleanExpired()` 的**唯一生产调用点**在
 * `unlock-gate.vue` ⇒ 门退役即**静默失效**（无报错）。新调用点须收敛为
 * `bootstrapLocalData(userId?)` 并在 **AppRoot 渲染任一门前**执行。
 *
 * 本文件用「**门已退役**」的替身（`unlock-gate` 直接 emit `unlocked`，不再做本地检查）+
 * 「复刻真门唯一副作用（挂载即 `start()`）」的 `initial-sync-gate` 替身，
 * 断言 **AppRoot 层**的调用与**调用顺序** —— 即新收敛点是否真的早于 `start()`。
 */

const mocks = vi.hoisted(() => ({
    checkAndCleanExpired: vi.fn(async () => undefined),
    start: vi.fn(async () => ({ ok: true })),
    schedulePush: vi.fn(),
    setDirtyListener: vi.fn(),
    setSessionExpiredListener: vi.fn(),
    setCurrentUserId: vi.fn(),
    getCurrentUserId: vi.fn(() => 'u-1'),
    clearSession: vi.fn(),
    lock: vi.fn(),
    resolveUserIdFromStoredJwt: vi.fn(() => 'u-1'),
    logStructured: vi.fn()
}))

vi.mock('@nao-todo/infrastructure', () => ({
    registerBackfillTriggers: () => () => {},
    cryptoService: { lock: mocks.lock, isUnlocked: true },
    deletionService: {
        checkAndCleanExpired: mocks.checkAndCleanExpired,
        resumePendingWipe: vi.fn(async () => false)
    },
    initSnowflakeEpoch: vi.fn(),
    localSession: {
        clear: mocks.clearSession,
        getCurrentUserId: mocks.getCurrentUserId,
        setCurrentUserId: mocks.setCurrentUserId
    },
    readCachedNickname: () => null,
    resolveUserIdFromStoredJwt: mocks.resolveUserIdFromStoredJwt,
    syncService: {
        start: mocks.start,
        schedulePush: mocks.schedulePush,
        setSessionExpiredListener: mocks.setSessionExpiredListener
    },
    syncTracker: { setDirtyListener: mocks.setDirtyListener },
    logStructured: mocks.logStructured,
    STRUCTURED_LOG_EVENTS: {
        LIFECYCLE_BOOTSTRAP_STARTED: 'lifecycle.bootstrap.started',
        LIFECYCLE_BOOTSTRAP_COMPLETED: 'lifecycle.bootstrap.completed',
        LIFECYCLE_BOOTSTRAP_FAILED: 'lifecycle.bootstrap.failed'
    }
}))

vi.mock('@/App.vue', () => ({
    default: defineComponent({ name: 'App', template: '<div id="app-stub" />' })
}))

vi.mock('@/router', () => ({
    LAST_VISITED_ROUTE_KEY: 'LAST_VISITED_ROUTE',
    SECTION_LAST_ROUTE_MAP: { tasks: 'LAST_TASKS_ROUTE', calendar: 'LAST_CALENDAR_ROUTE' }
}))

vi.mock('../hooks/use-local-reminder', () => ({
    useLocalReminder: () => ({ start: vi.fn(), stop: vi.fn(), rescan: vi.fn() })
}))

vi.mock('../hooks/usecases/use-task-reminder', () => ({ useTaskReminder: () => ({}) }))

vi.mock('@nao-todo/presentation/task', () => ({
    TaskReminderDialog: defineComponent({ name: 'TaskReminderDialog', render: () => null }),
    useStoreInvalidationHub: vi.fn()
}))

/** 「门已退役」替身：不做任何本地检查，直接放行（等价退役后语义） */
const RetiredUnlockGateStub = defineComponent({
    name: 'UnlockGate',
    emits: ['unlocked'],
    setup(_props, { emit }) {
        onMounted(() => emit('unlocked'))
        return () => h('div', { class: 'unlock-stub' })
    }
})

/** 复刻真 `InitialSyncGate` 的唯一副作用：挂载即 `syncService.start()`（C-61 顺序断言的对侧） */
const StartOnMountSyncGateStub = defineComponent({
    name: 'InitialSyncGate',
    emits: ['synced', 'offline', 'signOut'],
    setup(_props, { emit }) {
        onMounted(() => {
            void mocks.start()
            emit('synced')
        })
        return () => h('div', { class: 'sync-gate-stub' })
    }
})

let wrapper: VueWrapper | null = null

const mountRoot = (): VueWrapper => {
    wrapper = mount(AppRoot, {
        global: {
            plugins: [createPinia()],
            stubs: {
                'unlock-gate': RetiredUnlockGateStub,
                'initial-sync-gate': StartOnMountSyncGateStub,
                'sync-status-bar': true,
                'task-reminder-dialog': true
            }
        }
    })
    return wrapper
}

describe('DEF-10 / AC14：门退役后注销到期清理仍触发（顺序断言）', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        wrapper?.unmount()
        wrapper = null
    })

    it('冷启动（门已退役）⇒ checkAndCleanExpired 仍被调用，且带 JWT 解析出的 userId', async () => {
        mountRoot()
        await flushPromises()

        expect(mocks.checkAndCleanExpired).toHaveBeenCalledWith('u-1')
    })

    it('顺序断言：checkAndCleanExpired 早于 InitialSyncGate.start()', async () => {
        mountRoot()
        await flushPromises()

        expect(mocks.start).toHaveBeenCalled()
        const cleanOrder = mocks.checkAndCleanExpired.mock.invocationCallOrder[0]
        const startOrder = mocks.start.mock.invocationCallOrder[0]
        expect(cleanOrder).toBeDefined()
        expect(startOrder).toBeDefined()
        expect(cleanOrder!).toBeLessThan(startOrder!)
    })

    it('AC18（证据，新增）：desktop 冷启动经共享 bootstrapLocalData 落 LIFECYCLE_BOOTSTRAP_STARTED / COMPLETED（禁 PII）', async () => {
        mountRoot()
        await flushPromises()

        expect(mocks.logStructured).toHaveBeenCalledWith('info', 'lifecycle.bootstrap.started', {
            hasExplicitUserId: false
        })
        expect(mocks.logStructured).toHaveBeenCalledWith('info', 'lifecycle.bootstrap.completed', {
            hasExplicitUserId: false,
            hasSession: true
        })
        const serialized = JSON.stringify(mocks.logStructured.mock.calls)
        expect(serialized).not.toContain('u-1')
        expect(serialized.toLowerCase()).not.toContain('token')
    })
})