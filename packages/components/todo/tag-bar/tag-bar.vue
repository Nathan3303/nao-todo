<template>
    <nue-div class="todo-tag-bar" :class="{ 'todo-tag-bar--small': small }" width="fit-content">
        <nue-div v-if="visibleTags.length" align="center" width="fit-content" gap="8px">
            <tag-node
                v-for="tag in visibleTags"
                :key="tag.id"
                :tag="tag"
                :readonly="readonly"
                @delete="handleDropTag"
            />
            <nue-text
                class="todo-tag-bar__clamped-text"
                v-if="todoTags.length > clamped"
                size="12px"
                color="orange"
            >
                + {{ todoTags.length - clamped }}
            </nue-text>
        </nue-div>
        <combo-box
            v-if="!readonly"
            trigger-title="标签"
            :framework="comboBoxOptions"
            hide-counter
            hide-on-click
            @change="handleAddTag"
        />
    </nue-div>
</template>

<script setup lang="ts">
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

    .todo-tag-bar__clamped-text {
        background-color: #a1a1a1;
        border-radius: 99px;
        padding: 3px 8px;
        color: white !important;
    }
}

.todo-tag-bar--small {
    .tag-node {
        height: 18px;
        padding: 0 6px;
        text-decoration: none !important;

        &:deep(.nue-text) {
            font-size: 0.6rem !important;
            line-height: 18px;
            text-decoration: none !important;
        }
    }

    .todo-tag-bar__clamped-text {
        height: 18px;
        line-height: 18px;
        padding: 0 6px;
        font-size: 0.6rem;
        text-decoration: none !important;
    }
}
</style>
