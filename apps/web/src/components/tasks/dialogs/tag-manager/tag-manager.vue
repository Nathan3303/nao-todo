<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import TagManagerFilterBar from './filter-bar.vue'
import { TagBoard } from '@nao-todo/components'
import { useTasksDialogStore, useTagManagerStore } from '@/stores/tasks'
import { type DialogInstanceType, useDialogWrapper } from '@/components/ui/dialog-wrapper'
import type { Tag } from '@nao-todo/types'
import type { DialogOpenFunction, DialogCloseFunction } from '@/stores/tasks/use-tasks-dialog-store'

defineOptions({ name: 'TagManager' })
const emit = defineEmits<{
    (e: 'closeDialog'): void
    (e: 'register', open: DialogOpenFunction, close: DialogCloseFunction): void
}>()

const tagManagerStore = useTagManagerStore()
const tasksDialogStore = useTasksDialogStore()

const dialogRef = ref<DialogInstanceType>()

const { tags } = storeToRefs(tagManagerStore)
const { visible, close } = useDialogWrapper(dialogRef)

const showCreateTagDialog = () => {
    tasksDialogStore.tagCreator?.open?.()
}

const showUpdateTagColorDialog = (tagId: Tag['id']) => {
    tasksDialogStore.tagColorUpdater?.open?.(tagId)
}

const open = () => {
    tagManagerStore.loadTags()
    visible.value = true
}

onMounted(() => emit('register', open, close))

// defineExpose({ open, close })
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef" theme="large">
        <template #header>
            <nue-text>标签管理</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <nue-container id="TagManager" theme="in-dialog">
            <nue-header>
                <tag-manager-filter-bar />
                <nue-div gap="12px" width="fit-content" style="margin-left: auto">
                    <nue-button
                        icon="plus-circle"
                        theme="small,primary"
                        @click="showCreateTagDialog"
                    >
                        新增
                    </nue-button>
                </nue-div>
            </nue-header>
            <nue-divider />
            <nue-main>
                <nue-content fill style="overflow: hidden">
                    <tag-board
                        :tags="tags"
                        @delete="tagManagerStore.deleteTag"
                        @recolor="showUpdateTagColorDialog"
                    />
                </nue-content>
            </nue-main>
        </nue-container>
    </nue-dialog>
</template>

<style scoped>
.tag-manager {
    aspect-ratio: 16 / 9;
    min-height: 520px;
}

.tag-navigations {
    width: fit-content;
    gap: 0;
    padding: 4px;
    background-color: #f4f4f5;
    border-radius: var(--primary-radius);
}

.tag-navigations:deep(.nue-link) {
    padding: 4px 12px;
    height: auto;
    color: #66666e;
    border-color: transparent;
    justify-content: center;
    font-size: 14px;

    --hover-background-color: transparent;
    --active-background-color: transparent;
}

.tag-navigations:deep(.nue-link--actived) {
    background-color: white;
    color: #131315;
    box-shadow: var(--secondary-shadow);
}
</style>

