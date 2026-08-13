<script lang="ts" setup>
import { TagNode, ComboBox } from '@nao-todo/shared'
import { useTaskTagBar } from './use-task-tag-bar'
import type { TaskTagBarEmits, TaskTagBarProps } from './types'
import { computed } from 'vue'

defineOptions({ name: 'TaskTagBar' })
const emit = defineEmits<TaskTagBarEmits>()
const props = withDefaults(defineProps<TaskTagBarProps>(), {
    clamped: Infinity
})

const {
    styles,
    comboBoxOptions,
    selectedTags,
    validSelectedCount,
    pushTagHandler,
    dropTagHandler,
    createTagHandler
} = useTaskTagBar(props, emit)

// @computed 溢出数量：仅统计有效标签（无效/已删除标签 ID 不参与溢出计算）
const overflowCount = computed(() => validSelectedCount.value - props.clamped)

// @computed 溢出标签：名称随溢出数量响应式更新（标签增删后 +N 刷新）
const overflowTag = computed(() => ({
    id: 'overflow-tag',
    name: `+${overflowCount.value}`,
    color: 'var(--nue-primary-color-500)'
}))
</script>

<template>
    <nue-div theme="tag-bar" :style="styles" :data-small="small">
        <tag-node
            v-for="tag in selectedTags"
            :key="tag.id"
            :readonly="readonly"
            :tag="tag"
            @delete="dropTagHandler"
        />
        <tag-node
            v-if="selectedTags.length >= clamped && overflowCount > 0"
            :tag="overflowTag"
            readonly
        />
        <combo-box
            v-if="!readonly"
            :framework="comboBoxOptions"
            hide-counter
            hide-on-click
            trigger-title="标签"
            @change="pushTagHandler"
        >
            <template #emptyActions="{ filterText }">
                <nue-button theme="ghost" icon="plus" @click="createTagHandler(filterText)">
                    创建标签：{{ filterText }}
                </nue-button>
            </template>
        </combo-box>
    </nue-div>
</template>

<style scoped>
.nue-div.nue-div--tag-bar {
    --tag-bar-transform-origin: right;

    width: 100%;
    gap: var(--nue-gap-xs);
    flex-wrap: wrap;
    align-items: center;

    &[data-small='true'] {
        transform-origin: var(--tag-bar-transform-origin);
        gap: 0;
        width: fit-content;

        .tag-node {
            height: 20px;
            padding: 0 var(--nue-padding-xs);
            transform: scale(0.92);
        }
    }
}
</style>