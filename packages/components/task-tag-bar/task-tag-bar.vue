<script lang="ts" setup>
import { TagNode } from '../tag-node'
import { ComboBox } from '../combo-box'
import { useTaskTagBar } from './use-task-tag-bar'
import type { TaskTagBarEmits, TaskTagBarProps } from './types'

defineOptions({ name: 'TaskTagBar' })
const emit = defineEmits<TaskTagBarEmits>()
const props = withDefaults(defineProps<TaskTagBarProps>(), {
    clamped: Infinity
})

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
            v-if="selectedTags.length > clamped"
            :tag="{
                id: 'overflow-tag',
                name: `+${selectedTags.length - clamped}`,
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
        transform: scale(0.83);
        transform-origin: var(--tag-bar-transform-origin);
        gap: 0.5rem;
        width: fit-content;

        .tag-node {
            height: 20px;
            padding: 0 var(--nue-padding-xs);

            .tag-node__name {
                font-size: var(--nue-text-xs);
            }
        }
    }
}
</style>

