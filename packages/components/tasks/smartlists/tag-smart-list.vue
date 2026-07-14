<script lang="ts" setup>
import { NaoSmartList, type NaoSmartListLinkVO } from '../../smart-list'
import { TagColorDot } from '../../tag/tag-color-dot'
import { useProjectDragger } from '../../use-project-dragger'
import { t } from '@nao-todo/infrastructure/locales'

defineOptions({ name: 'TagSmartList' })
withDefaults(defineProps<{ links: NaoSmartListLinkVO[]; draggable?: boolean }>(), {
    draggable: false
})
const emit = defineEmits<{
    (e: 'open-tag-manager'): void
    (e: 'open-tag-creator'): void
    (e: 'resort', originalId: string, boundId: string, isBefore: boolean): void
}>()

const { handleDragStart, handleDragOver, handleDragLeave, handleDragEnd, handleDrop } =
    useProjectDragger((dragged, dropped, isUp) => {
        const originalId = dragged.dataset.dragId
        const boundId = dropped.dataset.dragId
        if (!originalId || !boundId) return
        emit('resort', originalId, boundId, isUp)
    })
</script>

<template>
    <nao-smart-list
        collapse-item-name="tags"
        :name="t('task.smartlist.tag')"
        :manage-btn-tooltip="t('task.smartlist.tagManage')"
        :create-btn-tooltip="t('task.smartlist.tagCreate')"
        :empty-text="t('task.smartlist.tagEmpty')"
        :draggable="draggable"
        :links="links"
        @manage="() => emit('open-tag-manager')"
        @create="() => emit('open-tag-creator')"
        @dragstart="handleDragStart"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @dragend="handleDragEnd"
        @drop="handleDrop"
    >
        <template #linkAppend="{ link }">
            <tag-color-dot :color="link.payload?.color" size="small" />
        </template>
    </nao-smart-list>
</template>

