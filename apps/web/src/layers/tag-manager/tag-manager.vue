<template>
    <nue-dialog ref="dialogRef" v-model="visible" title="标签管理">
        <nue-div vertical align="stretch">
            <nue-text size="12px" color="gray">
                "标签管理"能够清楚地展示出所有的标签，方便执行标签的增删改查。
            </nue-text>
            <nue-div align="center" justify="space-between">
                <tag-filter-bar :filter-options="filterInfo" @filter="handleFilter" />
                <nue-div width="fit-content" gap="12px">
                    <nue-button
                        theme="small,primary"
                        icon="plus-circle"
                        @click="showCreateTagDialog"
                    >
                        新增
                    </nue-button>
                </nue-div>
            </nue-div>
            <nue-div class="tag-manager" vertical align="stretch">
                <tag-board
                    :tags="tags"
                    :loading-state="loading"
                    @delete="handleDeleteTag"
                    @recolor="showUpdateColorDialog"
                />
            </nue-div>
        </nue-div>
    </nue-dialog>
    <create-tag-dialog ref="createTagDialogRef" :handler="handleCreateTag" />
    <tag-color-select-dialog ref="tagColorSelectDialogRef" :handler="tagStore.updateTagColor" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CreateTagDialog, TagBoard, TagColorSelectDialog, TagFilterBar } from '@nao-todo/components'
import { useTagStore } from '@/stores'
import type { CreateTagOptions, GetTagsOptions, Tag } from '@nao-todo/types'

defineOptions({ name: 'TagManager' })

const route = useRoute()
const router = useRouter()
const tagStore = useTagStore()

const visible = ref(false)
const loading = ref(false)
const createTagDialogRef = ref<InstanceType<typeof CreateTagDialog>>()
const tagColorSelectDialogRef = ref<InstanceType<typeof TagColorSelectDialog>>()
const filterInfo = ref<GetTagsOptions>({})
const tags = ref<Tag[]>([])

const showCreateTagDialog = () => createTagDialogRef.value?.show()
const showUpdateColorDialog = async (tagId: Tag['id']) => {
    const tag = tagStore.getTagByIdFromLocal(tagId)
    tagColorSelectDialogRef.value?.show(tagId, tag?.color || 'transparent')
}

const handleFilter = async (newFilterOptions: GetTagsOptions) => {
    filterInfo.value = newFilterOptions
    init()
}

const handleCreateTag = async (payload: CreateTagOptions) => {
    const createResult = await tagStore.doCreateTag(payload)
    init()
    return createResult
}

const init = () => {
    tags.value = tagStore.findTagsFromLocal(filterInfo.value)
}

const handleShowDialog = () => {
    visible.value = true
    init()
}

const handleDeleteTag = async (tagId: Tag['id']) => {
    const removeResult = await tagStore.deleteTagWithConfirmation(tagId)
    if (!removeResult) return
    if (route.params.tagId !== tagId) return
    router.push('/tasks/all')
}

defineExpose({
    show: handleShowDialog
})
</script>

<style scoped>
@import url('./tag-manager.css');
</style>
