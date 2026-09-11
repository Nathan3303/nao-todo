// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent } from 'vue'
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
    sessionExpiredListener: null as null | (() => void)
}))

vi.mock('vue-router', () => ({
    useRouter: () => ({ replace: mocks.replace })
}))

vi.mock('@/router', () => ({
    LAST_VISITED_ROUTE_KEY: 'LAST_VISITED_ROUTE'
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
    cryptoService: { lock: mocks.lock, isUnlocked: true },
    deletionService: { checkAndCleanExpired: vi.fn() },
    initSnowflakeEpoch: vi.fn(),
    localSession: { clear: mocks.clearSession, getCurrentUserId: () => 'u-1' },
    readCachedNickname: () => null,
    resolveUserIdFromStoredJwt: () => 'u-1',
    syncService: {
        start: vi.fn(),
        schedulePush: vi.fn(),
        setSessionExpiredListener: (listener: () => void) => {
            mocks.sessionExpiredListener = listener
        }
    },
    syncTracker: { setDirtyListener: vi.fn() }
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

const mountRoot = (): VueWrapper => {
    wrapper = mount(AppRoot, {
        global: {
            plugins: [createPinia()],
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
    root.findComponent(UnlockGateStub).vm.$emit('unlocked')
    await flushPromises()
    return root.findComponent(InitialSyncGateStub).vm as InstanceType<typeof InitialSyncGateStub>
}

beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    revokeOfflineEntry()
    mocks.replace.mockResolvedValue(undefined)
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

    it('B-1/C-25：登出 ⇒ 清离线授权 + 显式 replace(/auth/signin)', async () => {
        grantOfflineEntry()
        const root = mountRoot()
        const gate = await reachSyncGate(root)
        gate.$emit('signOut')
        await flushPromises()
        expect(isOfflineEntryGranted()).toBe(false)
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
})