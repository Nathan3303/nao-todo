// @vitest-environment jsdom
import { describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NueDiv, NueIcon, NueText } from 'nue-ui'
import { prioritySNMap, TASK_PRIORITIES } from '@nao-todo/domain-task'
import { TaskPriorityInfo } from '../index'
import { TaskPriorityPresets } from '../constants'

/**
 * T582 / DEF-84 优先级「标签」渲染（PRD `docs/prds/2026-10-30-priority-urgent.md` AC1 / AC4 / AC6 · R4）
 * @description 被测组件 = 列表 / 表格 / 看板共用的 `TaskPriorityInfo`（任务优先级标签的**唯一**渲染点）。
 *              **红基线（T582，DEF-84）**：`TaskPriorityPresets` 只有三档 ⇒ ① `urgent` 档缺失（四档用例红）；
 *              ② 渲染 `urgent` 时 `info` 为 undefined、模板取值抛错（AC1 用例红）；
 *              ③ 未知脏值同样抛错（AC4 负向用例红）。三档既有观感用例现状即绿（**回归护栏**）。
 *              AC6 的**对比度 / 浅色暗色观感**属视觉面，交用户人工验收，不在本文件做（不做视觉自动化）。
 */

const mountInfo = (priority: string): VueWrapper =>
    mount(TaskPriorityInfo, {
        props: { priority },
        global: { components: { NueDiv, NueIcon, NueText } }
    })

/** 预设表以 Record 视图读取，避免红基线期类型上尚无 `urgent` 键 */
const presets = (): Record<string, [string, string, string]> =>
    TaskPriorityPresets.value as unknown as Record<string, [string, string, string]>

describe('T582 优先级标签四档（shared/components/task-priority-info）', () => {
    it('AC6/R4：四档都有预设（图标 + 文字标签 + 颜色三元组），标签非空', () => {
        for (const priority of TASK_PRIORITIES as readonly string[]) {
            const preset = presets()[priority]
            expect(preset, `TaskPriorityPresets 缺少档位 ${priority}`).toBeTruthy()
            expect(preset![1].trim().length, `档位 ${priority} 缺少文字标签`).toBeGreaterThan(0)
            expect(typeof preset![0]).toBe('string')
            expect(presets()[priority]![0].trim().length).toBeGreaterThan(0)
        }
        // 预设档位与 domain 枚举同源（R1：不另建第四份枚举）
        expect(Object.keys(presets()).sort()).toEqual(
            [...(TASK_PRIORITIES as readonly string[])].sort()
        )
        expect(typeof (prioritySNMap as Record<string, number>).urgent).toBe('number')
    })

    it('AC1（红基线，DEF-84）：urgent 任务渲染「紧急」，且不显示「低」', () => {
        const wrapper = mountInfo('urgent')
        const text = wrapper.text()
        expect(text).toContain('紧急')
        expect(text).not.toContain('低')
        wrapper.unmount()
    })

    it('AC6 回归护栏（现状已绿）：三档标签仍可读为 低 / 中 / 高', () => {
        const cases: Array<[string, string]> = [
            ['low', '低'],
            ['medium', '中'],
            ['high', '高']
        ]
        for (const [priority, expected] of cases) {
            const wrapper = mountInfo(priority)
            expect(wrapper.text(), `档位 ${priority} 标签异常`).toContain(expected)
            wrapper.unmount()
        }
    })

    it('AC4（红基线，DEF-84）：未知脏值不崩、不出现空白标签', () => {
        const holder: { wrapper?: VueWrapper } = {}
        expect(() => {
            holder.wrapper = mountInfo('unknown-x')
        }, '未知优先级渲染抛错（应兜底而不崩）').not.toThrow()
        const wrapper = holder.wrapper!
        const text = wrapper.text().trim()
        expect(text.length, '未知优先级渲染出空白标签').toBeGreaterThan(0)
        wrapper.unmount()
    })
})