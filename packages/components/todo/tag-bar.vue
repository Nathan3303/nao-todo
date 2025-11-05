<script lang="ts" setup>
import { computed } from 'vue'
import { TagNode, ComboBox } from '@nao-todo/components'
import type { Tag, Todo } from '@nao-todo/types'
import type { FrameworkOption } from '../general/types'

type TodoTagBarProps = {
    tags: Tag[]
    todoTags: Todo['tags']
    clamped?: number
    readonly?: boolean
    small?: boolean
    transformOrigin?: string
}
type TodoTagBarEmits = {
    (event: 'updateTags', tags: Todo['tags']): void
}

defineOptions({ name: 'TodoTagBar' })
const props = withDefaults(defineProps<TodoTagBarProps>(), {
    clamped: Infinity,
    small: false,
    readonly: false
})
const emit = defineEmits<TodoTagBarEmits>()

const styles = computed(() => ({
    '--tag-bar-transform-origin': props.transformOrigin
}))

const comboBoxOptions = computed<FrameworkOption[]>(() => {
    return !props.todoTags
        ? []
        : props.tags.map((tag) => {
              return {
                  label: tag.name,
                  value: tag.id,
                  checked: props.todoTags ? props.todoTags.indexOf(tag.id) !== -1 : false
              }
          })
})

const selectedTags = computed<Tag[]>(() => {
    return props.tags.filter((tag) =>
        props.todoTags ? props.todoTags.indexOf(tag.id) !== -1 : false
    )
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
</script>

<template>
    <nue-div theme="tag-bar" :style="styles" :data-small="small">
        <tag-node
            v-for="tag in selectedTags"
            :key="tag.id"
            :readonly="readonly"
            :tag="tag"
            @delete="handleDropTag"
        />
        <tag-node
            v-if="todoTags.length > clamped"
            :tag="{
                id: 'overflow-tag',
                name: `+${todoTags.length - clamped}`,
                color: '#a1a1a1'
            }"
            readonly
        />
        <combo-box
            v-if="!readonly"
            :framework="comboBoxOptions"
            hide-counter
            hide-on-click
            trigger-title="标签"
            @change="handleAddTag"
        />
    </nue-div>
</template>

<style scoped>
.nue-div.nue-div--tag-bar {
    --tag-bar-transform-origin: right;

    width: 100%;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;

    &[data-small='true'] {
        transform: scale(0.9);
        transform-origin: var(--tag-bar-transform-origin);
        gap: 0.5rem;
        width: fit-content;

        .tag-node {
            height: 20px;
            padding: 0 0.4375rem;

            .tag-node__name {
                font-size: var(--nue-text-xs);
            }
        }
    }
}
</style>

