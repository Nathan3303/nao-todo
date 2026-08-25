import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { navCore, type AppRoute } from '../nav-core'

const current = (): AppRoute => navCore.getCurrent()

describe('navCore - 轻量页面导航', () => {
    beforeEach(() => navCore.reset('task-list', { builtinId: 'today' }))

    it('reset 后栈底为指定页面', () => {
        expect(current()).toEqual({ screen: 'task-list', params: { builtinId: 'today' } })
    })

    it('push 入栈后 current 指向新页面', () => {
        navCore.push('task-detail', { taskId: 't1' })
        expect(current()).toEqual({ screen: 'task-detail', params: { taskId: 't1' } })
    })

    it('back 弹栈回到上一页；栈底不可再退', () => {
        navCore.push('task-detail', { taskId: 't1' })
        navCore.push('task-create')
        navCore.back()
        expect(current().screen).toBe('task-detail')
        navCore.back()
        expect(current().screen).toBe('task-list')
        navCore.back() // 栈底：不弹
        expect(current().screen).toBe('task-list')
    })

    it('replace 替换当前页（保留栈底语义）', () => {
        navCore.push('task-detail', { taskId: 't1' })
        navCore.replace('settings')
        expect(current()).toEqual({ screen: 'settings', params: {} })
        navCore.back()
        expect(current().screen).toBe('task-list')
    })

    it('订阅变化通知', () => {
        let notified = 0
        const unsubscribe = navCore.subscribe(() => notified++)
        navCore.push('settings')
        expect(notified).toBe(1)
        unsubscribe()
        navCore.push('tag-manage')
        expect(notified).toBe(1)
    })
})

describe('navCore - 栈空兜底（登录成功首帧渲染先于 reset 的回归）', () => {
    it('全新模块：栈空时 getCurrent 返回兜底「今日任务」而非 undefined', async () => {
        vi.resetModules()
        const fresh = await import('../nav-core')
        expect(fresh.navCore.getCurrent()).toEqual({
            screen: 'task-list',
            params: { builtinId: 'today' }
        })
        expect(fresh.navCore.getCurrent().screen).toBe('task-list')
    })

    it('全新模块：栈空时 replace 仍可正常落栈', async () => {
        vi.resetModules()
        const fresh = await import('../nav-core')
        fresh.navCore.replace('settings')
        expect(fresh.navCore.getCurrent()).toEqual({ screen: 'settings', params: {} })
        fresh.navCore.back()
        expect(fresh.navCore.getCurrent().screen).toBe('settings')
    })
})