<script lang="ts" setup>
import { computed } from 'vue'
import { NaoSmartList, type NaoSmartListLinkVO } from '@/components/ui'
import { TagColorDot } from '@nao-todo/components'
import useTasksViewStore from '@/views/tasks/tasks-view-store'
import useTasksDialogStore from '@/views/tasks/tasks-dialog-store'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TagSmartList' })

const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()

const { tags } = storeToRefs(tasksViewStore)

const links = computed<NaoSmartListLinkVO[]>(() => {
    return tags.value.map((tag) => {
        return {
            id: tag.id,
            title: tag.name,
            route: { name: 'tasks-tag', params: { tagId: tag.id } },
            icon: 'tag',
            payload: { color: tag.color }
        } as NaoSmartListLinkVO
    })
})
</script>

<template>
    <nao-smart-list
        collapse-item-name="tags"
        name="标签"
        manage-btn-tooltip="管理所有标签"
        create-btn-tooltip="创建新的标签"
        empty-text="以标签的维度展示不同清单的待办任务"
        :links="links"
        @manage="() => tasksDialogStore.tagManager?.open?.()"
        @create="() => tasksDialogStore.tagCreator?.open?.()"
    >
        <template #linkAppend="{ link }">
            <tag-color-dot :color="link.payload?.color" size="small" />
        </template>
    </nao-smart-list>
</template>
