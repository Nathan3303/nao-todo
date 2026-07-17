<script lang="ts" setup>
import { NaoSmartList, type NaoSmartListLinkVO, t, useDragSorter } from '@nao-todo/shared'

defineOptions({ name: 'ProjectSmartList' })
withDefaults(defineProps<{ links: NaoSmartListLinkVO[]; draggable?: boolean }>(), {
    draggable: false
})
const emit = defineEmits<{
    (e: 'open-project-manager'): void
    (e: 'open-project-creator'): void
    (e: 'resort', originalId: string, boundId: string, isBefore: boolean): void
}>()

const { handleDragStart, handleDragOver, handleDragLeave, handleDragEnd, handleDrop } =
    useDragSorter((dragged, dropped, isUp) => {
        const originalId = dragged.dataset.dragId
        const boundId = dropped.dataset.dragId
        if (!originalId || !boundId) return
        emit('resort', originalId, boundId, isUp)
    })
</script>

<template>
    <nao-smart-list
        collapse-item-name="projects"
        :name="t('task.smartlist.project')"
        :manage-btn-tooltip="t('task.smartlist.projectManage')"
        :create-btn-tooltip="t('task.smartlist.projectCreate')"
        :empty-text="t('task.smartlist.projectEmpty')"
        :draggable="draggable"
        :links="links"
        @manage="() => emit('open-project-manager')"
        @create="() => emit('open-project-creator')"
        @dragstart="handleDragStart"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @dragend="handleDragEnd"
        @drop="handleDrop"
    />
</template>
