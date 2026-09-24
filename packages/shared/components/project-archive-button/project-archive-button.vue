<script setup lang="ts">
import { t } from '@nao-todo/shared/locales'
import type { ProjectArchiveButtonProps, ProjectArchiveButtonEmits } from './types'

defineOptions({ name: 'ProjectArchiveButton' })
const props = defineProps<ProjectArchiveButtonProps>()
const emit = defineEmits<ProjectArchiveButtonEmits>()

const handleClick = () => {
    if (props.loading) return
    if (props.isArchived) {
        emit('unarchive')
        return
    }
    emit('archive')
}
</script>

<template>
    <nue-tooltip
        size="small"
        :content="isArchived ? t('component.unarchiveProject') : t('component.archiveProject')"
    >
        <nue-button
            class="project-archive-button"
            :theme="$slots.default ? 'small' : 'pure'"
            :icon="isArchived ? 'unarchive' : 'archive'"
            :loading="loading"
            @click.stop="handleClick"
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