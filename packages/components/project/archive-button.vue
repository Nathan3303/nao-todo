<script setup lang="ts">
type ProjectArchiveButtonProps = {
    isArchived?: boolean
}
type ProjectArchiveButtonEmits = {
    (event: 'archive'): void
    (event: 'unarchive'): void
}

defineOptions({ name: 'ProjectArchiveButton' })
const props = defineProps<ProjectArchiveButtonProps>()
const emit = defineEmits<ProjectArchiveButtonEmits>()

const handleClick = () => {
    if (props.isArchived) {
        emit('unarchive')
        return
    }
    emit('archive')
}
</script>

<template>
    <nue-tooltip size="small" :content="isArchived ? '取消归档清单' : '归档清单'">
        <nue-button
            class="project-archive-button"
            :theme="$slots.default ? 'small' : 'pure'"
            :icon="isArchived ? 'unarchive' : 'archive'"
            @click="handleClick"
        >
            <slot />
        </nue-button>
    </nue-tooltip>
</template>

<style scoped>
.project-archive-button {
    --icon-size: 16px;
    --icon-weight: normal;
    cursor: pointer;
    transition: all 0.16s;
}
</style>

