<script lang="ts" setup>
import { computed } from 'vue'
import type { TagNodeProps, TagNodeEmits } from './types'

defineOptions({ name: 'TagNode', inheritAttrs: false })
const props = defineProps<TagNodeProps>()
const emit = defineEmits<TagNodeEmits>()

const classes = computed(() => [
    'tag-node',
    { 'tag-node--transparent': props.tag.color === 'transparent' }
])

const styles = computed(() => ({
    '--tag-node-bg': props.tag.color || '#f5f5f5'
}))
</script>

<template>
    <nue-div :class="classes" :style="styles">
        <nue-text class="tag-node__name" :clamped="1">{{ tag.name }}</nue-text>
        <nue-icon
            v-if="!readonly"
            class="tag-node__delete-button"
            name="clear"
            @click="emit('delete', tag.id)"
        />
    </nue-div>
</template>

<style scoped>
.tag-node {
    --tag-node-fs: var(--nue-text-xs);
    --tag-node-vgap: 0.25rem;
    --tag-node-bg: unset;

    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    flex: none;
    gap: var(--tag-node-vgap);
    width: fit-content;
    max-width: 8rem;
    height: 28px;
    padding: 0.25rem 0.5rem;
    overflow: hidden;
    background-color: var(--tag-node-bg);
    border-radius: 99px;
    position: relative;
    color: white;
    transition: all var(--nue-animation-duration-short) ease;
    cursor: default;

    .tag-node__name {
        font-size: var(--tag-node-fs);
        /* font-weight: bold; */
        word-break: break-all;
    }

    .tag-node__delete-button {
        display: block;
        border-radius: 99px;
        cursor: pointer;
        transition: opacity 0.16s ease;
        --nue-icon-size: var(--nue-text-xs);
        opacity: 0.6;

        &:hover {
            opacity: 1;
        }
    }

    &:hover .tag-node__delete-button {
        opacity: 1;
    }
}

.tag-node--transparent {
    border: 1px solid #696969;

    .tag-node__name {
        color: #696969;
    }
}
</style>

