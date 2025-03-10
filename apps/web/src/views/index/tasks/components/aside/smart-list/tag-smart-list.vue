<template>
    <smart-list
        collapse-item-name="tags"
        name="标签"
        manage-btn-tooltip="管理所有标签"
        create-btn-tooltip="创建新的标签"
        empty-text="以标签的维度展示不同清单的待办任务"
        :links="links"
        @manage="() => tasksDialogStore.dialogManagerShow('TagManager')"
        @create="tasksDialogStore.showCreateTagDialog"
    >
        <template #linkAppend="{ link }">
            <tag-color-dot :color="link.payload?.color" size="small" />
        </template>
    </smart-list>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useTagStore } from '@/stores'
import { TagColorDot } from '@nao-todo/components'
import { useTasksDialogStore } from '@/views/index/tasks'
import SmartList from './smart-list.vue'
import type { Tag } from '@nao-todo/types'
import type { SmartListLinkVO } from './types'

defineOptions({ name: 'TagSmartList' })

const tagStore = useTagStore()
const tasksDialogStore = useTasksDialogStore()

const tags = computed<Tag[]>(() => tagStore.findTagsFromLocal({}) || [])

const links = computed<SmartListLinkVO[]>(() => {
    return tags.value.map((tag) => {
        return {
            id: tag.id,
            title: tag.name,
            route: { name: 'tasks-tag', params: { tagId: tag.id } },
            icon: 'tag',
            payload: { color: tag.color }
        } as SmartListLinkVO
    })
})
</script>
