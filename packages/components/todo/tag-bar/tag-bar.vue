<template>
    <nue-div :class="{ 'todo-tag-bar--small': small }" class="todo-tag-bar" width="fit-content">
        <nue-div v-if="visibleTags.length" align="center" gap="8px" width="fit-content">
            <tag-node
                v-for="tag in visibleTags"
                :key="tag.id"
                :readonly="readonly"
                :tag="tag"
                @delete="handleDropTag"
            />
            <nue-div v-if="todoTags.length > clamped" class="todo-tag-bar__clamped-text">
                <nue-text color="white">+{{ todoTags.length - clamped }}</nue-text>
            </nue-div>
        </nue-div>
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
    align-items: center;
    gap: 12px;
    text-decoration: none !important;
}

.todo-tag-bar__clamped-text {
    width: fit-content;
    background-color: #a1a1a1;
    border-radius: 99px;
    padding: 3px 8px;
}

.todo-tag-bar__clamped-text > .nue-text {
    font-size: 12px;
    color: white !important;
}

.todo-tag-bar--small .tag-node,
.todo-tag-bar--small .todo-tag-bar__clamped-text {
    --tag-node-vgap: 6px;
    --tag-node-fs: calc(var(--text-xs) - 0.08rem);
}
</style>
