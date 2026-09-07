// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { PomodoroRecordViewObject } from '@nao-todo/domain-pomodoro'
import {
    usePomodoroBadge,
    type PomodoroBadgeLoader,
    type PomodoroBadgeRange
} from './use-pomodoro-badge'
import { usePomodoroRecordsStore } from '@nao-todo/presentation/pomodoro'

/**
 * B1-F5 集成回归：真实链路为「服务端响应 → store Map 形态 records → labelMap/badgeLabel」。
 * @description 复现根因（Map 被当数组迭代 → isTimerRound 恒 false → 徽标恒空）的防回归断言；
 *              用 pinia 真实 store + 注入分页 loader（无网络）。
 */

const makeRecord = (id: string, type: number, startAt: string): PomodoroRecordViewObject =>
    ({
        id,
        type,
        startAt,
        endAt: startAt,
        sessionId: 's',
        pomodoroId: null,
        taskId: 'task',
        taskName: '任务'
    }) as unknown as PomodoroRecordViewObject

const Harness = defineComponent({
    props: { initialEnabled: { type: Boolean, default: true } },
    setup(props) {
        const range = ref<PomodoroBadgeRange | null>({ fromKey: '2026-09-05', toKey: '2026-09-07' })
        const enabled = ref(props.initialEnabled)
        const loader = vi.fn<PomodoroBadgeLoader>(async () => null)
        const badge = usePomodoroBadge(range, enabled, loader)
        return { badge, enabled, loader, range }
    }
})

type HarnessVm = {
    badge: ReturnType<typeof usePomodoroBadge>
    enabled: boolean
    loader: ReturnType<typeof vi.fn>
}

const mountHarness = (pinia: ReturnType<typeof createPinia>, initialEnabled = true) => {
    const w = mount(Harness, {
        attachTo: document.body,
        props: { initialEnabled },
        global: { plugins: [pinia] }
    })
    return w.vm as unknown as HarnessVm
}

describe('usePomodoroBadge - Map store 集成（回归 SB-1~15）', () => {
    it('Map 形态 store 数据 → badgeLabel 正确落格（0 隐藏/type=2 排除/区间外排除）', () => {
        const pinia = createPinia()
        setActivePinia(pinia)
        const recordsStore = usePomodoroRecordsStore()
        // 真实链路：addRecords 写入 Map<id, record>
        recordsStore.addRecords([
            makeRecord('r1', 1, '2026-09-05T09:00:00'),
            makeRecord('r2', 1, '2026-09-05T14:00:00'),
            makeRecord('r3', 2, '2026-09-05T18:00:00'), // type=2 不计
            makeRecord('r4', 1, '2026-09-06T08:00:00'),
            makeRecord('r5', 1, '2026-09-08T08:00:00') // 区间外不计
        ])
        expect(recordsStore.records instanceof Map).toBe(true)
        const vm = mountHarness(pinia)
        expect(vm.badge.badgeLabel('2026-09-05')).toBe('2') // Map 形态不丢（回归根因点）
        expect(vm.badge.badgeLabel('2026-09-06')).toBe('1')
        expect(vm.badge.badgeLabel('2026-09-07')).toBe('') // 0 隐藏
        expect(vm.badge.badgeLabel('2026-09-08')).toBe('') // 区间外
    })

    it('store 后补数据 → labelMap 即时反应（同一可见区间内新增记录计入）', () => {
        const pinia = createPinia()
        setActivePinia(pinia)
        const recordsStore = usePomodoroRecordsStore()
        recordsStore.addRecords([makeRecord('r1', 1, '2026-09-05T09:00:00')])
        const vm = mountHarness(pinia)
        expect(vm.badge.badgeLabel('2026-09-05')).toBe('1')
        recordsStore.addRecords([makeRecord('r2', 1, '2026-09-05T11:00:00')])
        expect(vm.badge.badgeLabel('2026-09-05')).toBe('2')
    })

    it('开关 off=停拉（初始 off 不发请求）；on=恢复拉取并现算', async () => {
        const pinia = createPinia()
        setActivePinia(pinia)
        const recordsStore = usePomodoroRecordsStore()
        recordsStore.addRecords([makeRecord('r1', 1, '2026-09-05T09:00:00')])
        const vm = mountHarness(pinia, false) // 初始 off
        expect(vm.badge.badgeLabel('2026-09-05')).toBe('') // 不显示
        await nextTick()
        expect(vm.loader.mock.calls.length).toBe(0) // off 期零拉取
        vm.enabled = true
        expect(vm.badge.badgeLabel('2026-09-05')).toBe('1') // on 恢复（store 现算）
        await nextTick()
        expect(vm.loader.mock.calls.length).toBeGreaterThan(0) // 恢复拉取
        // 再关：清零且不再新增拉取
        vm.enabled = false
        expect(vm.badge.badgeLabel('2026-09-05')).toBe('')
        const callsAfterOff = vm.loader.mock.calls.length
        await nextTick()
        expect(vm.loader.mock.calls.length).toBe(callsAfterOff)
    })
})