// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { NueDropdown } from 'nue-ui'
import { TaskDateSelector } from '../../date-selector'
import { TaskTagBar } from '../../tag-bar'

/**
 * T688 / `DEF-153` —— **控件交互起点接线**（真实组件 + 源级守卫）
 *
 * 契约：`O` 必须在**交互起点**冻结（日期面板打开 / 标签编辑态进入 / 下拉打开 / 开关点击前），
 * 而不是保存时刻（期间自动刷新会推进 store 值 —— `DEF-145` 教训）。
 *
 * 证据分两层：
 * ① **真实组件挂载**：面板 `before-open` ⇒ 组件向外发 `edit-start`（日期 / 标签两处）；
 * ② **源级守卫**：其余三处（详情 header 勾选 / main 下拉区 / footer 星标与移动）冻结调用必须存在
 *    且位于对应动作处理内 —— 这些交互依赖真实下拉/对话框链路，行为面已由
 *    `t688-def153-edit-origin`（基准透传）+ `t688-def153-nontext-overwrite`（判据矩阵）覆盖。
 */

let wrapper: VueWrapper | null = null

afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
})

describe('T688 / DEF-153 ① 日期面板打开 ⇒ 组件发 edit-start', () => {
    it('面板 before-open（= 打开那一刻）⇒ edit-start 恰一次', async () => {
        wrapper = mount(TaskDateSelector, {
            props: { startAt: null, endAt: null },
            global: {
                stubs: {
                    'task-remind-setter': true,
                    'nue-date-picker': true,
                    'nue-div': true,
                    'nue-divider': true,
                    'nue-text': true
                }
            }
        })
        const dropdown = wrapper.findComponent(NueDropdown)
        expect(dropdown.exists()).toBe(true)
        dropdown.vm.$emit('beforeOpen')
        await wrapper.vm.$nextTick()

        expect(wrapper.emitted('edit-start')).toHaveLength(1)
    })
})

describe('T688 / DEF-153 ② 标签编辑态进入 ⇒ 组件发 edit-start', () => {
    it('combo-box 面板 before-open ⇒ edit-start 恰一次', async () => {
        wrapper = mount(TaskTagBar, {
            props: { availableTags: [], taskTagIds: [] },
            global: { components: { NueDropdown } }
        })
        const dropdown = wrapper.findComponent(NueDropdown)
        expect(dropdown.exists()).toBe(true)
        dropdown.vm.$emit('beforeOpen')
        await wrapper.vm.$nextTick()

        // `task-tag-bar` 发出的**事件名**是驼峰 `editStart`（VTU 按原样记录）
        expect(wrapper.emitted('editStart')).toHaveLength(1)
    })
})

// --- 源级守卫（交互链路依赖真实下拉/对话框，行为面见另两个用例文件） ---

const sources = import.meta.glob(
    [
        '/packages/presentation/task/components/task-details/main/index.vue',
        '/packages/presentation/task/components/task-details/header/index.vue',
        '/packages/presentation/task/components/task-details/footer/index.vue'
    ],
    { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

const sourceOf = (suffix: string): string => {
    const entry = Object.entries(sources).find(([path]) => path.endsWith(suffix))
    expect(entry, `源级守卫：未找到 ${suffix}`).toBeTruthy()
    return entry![1]
}

describe('T688 / DEF-153 ③ 其余交互起点的冻结调用（源级守卫）', () => {
    it('详情 main：状态/优先级下拉区点击冻结两者', () => {
        const source = sourceOf('/main/index.vue')
        expect(source).toContain('@click="beginEditSelectors"')
        expect(source).toContain("beginEdit('state')")
        expect(source).toContain("beginEdit('priority')")
        expect(source).toContain('@edit-start="beginEdit(\'tags\')"')
    })

    it('详情 header：勾选完成前冻结 state；日期面板打开冻结日期/提醒组', () => {
        const source = sourceOf('/header/index.vue')
        expect(source).toContain("beginEdit('state')")
        expect(source).toContain('@edit-start="beginEditDates"')
        for (const field of [
            'startAt',
            'endAt',
            'remindAt',
            'remindRepeat',
            'remindTime',
            'remindWeekdays'
        ]) {
            expect(source).toContain(`'${field}'`)
        }
    })

    it('详情 footer：星标与移动为子任务前冻结对应字段', () => {
        const source = sourceOf('/footer/index.vue')
        expect(source).toContain("beginEdit('starMarkAt')")
        expect(source).toContain("beginEdit('parentTaskId')")
    })
})