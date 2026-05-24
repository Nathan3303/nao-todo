<script setup lang="ts">
import type { ProjectArchiveButtonProps, ProjectArchiveButtonEmits } from './types'

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
    --nue-icon-size: var(--nue-text-df);
    --nue-icon-weight: normal;
    cursor: pointer;
    transition: all var(--nue-animation-duration-short);
}
</style>

