<template>
    <nue-div :class="{ 'todo-tag-bar--small': small }" class="todo-tag-bar">
        <tag-node
            v-for="tag in visibleTags"
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

<script lang="ts" setup>
import { useTagBar } from './use-tag-bar'
import { TagNode, ComboBox } from '@nao-todo/components'
import type { TagBarProps, TagBarEmits } from './types'

defineOptions({ name: 'TodoTagBar' })
const props = withDefaults(defineProps<TagBarProps>(), {
    clamped: Infinity,
    small: false
})
const emit = defineEmits<TagBarEmits>()

const { visibleTags, comboBoxOptions, handleAddTag, handleDropTag } = useTagBar(props, emit)
</script>

<style scoped>
.todo-tag-bar {
    text-decoration: none !important;
    width: 100%;
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: center;

    &.todo-tag-bar--small {
        transform: scale(0.9);
        transform-origin: right;
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
