<script lang="ts" setup>
import { computed } from 'vue'
import { TagNode } from '../tag-node'
import { ComboBox } from '../combo-box'
import type { TagViewObject } from '@nao-todo/types'
import type { ComboBoxOption } from '../combo-box/types'
import type { TaskTagBarEmits, TaskTagBarProps } from './types'

defineOptions({ name: 'TaskTagBar' })
const props = withDefaults(defineProps<TaskTagBarProps>(), {
    clamped: Infinity,
    small: false,
    readonly: false
})
const emit = defineEmits<TaskTagBarEmits>()

const styles = computed(() => ({
    '--tag-bar-transform-origin': props.transformOrigin
}))

const comboBoxOptions = computed<ComboBoxOption[]>(() => {
    return !props.taskTags
        ? []
        : props.tags.map((tag) => {
              return {
                  label: tag.name,
                  value: tag.id,
                  checked: props.taskTags ? props.taskTags.indexOf(tag.id) !== -1 : false
              }
          })
})

const selectedTags = computed<TagViewObject[]>(() => {
    const _tags = props.tags.filter((tag) =>
        props.taskTags ? props.taskTags.indexOf(tag.id) !== -1 : false
    )
    return _tags.slice(0, props.clamped)
})

const handleAddTag = async (tagId: unknown, { checked }: Partial<ComboBoxOption>) => {
    if (!checked) {
        await handleDropTag(tagId as string)
        return
    }
    const taskTags = props.taskTags || []
    const newTags = taskTags.filter((id) => id)
    newTags.push(tagId as string)
    emit('updateTags', newTags)
}

const handleDropTag = async (tagId: string) => {
    const taskTags = props.taskTags || []
    const newTags = taskTags.filter((id) => id !== tagId)
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
            v-if="taskTags.length > clamped"
            :tag="{
                id: 'overflow-tag',
                name: `+${taskTags.length - clamped}`,
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
