<script lang="ts" setup>
import { TagNode } from '../../tag/tag-node'
import { ComboBox } from '../../combo-box'
import { useTaskTagBar } from './use-task-tag-bar'
import type { TaskTagBarEmits, TaskTagBarProps } from './types'
import { computed } from 'vue'

defineOptions({ name: 'TaskTagBar' })
const emit = defineEmits<TaskTagBarEmits>()
const props = withDefaults(defineProps<TaskTagBarProps>(), {
    clamped: Infinity
})

const overflowCount = computed(() => props.taskTagIds.length - props.clamped)

const overflowTag = {
    id: 'overflow-tag',
    name: `+${overflowCount.value}`,
    color: 'var(--nue-primary-color-500)'
}

const { styles, comboBoxOptions, selectedTags, pushTagHandler, dropTagHandler, createTagHandler } =
    useTaskTagBar(props, emit)
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

