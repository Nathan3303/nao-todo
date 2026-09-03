<script lang="ts" setup>
import { NaoSmartList, TagColorDot, useDragSorter, t, type SortHandler } from '@nao-todo/shared'
import { TagSmartListEmits, TagSmartListProps } from './types'

defineOptions({ name: 'TagSmartList' })
withDefaults(defineProps<TagSmartListProps>(), { draggable: false })
const emit = defineEmits<TagSmartListEmits>()

/**
 * 排序处理函数
 * @param dragged 拖动的元素
 * @param dropped 目标元素
 * @param isUp 是否是上移
 */
const sortHandler: SortHandler = (dragged, dropped, isUp) => {
    const originalId = dragged.dataset.dragId
    const boundId = dropped.dataset.dragId
    // 检查拖动的元素和目标元素是否存在
    if (!originalId || !boundId) return
    // 触发排序事件
    emit('resort', originalId, boundId, isUp)
}

// 拖排序器
const { handleDragStart, handleDragOver, handleDragLeave, handleDragEnd, handleDrop } =
    useDragSorter(sortHandler)
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