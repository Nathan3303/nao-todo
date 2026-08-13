import { describe, expect, it, vi } from 'vite-plus/test'
import { reactive } from 'vue'
import type { TaskTagBarProps } from '../types'
import { useTaskTagBar } from '../use-task-tag-bar'

const makeProps = (overrides: Partial<TaskTagBarProps> = {}) =>
    reactive({
        availableTags: [
            { id: 'a', name: '标签A' },
            { id: 'b', name: '标签B' }
        ],
        taskTagIds: ['a', 'b'],
        readonly: true,
        transformOrigin: 'left',
        ...overrides
    })

describe('useTaskTagBar - 有效标签计数', () => {
    it('无效标签 ID 不参与有效选中计数（不参与溢出计算）', () => {
        // taskTagIds 含已删除标签 ID 'deleted-id'，availableTags 中不存在
        const props = makeProps({ taskTagIds: ['a', 'deleted-id'] })
        const { validSelectedCount, selectedTags, comboBoxOptions } = useTaskTagBar(
            props as TaskTagBarProps,
            vi.fn()
        )

        // 有效标签仅 'a' 一个
        expect(validSelectedCount.value).toBe(1)
        // selectedTags 只渲染有效标签
        expect(selectedTags.value.map((tag) => tag.id)).toEqual(['a'])
        // 无效 ID 不影响可用选项
        expect(comboBoxOptions.value.map((option) => option.value)).toEqual(['a', 'b'])
    })

    it('全部无效时计数为 0，移除无效 ID 后仍为 0（响应式）', () => {
        const props = makeProps({ taskTagIds: ['ghost-id'] })
        const { validSelectedCount } = useTaskTagBar(props as TaskTagBarProps, vi.fn())

        expect(validSelectedCount.value).toBe(0)

        // 响应式：taskTagIds 变化后重新计算
        props.taskTagIds = ['a', 'ghost-id']
        expect(validSelectedCount.value).toBe(1)
    })
})