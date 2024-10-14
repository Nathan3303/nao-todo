<template>
    <nue-div class="todo-tag-bar" width="fit-content">
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
            @change="handleAddTag"
        />
    </nue-div>
</template>

<script setup lang="ts">
import { useTagBar } from './use-tag-bar'
import { TagNode, ComboBox } from '@/components'
import type { TodoTagBarProps, TodoTagBarEmits } from './types'

defineOptions({ name: 'TodoTagBar' })
const props = withDefaults(defineProps<TodoTagBarProps>(), {
    clamped: Infinity
})
const emit = defineEmits<TodoTagBarEmits>()

const { visibleTags, comboBoxOptions, handleAddTag, handleDropTag } = useTagBar(
    props,
    emit
)
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
</style>
