<template>
    <nue-tooltip size="small" :content="isArchived ? '取消归档清单' : '归档清单'">
        <nue-button
            class="project-archive-button"
            :theme="$slots.default ? 'small' : 'pure'"
            :icon="isArchived ? 'unarchive' : 'archive'"
            @click.stop="handleClick"
        >
            <slot />
        </nue-button>
    </nue-tooltip>
</template>

<script setup lang="ts">
defineOptions({ name: 'ProjectArchiveButton' })
const props = defineProps<{
    isArchived?: boolean
}>()
const emit = defineEmits<{
    (event: 'archive'): void
    (event: 'unarchive'): void
}>()

const handleClick = () => {
    if (props.isArchived) emit('unarchive')
    else emit('archive')
}
</script>

<style scoped>
.project-archive-button {
    --icon-size: 16px;
    --icon-weight: normal;
    cursor: pointer;
    transition: all 0.16s;
}
</style>
