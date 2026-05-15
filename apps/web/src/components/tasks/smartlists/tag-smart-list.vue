<script lang="ts" setup>
import { NaoSmartList, type NaoSmartListLinkVO } from '@nao-todo/components/'
import { TagColorDot } from '@nao-todo/components'
import useProjectDragger from '@/layouts/tasks/aside/use-project-dragger'

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
        name="标签"
        manage-btn-tooltip="管理所有标签"
        create-btn-tooltip="创建新的标签"
        empty-text="以标签的维度展示不同清单的待办任务"
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

