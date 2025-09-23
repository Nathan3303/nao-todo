<template>
    <nue-div :class="classes" :style="styles">
        <span class="tag-node__name">{{ tag.name }}</span>
        <nue-icon
            v-if="!readonly"
            class="tag-node__delete-button"
            name="clear"
            @click="handleDelete(tag.id)"
        />
    </nue-div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

defineOptions({ name: 'TagNode' })
const props = defineProps<{
    tag: { id: string; name: string; color: string }
    deletable?: boolean
    readonly?: boolean
}>()
const emit = defineEmits<{
    (event: 'delete', id: string): void
}>()

const classes = computed(() => {
    return ['tag-node', { 'tag-node--transparent': props.tag.color === 'transparent' }]
})

const styles = computed(() => {
    return {
        '--tag-node-bg': props.tag.color || '#f5f5f5'
    }
})

const handleDelete = (id: string) => {
    emit('delete', id)
}
</script>

<style scoped>
.tag-node {
    --tag-node-fs: var(--nue-text-xs);
    --tag-node-vgap: 0.5rem;
    --tag-node-bg: unset;

    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    width: fit-content;
    height: 28px;
    background-color: var(--tag-node-bg);
    border-radius: 99px;
    position: relative;
    cursor: default;
    flex: none;
    gap: var(--tag-node-vgap);
    padding: 0.25rem 0.75rem;

    .tag-node__name {
        color: white;
        font-size: var(--tag-node-fs);
        line-height: 1;
    }

    .tag-node__delete-button {
        display: block;
        color: white;
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
