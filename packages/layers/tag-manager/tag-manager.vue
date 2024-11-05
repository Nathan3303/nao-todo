<template>
    <nue-dialog ref="dialogRef" v-model="visible" title="标签管理">
        <nue-div vertical align="stretch">
            <nue-text size="12px" color="gray">
                "标签管理"能够清楚地展示出所有的标签，方便执行标签的增删改查。
            </nue-text>
            <nue-div align="center" justify="space-between">
                <tag-filter-bar :filter-info="filterInfo" @filter="handleFilter" />
                <nue-div width="fit-content" gap="12px">
                    <nue-button
                        theme="small,primary"
                        icon="plus-circle"
                        @click="showCreateTagDialog"
                    >
                        新增
                    </nue-button>
                    <nue-button theme="small" icon="refresh">刷新</nue-button>
                </nue-div>
            </nue-div>
            <nue-div class="tag-manager" vertical align="stretch">
                <tag-board
                    :tags="tags"
                    :loading-state="loading"
                    @delete="handleDeleteTag"
                    @recolor="handleRecolorTag"
                />
            </nue-div>
        </nue-div>
    </nue-dialog>
    <create-tag-dialog ref="createTagDialogRef" :handler="handleCreateTag" />
    <tag-color-select-dialog ref="tagColorSelectDialogRef" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CreateTagDialog, TagFilterBar, TagBoard, TagColorSelectDialog } from '@nao-todo/components'
import { createTag, removeTagWithConfirm } from '@nao-todo/handlers/tag-handlers'
import { useTagStore } from '@nao-todo/stores'
import type { Tag, TagFilterOptions } from '@nao-todo/stores'

defineOptions({ name: 'TagManager' })

const route = useRoute()
const router = useRouter()
const tagStore = useTagStore()

const visible = ref(false)
const loading = ref(false)
const createTagDialogRef = ref<InstanceType<typeof CreateTagDialog>>()
const tagColorSelectDialogRef = ref<InstanceType<typeof TagColorSelectDialog>>()
const filterInfo = ref<TagFilterOptions>({})
const tags = ref<Tag[]>([])

const showCreateTagDialog = () => {
    createTagDialogRef.value?.show()
}

const handleFilter = async (newFilterOptions: TagFilterOptions) => {
    filterInfo.value = newFilterOptions
    init()
}

const handleCreateTag = async (payload: any) => {
    const createResult = await createTag(payload.name, payload.color)
    init()
    return createResult
}

const handleRecolorTag = async (tagId: Tag['id']) => {
    tagColorSelectDialogRef.value?.show(tagId)
}

const init = () => {
    const res = tagStore.filterLocal(filterInfo.value)
    tags.value = res
}

const handleShowDialog = () => {
    visible.value = true
    init()
}

const handleDeleteTag = async (tagId: Tag['id']) => {
    const removeResult = await removeTagWithConfirm(tagId)
    init()
    console.log(removeResult)
    if (removeResult && removeResult._id !== tagId) return
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
