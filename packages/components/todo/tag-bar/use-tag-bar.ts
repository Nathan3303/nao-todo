import { ref, computed } from 'vue'
import type { TagBarProps, TagBarEmits } from './types'
import type { FrameworkOption } from '@nao-todo/components/general/combo-box/types'

export const useTagBar = (props: TagBarProps, emit: TagBarEmits) => {
    const comboBoxOptions = ref<FrameworkOption[]>([])

    const visibleTags = computed<typeof props.tags>(() => {
        const { tags: avalibleTags, todoTags, clamped } = props
        const _tags: typeof props.tags = []
        if (!todoTags) return _tags
        comboBoxOptions.value = []
        for (const tag of avalibleTags) {
            const option = { label: tag.name, value: tag.id, checked: false }
            if (todoTags.includes(tag.id)) {
                option.checked = true
                if (_tags.length < clamped!) {
                    _tags.push(tag)
                }
            }
            comboBoxOptions.value.push(option)
        }
        return _tags
    })

    const handleAddTag = async (tagId: unknown, { checked }: Partial<FrameworkOption>) => {
        if (!checked) {
            await handleDropTag(tagId as string)
            return
        }
        const todoTags = props.todoTags || []
        const newTags = todoTags.filter((id) => id)
        newTags.push(tagId as string)
        emit('updateTags', newTags)
    }

    const handleDropTag = async (tagId: string) => {
        const todoTags = props.todoTags || []
        const newTags = todoTags.filter((id) => id !== tagId)
        emit('updateTags', newTags as string[])
    }

    return {
        visibleTags,
        comboBoxOptions,
        handleAddTag,
        handleDropTag
    }
}
